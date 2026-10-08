import express from 'express'
import type { DatabaseSync } from 'node:sqlite'
import { anyRouter } from './apis/any/router.ts'
import { gnetzRouter } from './apis/gnetz/router.ts'
import { samlRouter } from './apis/saml/router.ts'
import { BASE_PATH } from './config.ts'
import { errorHandler } from './middleware/error-handler.ts'

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
