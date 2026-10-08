import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

/**
 * Schema changes, applied in order. The database stores how many it has run,
 * so each one runs once and existing data survives. Never edit one that has
 * shipped; add a new one instead.
 */
const MIGRATIONS = [
  `
  CREATE TABLE users (
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
  CREATE TABLE memberships (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users ON DELETE CASCADE,
    owner_identifier TEXT NOT NULL,
    member_of_structure_identifier TEXT NOT NULL,
    joined_at TEXT NOT NULL,
    exited_at TEXT
  );
  CREATE TABLE role_assignments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users ON DELETE CASCADE,
    owner_identifier TEXT NOT NULL,
    role_id TEXT NOT NULL,
    delegated_by_organization_identifier TEXT,
    tags TEXT
  );
  CREATE TABLE profiles (
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
  CREATE TABLE sequences (
    name TEXT PRIMARY KEY,
    value INTEGER NOT NULL
  );
  -- ids for phone numbers, messengers, social media and images added through the API
  INSERT INTO sequences (name, value) VALUES ('profile_item', 1000000);
  `,
]

export function openDatabase(path: string): DatabaseSync {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const db = new DatabaseSync(path)
  db.exec('PRAGMA foreign_keys = ON')
  migrate(db)
  return db
}

/** Drops all data and recreates the tables. */
export function clearDatabase(db: DatabaseSync) {
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
    )
    .all() as { name: string }[]
  db.exec('PRAGMA foreign_keys = OFF')
  try {
    transaction(db, () => {
      for (const { name } of tables) db.exec(`DROP TABLE ${name}`)
      db.exec('PRAGMA user_version = 0')
    })
  } finally {
    db.exec('PRAGMA foreign_keys = ON')
  }
  migrate(db)
}

function migrate(db: DatabaseSync) {
  const { user_version: version } = db.prepare('PRAGMA user_version').get() as {
    user_version: number
  }
  if (version > MIGRATIONS.length) {
    throw new Error(
      `database is at version ${version}, newer than this mock (${MIGRATIONS.length})`
    )
  }
  transaction(db, () => {
    for (const migration of MIGRATIONS.slice(version)) db.exec(migration)
    db.exec(`PRAGMA user_version = ${MIGRATIONS.length}`)
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

export const placeholders = (values: unknown[]) =>
  values.map(() => '?').join(', ')
