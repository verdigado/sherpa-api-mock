import {
  Ajv2020,
  type ErrorObject,
  type ValidateFunction,
} from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import type { RequestHandler } from 'express'
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'
import { InvalidRequest } from './errors.ts'
import type { Schemas } from './types.ts'

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

function toValidationErrors(
  errors: ErrorObject[]
): Schemas['GnValidationError'][] {
  return errors.map((error) => {
    const segments = error.instancePath.split('/').slice(1)
    if (error.keyword === 'required')
      segments.push(error.params.missingProperty)
    return {
      path: segments.join('.'),
      constraints: [
        { type: error.keyword, message: error.message ?? 'invalid' },
      ],
    }
  })
}

/** Throws when a request body doesn't match the operation's request schema. */
export function assertValidBody(method: string, path: string, body: unknown) {
  const required = spec.paths[path][method].requestBody?.required ?? false
  const validate = schemaAt([
    'paths',
    path,
    method,
    'requestBody',
    'content',
    'application/json',
    'schema',
  ])
  if (body === undefined) {
    if (required) throw new InvalidRequest('missing request body', [], true)
  } else if (!validate(body)) {
    throw new InvalidRequest(
      'Invalid Request Body',
      toValidationErrors(validate.errors ?? [])
    )
  }
}

export function validateBody(method: string, path: string): RequestHandler {
  return (req, _res, next) => {
    assertValidBody(method, path, req.body)
    next()
  }
}
