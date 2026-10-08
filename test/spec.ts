import { Ajv2020, type ValidateFunction } from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { readFileSync } from 'node:fs'
import { expect } from 'vitest'
import { parse } from 'yaml'

const spec = parse(
  readFileSync(new URL('../spec/openapi.yaml', import.meta.url), 'utf-8')
)

const ajv = new Ajv2020({
  strict: false,
  allErrors: true,
  validateSchema: false,
})
addFormats.default(ajv)
ajv.addSchema(spec, 'spec')

const validators = new Map<string, ValidateFunction>()

const pointer = (...segments: string[]) =>
  segments
    .map((s) =>
      encodeURIComponent(s.replaceAll('~', '~0').replaceAll('/', '~1'))
    )
    .join('/')

/**
 * Asserts that a response is documented for the operation and its body matches
 * the documented schema. `path` is the path template as written in the spec.
 */
export function expectMatchesSpec(
  method: string,
  path: string,
  res: { status: number; body: unknown }
) {
  const status = String(res.status)
  let location = ['paths', path, method, 'responses', status]
  let response = spec.paths[path]?.[method]?.responses?.[status]
  expect(
    response,
    `${method.toUpperCase()} ${path} documents no ${status} response`
  ).toBeDefined()

  if (response.$ref) {
    location = response.$ref.slice(2).split('/')
    response = location.reduce((node: any, key: string) => node[key], spec)
  }
  if (!response.content?.['application/json']?.schema) return

  const ref = `spec#/${pointer(...location, 'content', 'application/json', 'schema')}`
  let validate = validators.get(ref)
  if (!validate) {
    validate = ajv.compile({ $ref: ref })
    validators.set(ref, validate)
  }
  expect(validate(res.body), ajv.errorsText(validate.errors)).toBe(true)
}
