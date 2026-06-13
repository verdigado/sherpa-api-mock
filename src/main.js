import 'dotenv/config'
import express from 'express'
import { initializeRoutes } from './router.js'
import { seed } from './db.js'

const APP_PORT = process.env.APP_PORT ?? 5000

// seed the database from the repo json (only fills empty tables; set
// DB_RESET=true to drop and reseed, clearing any live edits)
seed({ reset: process.env.DB_RESET === 'true' })

const app = express()

app.use(express.json())

initializeRoutes(app)

// prettier-ignore
app
  .use(notFoundHandler)
  .use(errorHandler)

app.listen(APP_PORT, console.info(`server running on port ${APP_PORT}`))

/**
 * middleware to return a 404 response on all unknown paths
 */
function notFoundHandler(req, res, next) {
  return res.status(404).json({
    message: 'not found',
  })
}

/**
 * middleware to return uncaught exceptions as json response
 */
function errorHandler(err, req, res, next) {
  console.debug(`request error handler: ${err?.message}`)
  return res.status(500).json({
    code: 500,
    error: 'Internal Server Error',
    message: typeof err === 'string' ? err : (err?.message ?? 'no message'),
  })
}
