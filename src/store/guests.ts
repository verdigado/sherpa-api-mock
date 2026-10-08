import type { DatabaseSync } from 'node:sqlite'
import { nextId, placeholders, transaction } from './db.ts'
import { getUser, type UserRow } from './users.ts'
import type { Schemas } from '../types.ts'

/** Sherpa has no guest role yet, so the mock makes one up. */
export const guestRole: Schemas['AnyRole'] = {
  id: '90000001',
  type: 'R',
  label: 'Grünes Netz - Gastzugang',
  hierarchy: 'gr',
  level: 'bv',
  maxAge: 99,
  minAge: 0,
  categories: [
    { id: '290', label: 'Grünes Netz - Technische Rollen', aliases: [] },
  ],
  aliases: [],
  tags: [],
}

/** Roles that give access without a membership. Keep in line with gruene-api's `employeeRoles`. */
const accessRoleIds = [
  // Grünes Netz - Zugang Mitarbeiterinnen o. Mitgliedschaft-LV
  '9632985',
  // Bundesverband GR - Sonstige Mitarbeiterin
  '584653',
  // Grünes Netz - Zugang Mitarbeiterinnen o. Mitgliedschaft-BV
  '8903198',
  // Grünes Netz - Zugang Mitarbeiterinnen o. Mitgliedschaft-GJ
  '8983789',
]

const GUEST_ACCOUNT_DAYS = 90

export type NewGuestAccount = {
  name1: string
  name2: string
  email: string
  ownerIdentifier: string
  ownerId: string
}

export type CreateGuestResult =
  | { outcome: 'created' | 'reused'; user: UserRow }
  | { outcome: 'has-access' | 'ambiguous' }

export function createGuestAccount(
  db: DatabaseSync,
  guest: NewGuestAccount
): CreateGuestResult {
  return transaction(db, () => {
    const matches = db
      .prepare('SELECT * FROM users WHERE lower(email) = lower(?)')
      .all(guest.email) as UserRow[]
    if (matches.length > 1) return { outcome: 'ambiguous' }

    const now = new Date()
    let outcome: 'created' | 'reused' = 'reused'
    let userId = matches[0]?.id
    if (!userId) {
      outcome = 'created'
      userId = insertUser(db, guest, now)
    } else {
      if (hasAccess(db, userId, now)) return { outcome: 'has-access' }
      if (hasActiveGuestMarker(db, userId, now)) {
        return { outcome, user: getUser(db, userId)! }
      }
      db.prepare(
        'DELETE FROM role_assignments WHERE user_id = ? AND role_id = ?'
      ).run(userId, guestRole.id)
    }

    db.prepare(
      `INSERT INTO role_assignments (id, user_id, owner_identifier, role_id,
        delegated_by_organization_identifier, expires_on, tags)
      VALUES (?, ?, ?, ?, NULL, ?, 'null')`
    ).run(
      nextId(db, 'role_assignment'),
      userId,
      guest.ownerIdentifier,
      guestRole.id,
      expiryFrom(now)
    )
    touch(db, userId, now)
    return { outcome, user: getUser(db, userId)! }
  })
}

/** Returns the updated user, or undefined if it holds no guest marker. */
export function renewGuestAccount(db: DatabaseSync, userId: string) {
  return transaction(db, () => {
    const now = new Date()
    const { changes } = db
      .prepare(
        'UPDATE role_assignments SET expires_on = ? WHERE user_id = ? AND role_id = ?'
      )
      .run(expiryFrom(now), userId, guestRole.id)
    if (!changes) return undefined
    touch(db, userId, now)
    return getUser(db, userId)
  })
}

/** Returns false if the user holds no guest marker. */
export function revokeGuestAccount(db: DatabaseSync, userId: string) {
  return transaction(db, () => {
    const { changes } = db
      .prepare('DELETE FROM role_assignments WHERE user_id = ? AND role_id = ?')
      .run(userId, guestRole.id)
    if (changes) touch(db, userId, new Date())
    return changes > 0
  })
}

/** Membership or access role; the guest marker is checked separately. */
function hasAccess(db: DatabaseSync, userId: string, now: Date) {
  const membership = db
    .prepare(
      'SELECT 1 FROM memberships WHERE user_id = ? AND (exited_at IS NULL OR exited_at > ?)'
    )
    .get(userId, now.toISOString())
  const role = db
    .prepare(
      `SELECT 1 FROM role_assignments WHERE user_id = ? AND role_id IN (${placeholders(accessRoleIds)})`
    )
    .get(userId, ...accessRoleIds)
  return Boolean(membership || role)
}

function hasActiveGuestMarker(db: DatabaseSync, userId: string, now: Date) {
  const markers = db
    .prepare(
      'SELECT expires_on FROM role_assignments WHERE user_id = ? AND role_id = ?'
    )
    .all(userId, guestRole.id) as { expires_on: string }[]
  return markers.some((marker) => Date.parse(marker.expires_on) > now.getTime())
}

function insertUser(db: DatabaseSync, guest: NewGuestAccount, now: Date) {
  const id = nextId(db, 'user')
  const formValues: Schemas['GnProfileFormValues'] = {
    emails: [guest.email],
    phoneNumbers: [],
    messengers: [],
    socialMedia: [],
  }
  db.prepare(
    `INSERT INTO users (id, personal_id, name1, name2, email, owner_id, owner_identifier,
      created_on, last_modified_on, achievements, form_values)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'null', ?)`
  ).run(
    id,
    id,
    guest.name1,
    guest.name2,
    guest.email,
    guest.ownerId,
    guest.ownerIdentifier,
    now.toISOString(),
    now.toISOString(),
    JSON.stringify(formValues)
  )
  return id
}

function expiryFrom(now: Date) {
  const expiry = new Date(now)
  expiry.setUTCDate(expiry.getUTCDate() + GUEST_ACCOUNT_DAYS)
  return expiry.toISOString()
}

function touch(db: DatabaseSync, userId: string, now: Date) {
  db.prepare('UPDATE users SET last_modified_on = ? WHERE id = ?').run(
    now.toISOString(),
    userId
  )
}
