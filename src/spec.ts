import {
  Ajv2020,
  type ErrorObject,
  type ValidateFunction,
} from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'

export const spec = parse(
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

/** Compiles the schema at a location in the spec, given as path segments. */
export function schemaAt(location: string[]) {
  const pointer = location
    .map((segment) =>
      encodeURIComponent(segment.replaceAll('~', '~0').replaceAll('/', '~1'))
    )
    .join('/')
  const ref = `spec#/${pointer}`
  let validate = validators.get(ref)
  if (!validate) {
    validate = ajv.compile({ $ref: ref })
    validators.set(ref, validate)
  }
  return validate
}

export function errorsText(errors: ErrorObject[] | null | undefined) {
  return ajv.errorsText(errors)
}
