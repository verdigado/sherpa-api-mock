import type { ErrorObject } from 'ajv/dist/2020.js'
import type { RequestHandler } from 'express'
import { schemaAt, spec } from '../spec.ts'
import type { Schemas } from '../types.ts'

export class InvalidRequest extends Error {
  validationErrors: Schemas['GnValidationError'][]
  missingBody: boolean

  constructor(
    message: string,
    validationErrors: Schemas['GnValidationError'][] = [],
    missingBody = false
  ) {
    super(message)
    this.validationErrors = validationErrors
    this.missingBody = missingBody
  }
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
