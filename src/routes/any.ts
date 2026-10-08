import { Router } from 'express'
import { serverInfo } from '../errors.ts'
import { divisions, roles } from '../fixtures.ts'
import type { Schemas } from '../types.ts'

export function anyRouter() {
  const router = Router()

  router.get('/any/v1/divisions', (_req, res) => {
    res.json(divisions)
  })

  router.get('/any/v1/roles', (_req, res) => {
    res.json(roles)
  })

  router.get('/any/v1/alive', (_req, res) => {
    const alive: Schemas['ServerAliveDto'] = {
      toType: 'ServerAliveTO',
      alive: true,
      serverInfo: serverInfo(),
    }
    res.json(alive)
  })

  return router
}
