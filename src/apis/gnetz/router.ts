import { Router } from 'express'
import type { DatabaseSync } from 'node:sqlite'
import { gnNotFound, gnValidationFailed } from './errors.ts'
import { gnetzTags } from '../../store/fixtures.ts'
import {
  deleteProfiles,
  findProfiles,
  getProfile,
  getProfileIds,
  insertProfile,
  toGnProfile,
  updateProfile,
} from '../../store/profiles.ts'
import {
  assertValidBody,
  validateBody,
} from '../../middleware/validate-body.ts'
import type { Schemas } from '../../types.ts'
import { getUser } from '../../store/users.ts'

export function gnetzRouter(db: DatabaseSync) {
  const router = Router()

  router.get('/gnetz/v2/profiles/ids', (_req, res) => {
    res.json(getProfileIds(db))
  })

  router.post(
    '/gnetz/v2/profiles/list',
    validateBody('post', '/gnetz/v2/profiles/list'),
    (req, res) => {
      const profiles = findProfiles(db, req.body)
      res.json(profiles.map((profile) => toGnProfile(db, profile)))
    }
  )

  router.post(
    '/gnetz/v2/profiles',
    validateBody('post', '/gnetz/v2/profiles'),
    (req, res) => {
      const dto: Schemas['GnCreateProfileDto'] = req.body
      if (!getUser(db, dto.userId)) {
        res
          .status(422)
          .json(gnValidationFailed(`user ${dto.userId} does not exist`))
        return
      }
      if (
        getProfile(db, dto.id) ||
        findProfiles(db, { userIds: [dto.userId] }).length
      ) {
        res
          .status(422)
          .json(gnValidationFailed('profile id or user already has a profile'))
        return
      }
      insertProfile(db, dto)
      res.json(toGnProfile(db, getProfile(db, dto.id)!))
    }
  )

  router.post(
    '/gnetz/v2/profiles/delete',
    validateBody('post', '/gnetz/v2/profiles/delete'),
    (req, res) => {
      res.json(deleteProfiles(db, req.body))
    }
  )

  router.put('/gnetz/v2/profiles/:profileId', (req, res) => {
    const { profileId } = req.params
    if (!getProfile(db, profileId)) {
      res
        .status(404)
        .json(gnNotFound(`Could not find Profile with id ${profileId}`))
      return
    }
    assertValidBody('put', '/gnetz/v2/profiles/{profileId}', req.body)
    updateProfile(db, profileId, req.body)
    res.json(toGnProfile(db, getProfile(db, profileId)!))
  })

  router.get('/gnetz/v2/profiles/:profileId/form-values', (req, res) => {
    const profile = getProfile(db, req.params.profileId)
    if (!profile) {
      res
        .status(404)
        .json(
          gnNotFound(`Could not find Profile with id ${req.params.profileId}`)
        )
      return
    }
    const user = getUser(db, profile.user_id)!
    res.json(JSON.parse(user.form_values))
  })

  router.get('/gnetz/v2/tags', (_req, res) => {
    res.json(gnetzTags)
  })

  return router
}
