import { Router } from 'express'
import type { DatabaseSync, SQLInputValue } from 'node:sqlite'
import { nextId, transaction, EMPTY_PRIVACY } from '../db.ts'
import { gnNotFound, gnValidationFailed, missingFields } from '../errors.ts'
import { gnetzTags, roles } from '../fixtures.ts'
import type { Schemas } from '../types.ts'
import { getMemberships, getRoleAssignments, getUser } from '../users.ts'

type ProfileRow = {
  id: string
  user_id: string
  username: string
  email: string
  login_email: string | null
  privacy: string
  image: string
  phone_numbers: string
  messengers: string
  social_media: string
  tags: string
}

const rolesById = new Map(roles.map((role) => [role.id, role]))

const roleTypes: Partial<
  Record<Schemas['AnyRole']['type'], Schemas['GnRoleType']>
> = {
  A: 'office',
  M: 'mandate',
}

const placeholders = (values: unknown[]) => values.map(() => '?').join(', ')

function toStringArray(value: unknown) {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) return null
  return value.map(String)
}

function getProfile(db: DatabaseSync, id: string) {
  return db.prepare('SELECT * FROM profiles WHERE id = ?').get(id) as
    ProfileRow | undefined
}

function toGnProfile(
  db: DatabaseSync,
  profile: ProfileRow
): Schemas['GnProfile'] {
  const user = getUser(db, profile.user_id)
  if (!user)
    throw new Error(
      `no user ${profile.user_id} exists for profile ${profile.id}`
    )

  const gnRoles: Schemas['GnRole'][] = []
  for (const assignment of getRoleAssignments(db, user.id)) {
    const role = rolesById.get(assignment.role_id)
    if (!role) {
      console.error(`missing role ${assignment.role_id} for mapping`)
      continue
    }
    gnRoles.push({
      id: assignment.id,
      roleId: Number(role.id),
      type: roleTypes[role.type] ?? 'role',
      name: role.label,
      alias: role.aliases.at(0)?.label ?? 'no alias',
    })
  }

  return {
    id: profile.id,
    userId: user.id,
    personalId: user.personal_id,
    username: profile.username,
    firstName: user.name1,
    lastName: user.name2,
    image: JSON.parse(profile.image),
    email: profile.email,
    loginEmail: profile.login_email,
    phoneNumbers: JSON.parse(profile.phone_numbers),
    messengers: JSON.parse(profile.messengers),
    socialMedia: JSON.parse(profile.social_media),
    tags: JSON.parse(profile.tags),
    memberships: getMemberships(db, user.id).map((membership) => ({
      divisionKey: membership.member_of_structure_identifier,
      joinedAt: membership.joined_at,
      exitedAt: membership.exited_at,
    })),
    roles: gnRoles,
    achievements: JSON.parse(user.achievements),
    privacy: JSON.parse(profile.privacy),
  }
}

export function gnetzRouter(db: DatabaseSync) {
  const router = Router()

  const withId = <T extends { id?: string }>(item: T) => ({
    ...item,
    id: item.id ?? nextId(db, 'profile_item'),
  })

  router.get('/gnetz/v2/profiles/ids', (_req, res) => {
    const rows = db.prepare('SELECT id FROM profiles ORDER BY id').all() as {
      id: string
    }[]
    res.json(rows.map((row) => row.id))
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
    const where: string[] = []
    const params: SQLInputValue[] = []
    if (profileIds?.length) {
      where.push(`id IN (${placeholders(profileIds)})`)
      params.push(...profileIds)
    }
    if (userIds?.length) {
      where.push(`user_id IN (${placeholders(userIds)})`)
      params.push(...userIds)
    }
    const rows = db
      .prepare(
        `SELECT * FROM profiles ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY id`
      )
      .all(...params) as ProfileRow[]
    res.json(rows.map((row) => toGnProfile(db, row)))
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
    const existing = db
      .prepare('SELECT 1 FROM profiles WHERE id = ? OR user_id = ?')
      .get(dto.id, dto.userId)
    if (existing) {
      res
        .status(422)
        .json(gnValidationFailed('profile id or user already has a profile'))
      return
    }

    db.prepare(
      `INSERT INTO profiles (id, user_id, username, email, login_email, privacy, image,
        phone_numbers, messengers, social_media, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, '[]', '[]', '[]', '[]')`
    ).run(
      dto.id,
      dto.userId,
      dto.username,
      dto.email,
      dto.loginEmail ?? null,
      JSON.stringify(dto.privacy ?? EMPTY_PRIVACY),
      JSON.stringify({ thumbnail: null, large: null })
    )
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
    const deleted = db
      .prepare(
        `DELETE FROM profiles
        WHERE id IN (${placeholders(profileIds ?? [])})
          OR user_id IN (${placeholders(userIds ?? [])})
        RETURNING id, user_id`
      )
      .all(...(profileIds ?? []), ...(userIds ?? [])) as {
      id: string
      user_id: string
    }[]
    const response: Schemas['GnDeletedProfileDto'][] = deleted.map(
      ({ id, user_id }) => ({
        id,
        userId: user_id,
      })
    )
    res.json(response)
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
    const dto = body as Schemas['GnUpdateProfileDto']

    transaction(db, () => {
      const image = {
        thumbnail: dto.image.thumbnail && withId(dto.image.thumbnail),
        large: dto.image.large && withId(dto.image.large),
      }
      db.prepare(
        `UPDATE profiles SET username = ?, email = ?, login_email = ?, privacy = ?, image = ?,
          phone_numbers = ?, messengers = ?, social_media = ?, tags = ?
        WHERE id = ?`
      ).run(
        dto.username,
        dto.email,
        dto.loginEmail ?? null,
        JSON.stringify(dto.privacy),
        JSON.stringify(image),
        JSON.stringify(dto.phoneNumbers.map(withId)),
        JSON.stringify(dto.messengers.map(withId)),
        JSON.stringify(dto.socialMedia.map(withId)),
        JSON.stringify(dto.tags),
        profile.id
      )
    })
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
