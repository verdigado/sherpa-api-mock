import { Router } from 'express'
import { serverInfo } from '../server-info.ts'
import { divisions, roles } from '../../store/fixtures.ts'
import { guestRole } from '../../store/guests.ts'
import type { Schemas } from '../../types.ts'

export function anyRouter() {
  const router = Router()

  router.get('/any/v1/divisions', (_req, res) => {
    res.json(divisions)
  })

  router.get('/any/v1/roles', (_req, res) => {
    res.json([...roles, guestRole])
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
