import { expect } from 'vitest'
import { errorsText, schemaAt, spec } from '../src/spec.ts'

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

  const validate = schemaAt([
    ...location,
    'content',
    'application/json',
    'schema',
  ])
  expect(validate(res.body), errorsText(validate.errors)).toBe(true)
}
