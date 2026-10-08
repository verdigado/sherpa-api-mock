import express, { type ErrorRequestHandler } from 'express'
import type { DatabaseSync } from 'node:sqlite'
import {
  gnServerError,
  gnValidationFailed,
  InvalidRequest,
  samlError,
} from './errors.ts'
import { anyRouter } from './routes/any.ts'
import { gnetzRouter } from './routes/gnetz.ts'
import { samlRouter } from './routes/saml.ts'

export const BASE_PATH = '/sherpa/ws/m2m'

/** Answers errors in the error format of the API the request went to. */
const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
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

export function createApp(db: DatabaseSync) {
  const app = express()
  app.use(express.json())

  app.get('/', (_req, res) => {
    res.json({ message: 'sherpa-api-mock' })
  })

  app.use(BASE_PATH, anyRouter(), samlRouter(db), gnetzRouter(db))

  app.use(BASE_PATH, (req, res) => {
    res.status(501).json({
      message: `${req.method} ${req.path} is not implemented by the mock`,
    })
  })
  app.use((_req, res) => {
    res.status(404).json({ message: 'not found' })
  })
  app.use(errorHandler)

  return app
}
