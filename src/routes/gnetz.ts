import { Router } from 'express'
import type { DatabaseSync } from 'node:sqlite'
import { gnNotFound, gnValidationFailed, missingFields } from '../errors.ts'
import { gnetzTags } from '../fixtures.ts'
import {
  deleteProfiles,
  findProfiles,
  getProfile,
  getProfileIds,
  insertProfile,
  toGnProfile,
  updateProfile,
} from '../profiles.ts'
import type { Schemas } from '../types.ts'
import { getUser } from '../users.ts'

function toStringArray(value: unknown) {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) return null
  return value.map(String)
}

export function gnetzRouter(db: DatabaseSync) {
  const router = Router()

  router.get('/gnetz/v2/profiles/ids', (_req, res) => {
    res.json(getProfileIds(db))
  })

  router.post('/gnetz/v2/profiles/list', (req, res) => {
    const profileIds = toStringArray(req.body?.profileIds)
    const userIds = toStringArray(req.body?.userIds)
    if (profileIds === null || userIds === null) {
      res
        .status(422)
        .json(gnValidationFailed('profileIds and userIds must be arrays'))
      return
    }
    const profiles = findProfiles(db, { profileIds, userIds })
    res.json(profiles.map((profile) => toGnProfile(db, profile)))
  })

  router.post('/gnetz/v2/profiles', (req, res) => {
    const body: Partial<Schemas['GnCreateProfileDto']> = req.body ?? {}
    const missing = missingFields(body, ['id', 'userId', 'username', 'email'])
    if (missing.length) {
      res.status(422).json(gnValidationFailed('Invalid Request Body', missing))
      return
    }
    const dto = body as Schemas['GnCreateProfileDto']
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
  })

  router.post('/gnetz/v2/profiles/delete', (req, res) => {
    const profileIds = toStringArray(req.body?.profileIds)
    const userIds = toStringArray(req.body?.userIds)
    if (profileIds === null || userIds === null) {
      res
        .status(422)
        .json(gnValidationFailed('profileIds and userIds must be arrays'))
      return
    }
    res.json(deleteProfiles(db, { profileIds, userIds }))
  })

  router.put('/gnetz/v2/profiles/:profileId', (req, res) => {
    const profile = getProfile(db, req.params.profileId)
    if (!profile) {
      res
        .status(404)
        .json(
          gnNotFound(`Could not find Profile with id ${req.params.profileId}`)
        )
      return
    }
    const body: Partial<Schemas['GnUpdateProfileDto']> = req.body ?? {}
    const missing = missingFields(body, [
      'userId',
      'username',
      'email',
      'image',
      'phoneNumbers',
      'messengers',
      'socialMedia',
      'tags',
      'privacy',
    ])
    if (missing.length) {
      res.status(422).json(gnValidationFailed('Invalid Request Body', missing))
      return
    }
    updateProfile(db, profile.id, body as Schemas['GnUpdateProfileDto'])
    res.json(toGnProfile(db, getProfile(db, profile.id)!))
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
