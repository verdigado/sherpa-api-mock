import type { DatabaseSync, SQLInputValue } from 'node:sqlite'
import { nextId, placeholders, transaction } from './db.ts'
import { roles } from './fixtures.ts'
import type { Schemas } from '../types.ts'
import { getMemberships, getRoleAssignments, getUser } from './users.ts'

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

export type NewProfile = Pick<
  Schemas['GnCreateProfileDto'],
  'id' | 'userId' | 'username' | 'email' | 'loginEmail' | 'privacy'
> &
  Partial<
    Pick<
      Schemas['GnProfile'],
      'phoneNumbers' | 'messengers' | 'socialMedia' | 'tags'
    >
  > & { image?: Partial<Schemas['GnProfileImage']> }

export type ProfileFilter = { profileIds?: string[]; userIds?: string[] }

const EMPTY_PRIVACY = { overall: null, email: null, chatbegruenung: null }

const rolesById = new Map(roles.map((role) => [role.id, role]))

const roleTypes: Partial<
  Record<Schemas['AnyRole']['type'], Schemas['GnRoleType']>
> = {
  A: 'office',
  M: 'mandate',
}

export function getProfile(db: DatabaseSync, id: string) {
  return db.prepare('SELECT * FROM profiles WHERE id = ?').get(id) as
    ProfileRow | undefined
}

export function getProfileIds(db: DatabaseSync) {
  const rows = db.prepare('SELECT id FROM profiles ORDER BY id').all() as {
    id: string
  }[]
  return rows.map((row) => row.id)
}

/** Profiles matching all given filters, or all profiles without any. */
export function findProfiles(db: DatabaseSync, filter: ProfileFilter) {
  const where: string[] = []
  const params: SQLInputValue[] = []
  if (filter.profileIds?.length) {
    where.push(`id IN (${placeholders(filter.profileIds)})`)
    params.push(...filter.profileIds)
  }
  if (filter.userIds?.length) {
    where.push(`user_id IN (${placeholders(filter.userIds)})`)
    params.push(...filter.userIds)
  }
  return db
    .prepare(
      `SELECT * FROM profiles ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY id`
    )
    .all(...params) as ProfileRow[]
}

export function insertProfile(db: DatabaseSync, profile: NewProfile) {
  db.prepare(
    `INSERT INTO profiles (id, user_id, username, email, login_email, privacy, image,
      phone_numbers, messengers, social_media, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    profile.id,
    profile.userId,
    profile.username,
    profile.email,
    profile.loginEmail ?? null,
    JSON.stringify(profile.privacy ?? EMPTY_PRIVACY),
    JSON.stringify({ thumbnail: null, large: null, ...profile.image }),
    JSON.stringify(profile.phoneNumbers ?? []),
    JSON.stringify(profile.messengers ?? []),
    JSON.stringify(profile.socialMedia ?? []),
    JSON.stringify(profile.tags ?? [])
  )
}

/** Replaces a profile's editable fields. Items without an id get a new one, as in Sherpa. */
export function updateProfile(
  db: DatabaseSync,
  id: string,
  dto: Schemas['GnUpdateProfileDto']
) {
  transaction(db, () => {
    const withId = <T extends { id?: string }>(item: T) => ({
      ...item,
      id: item.id ?? nextId(db, 'profile_item'),
    })
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
      id
    )
  })
}

/** Deletes the profiles matching any of the given ids. */
export function deleteProfiles(
  db: DatabaseSync,
  { profileIds = [], userIds = [] }: ProfileFilter
): Schemas['GnDeletedProfileDto'][] {
  const deleted = db
    .prepare(
      `DELETE FROM profiles
      WHERE id IN (${placeholders(profileIds)}) OR user_id IN (${placeholders(userIds)})
      RETURNING id, user_id`
    )
    .all(...profileIds, ...userIds) as { id: string; user_id: string }[]
  return deleted.map(({ id, user_id }) => ({ id, userId: user_id }))
}

export function toGnProfile(
  db: DatabaseSync,
  profile: ProfileRow
): Schemas['GnProfile'] {
  const user = getUser(db, profile.user_id)
  if (!user) {
    throw new Error(
      `no user ${profile.user_id} exists for profile ${profile.id}`
    )
  }

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
