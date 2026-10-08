import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { readProfileFixtures, readUserFixtures } from './fixtures.ts'

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    personal_id TEXT NOT NULL,
    name1 TEXT NOT NULL,
    name2 TEXT NOT NULL,
    email TEXT,
    owner_id TEXT NOT NULL,
    owner_identifier TEXT NOT NULL,
    created_on TEXT NOT NULL,
    last_modified_on TEXT NOT NULL,
    achievements TEXT,
    form_values TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS memberships (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users ON DELETE CASCADE,
    owner_identifier TEXT NOT NULL,
    member_of_structure_identifier TEXT NOT NULL,
    joined_at TEXT NOT NULL,
    exited_at TEXT
  );
  CREATE TABLE IF NOT EXISTS role_assignments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users ON DELETE CASCADE,
    owner_identifier TEXT NOT NULL,
    role_id TEXT NOT NULL,
    delegated_by_organization_identifier TEXT,
    tags TEXT
  );
  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES users ON DELETE CASCADE,
    username TEXT NOT NULL,
    email TEXT NOT NULL,
    login_email TEXT,
    privacy TEXT NOT NULL,
    image TEXT NOT NULL,
    phone_numbers TEXT NOT NULL,
    messengers TEXT NOT NULL,
    social_media TEXT NOT NULL,
    tags TEXT
  );
  CREATE TABLE IF NOT EXISTS sequences (
    name TEXT PRIMARY KEY,
    value INTEGER NOT NULL
  );
`

const TABLES = [
  'profiles',
  'role_assignments',
  'memberships',
  'users',
  'sequences',
]

export const EMPTY_PRIVACY = {
  overall: null,
  email: null,
  chatbegruenung: null,
}

export function openDatabase(path: string): DatabaseSync {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const db = new DatabaseSync(path)
  db.exec('PRAGMA foreign_keys = ON')
  db.exec(SCHEMA)
  if (!db.prepare('SELECT 1 FROM users LIMIT 1').get()) {
    transaction(db, () => seed(db))
  }
  return db
}

export function resetDatabase(db: DatabaseSync) {
  transaction(db, () => {
    for (const table of TABLES) db.exec(`DROP TABLE IF EXISTS ${table}`)
    db.exec(SCHEMA)
    seed(db)
  })
}

export function transaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export function nextId(db: DatabaseSync, sequence: string): string {
  const row = db
    .prepare(
      'UPDATE sequences SET value = value + 1 WHERE name = ? RETURNING value'
    )
    .get(sequence) as { value: number } | undefined
  if (!row) throw new Error(`unknown sequence ${sequence}`)
  return String(row.value)
}

const toIso = (date: string) => new Date(date).toISOString()
const toIsoOrNull = (date: string | null) => (date ? toIso(date) : null)
const json = (value: unknown) => JSON.stringify(value ?? null)

function seed(db: DatabaseSync) {
  const insertUser = db.prepare(`
    INSERT INTO users (id, personal_id, name1, name2, email, owner_id, owner_identifier,
      created_on, last_modified_on, achievements, form_values)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertMembership = db.prepare(`
    INSERT INTO memberships (id, user_id, owner_identifier, member_of_structure_identifier,
      joined_at, exited_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  const insertRoleAssignment = db.prepare(`
    INSERT INTO role_assignments (id, user_id, owner_identifier, role_id,
      delegated_by_organization_identifier, tags)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  const insertProfile = db.prepare(`
    INSERT INTO profiles (id, user_id, username, email, login_email, privacy, image,
      phone_numbers, messengers, social_media, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  for (const user of readUserFixtures()) {
    insertUser.run(
      user.id,
      user.personalId,
      user.name1,
      user.name2,
      user.email,
      user.ownerId,
      user.ownerIdentifier,
      toIso(user.createdOn),
      toIso(user.lastModifiedOn),
      json(user.achievements),
      json(user.formValues)
    )
    for (const membership of user.memberships) {
      insertMembership.run(
        membership.id,
        user.id,
        membership.ownerIdentifier,
        membership.memberOfStructureIdentifier,
        toIso(membership.joinedAt),
        toIsoOrNull(membership.exitedAt)
      )
    }
    for (const assignment of user.roles) {
      insertRoleAssignment.run(
        assignment.id,
        user.id,
        assignment.ownerIdentifier,
        assignment.roleId,
        assignment.delegatedByOrganizationIdentifier,
        json(assignment.tags)
      )
    }
  }

  for (const profile of readProfileFixtures()) {
    insertProfile.run(
      profile.id,
      profile.userId,
      profile.username,
      profile.email,
      profile.loginEmail ?? null,
      json(profile.privacy ?? EMPTY_PRIVACY),
      json({ thumbnail: null, large: null, ...profile.image }),
      json(profile.phoneNumbers),
      json(profile.messengers),
      json(profile.socialMedia),
      json(profile.tags)
    )
  }

  // Ids for phone numbers, messengers, social media and images added through the API
  db.prepare(
    "INSERT INTO sequences (name, value) VALUES ('profile_item', 1000000)"
  ).run()
}
