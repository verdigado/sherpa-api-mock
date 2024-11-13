import { anyV1Router } from './routers/any-v1-router.js'

const SHERPA_API_BASE_PATH = '/sherpa/ws/m2m'

export function initializeRoutes(app) {
  // return simple message on root url
  app.get('/', (req, res) => {
    res.json({
      message: 'sherpa-api-mock',
    })
  })

  // any api router
  app.use(`${SHERPA_API_BASE_PATH}/any/v1`, anyV1Router)
}