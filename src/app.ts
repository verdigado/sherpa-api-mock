import express, { type ErrorRequestHandler } from 'express'
import type { DatabaseSync } from 'node:sqlite'
import { anyRouter } from './routes/any.ts'
import { gnetzRouter } from './routes/gnetz.ts'
import { samlRouter } from './routes/saml.ts'

export const BASE_PATH = '/sherpa/ws/m2m'

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const status = err?.status ?? 500
  if (status >= 500) console.error(err)
  res.status(status).json({ message: err?.message ?? 'no message' })
}

export function createApp(db: DatabaseSync) {
  const app = express()
  app.use(express.json())

  app.get('/', (_req, res) => {
    res.json({ message: 'sherpa-api-mock' })
  })

  app.use(BASE_PATH, anyRouter(), samlRouter(db), gnetzRouter(db))

  app.use(BASE_PATH, (req, res) => {
    res
      .status(501)
      .json({
        message: `${req.method} ${req.path} is not implemented by the mock`,
      })
  })
  app.use((_req, res) => {
    res.status(404).json({ message: 'not found' })
  })
  app.use(errorHandler)

  return app
}
