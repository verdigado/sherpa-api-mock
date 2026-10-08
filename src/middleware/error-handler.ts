import type { ErrorRequestHandler } from 'express'
import { gnServerError, gnValidationFailed } from '../apis/gnetz/errors.ts'
import { samlError } from '../apis/saml/errors.ts'
import { BASE_PATH } from '../config.ts'
import { InvalidRequest } from './validate-body.ts'

/** Answers errors in the error format of the API the request went to. */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const invalid =
    err instanceof InvalidRequest
      ? err
      : err?.type === 'entity.parse.failed'
        ? new InvalidRequest('malformed JSON body')
        : undefined
  if (!invalid) console.error(err)
  const message = invalid?.message ?? 'internal server error'

  if (req.path.startsWith(`${BASE_PATH}/gnetz/`)) {
    if (invalid) {
      res
        .status(422)
        .json(gnValidationFailed(message, invalid.validationErrors))
    } else {
      res.status(500).json(gnServerError(message))
    }
  } else if (req.path.startsWith(`${BASE_PATH}/saml/`)) {
    // Sherpa answers a missing body with 415 and any other bad request with 500
    const status = invalid?.missingBody ? 415 : 500
    res.status(status).json(samlError(status, message))
  } else {
    res.status(invalid ? 400 : 500).json({ message })
  }
}
