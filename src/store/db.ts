import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { MIGRATIONS } from './migrations.ts'

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
