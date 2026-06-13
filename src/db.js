import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import * as url from 'url'

const __dirname = url.fileURLToPath(new URL('.', import.meta.url))
const DATA_DIR = path.join(__dirname, '../data')
const DB_PATH = process.env.DB_PATH ?? path.join(DATA_DIR, 'app.db')

// make sure the directory for the db file exists (e.g. /app/db in docker)
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

export const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')

createSchema()

/**
 * Create the tables if they don't exist yet. Idempotent.
 *
 * Only the dynamic entities (users, profiles) live in the database. Scalar fields
 * are real columns so they can be edited by hand with plain `UPDATE` statements;
 * nested arrays/objects are stored as JSON text.
 */
function createSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id                TEXT PRIMARY KEY,
      personal_id       TEXT,
      name1             TEXT,
      name2             TEXT,
      email             TEXT,
      owner_id          TEXT,
      owner_identifier  TEXT,
      created_on        TEXT,
      last_modified_on  TEXT,
      to_type           TEXT,
      memberships       TEXT,
      roles             TEXT,
      achievements      TEXT,
      form_values       TEXT
    );

    CREATE TABLE IF NOT EXISTS profiles (
      id                     TEXT PRIMARY KEY,
      user_id                TEXT,
      username               TEXT,
      email                  TEXT,
      privacy_chatbegruenung TEXT,
      privacy_email          TEXT,
      privacy_overall        TEXT,
      image                  TEXT,
      phone_numbers          TEXT,
      messengers             TEXT,
      social_media           TEXT,
      tags                   TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
  `)
}

// --- row <-> object mapping -------------------------------------------------
// The api contract is the original camelCase, nested json shape. These helpers
// keep that shape fully contained here, so the router dto mappers are unchanged.

function userToRow(u) {
  return {
    id: u.id,
    personal_id: u.personalId ?? null,
    name1: u.name1 ?? null,
    name2: u.name2 ?? null,
    email: u.email ?? null,
    owner_id: u.ownerId ?? null,
    owner_identifier: u.ownerIdentifier ?? null,
    created_on: u.createdOn ?? null,
    last_modified_on: u.lastModifiedOn ?? null,
    to_type: u.toType ?? null,
    memberships: JSON.stringify(u.memberships ?? []),
    roles: JSON.stringify(u.roles ?? []),
    achievements: JSON.stringify(u.achievements ?? []),
    form_values: JSON.stringify(u.formValues ?? {}),
  }
}

function rowToUser(row) {
  if (!row) return null
  return {
    id: row.id,
    personalId: row.personal_id,
    name1: row.name1,
    name2: row.name2,
    email: row.email,
    ownerId: row.owner_id,
    ownerIdentifier: row.owner_identifier,
    createdOn: row.created_on,
    lastModifiedOn: row.last_modified_on,
    toType: row.to_type,
    memberships: JSON.parse(row.memberships),
    roles: JSON.parse(row.roles),
    achievements: JSON.parse(row.achievements),
    formValues: JSON.parse(row.form_values),
  }
}

function profileToRow(p) {
  return {
    id: p.id,
    user_id: p.userId ?? null,
    username: p.username ?? null,
    email: p.email ?? null,
    privacy_chatbegruenung: p.privacy?.chatbegruenung ?? null,
    privacy_email: p.privacy?.email ?? null,
    privacy_overall: p.privacy?.overall ?? null,
    image: JSON.stringify(p.image ?? {}),
    phone_numbers: JSON.stringify(p.phoneNumbers ?? []),
    messengers: JSON.stringify(p.messengers ?? []),
    social_media: JSON.stringify(p.socialMedia ?? []),
    tags: JSON.stringify(p.tags ?? []),
  }
}

function rowToProfile(row) {
  if (!row) return null
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    email: row.email,
    privacy: {
      chatbegruenung: row.privacy_chatbegruenung,
      email: row.privacy_email,
      overall: row.privacy_overall,
    },
    image: JSON.parse(row.image),
    phoneNumbers: JSON.parse(row.phone_numbers),
    messengers: JSON.parse(row.messengers),
    socialMedia: JSON.parse(row.social_media),
    tags: JSON.parse(row.tags),
  }
}

// --- prepared statements ----------------------------------------------------

const insertUserStmt = db.prepare(`
  INSERT INTO users (
    id, personal_id, name1, name2, email, owner_id, owner_identifier,
    created_on, last_modified_on, to_type, memberships, roles, achievements, form_values
  ) VALUES (
    @id, @personal_id, @name1, @name2, @email, @owner_id, @owner_identifier,
    @created_on, @last_modified_on, @to_type, @memberships, @roles, @achievements, @form_values
  )
`)

const insertProfileStmt = db.prepare(`
  INSERT INTO profiles (
    id, user_id, username, email,
    privacy_chatbegruenung, privacy_email, privacy_overall,
    image, phone_numbers, messengers, social_media, tags
  ) VALUES (
    @id, @user_id, @username, @email,
    @privacy_chatbegruenung, @privacy_email, @privacy_overall,
    @image, @phone_numbers, @messengers, @social_media, @tags
  )
`)

// --- repositories -----------------------------------------------------------

export const users = {
  all() {
    return db.prepare('SELECT * FROM users').all().map(rowToUser)
  },
  byId(id) {
    return rowToUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id))
  },
}

export const profiles = {
  allIds() {
    // ORDER BY rowid keeps seed/insertion order (a bare SELECT id would come
    // back sorted from the primary-key index)
    return db
      .prepare('SELECT id FROM profiles ORDER BY rowid')
      .all()
      .map((r) => r.id)
  },

  /**
   * Mirrors the original filter semantics: apply profileIds then userIds
   * cumulatively; with neither filter, return all profiles.
   */
  byFilters({ profileIds, userIds } = {}) {
    let result = db.prepare('SELECT * FROM profiles').all().map(rowToProfile)
    if (profileIds?.length) {
      result = result.filter((p) => profileIds.includes(p.id))
    }
    if (userIds?.length) {
      result = result.filter((p) => userIds.includes(p.userId))
    }
    return result
  },

  byId(id) {
    return rowToProfile(
      db.prepare('SELECT * FROM profiles WHERE id = ?').get(id)
    )
  },

  /**
   * Create a profile atomically. Throws an error with code 'PROFILE_EXISTS' if
   * the user already has one. The check + insert run in a single synchronous
   * transaction, so concurrent creates can't both pass the check.
   */
  insert({ id, userId, username, email, privacy }) {
    const tx = db.transaction(() => {
      const existing = db
        .prepare('SELECT 1 FROM profiles WHERE user_id = ?')
        .get(userId)
      if (existing) {
        const err = new Error('user already has profile')
        err.code = 'PROFILE_EXISTS'
        throw err
      }
      const profile = {
        id,
        userId,
        username,
        email,
        privacy,
        image: {},
        phoneNumbers: [],
        messengers: [],
        socialMedia: [],
        tags: [],
      }
      insertProfileStmt.run(profileToRow(profile))
      return profile
    })
    return tx()
  },

  /**
   * Replace the editable fields of a profile (email, contact arrays, tags,
   * privacy). Returns the updated profile, or null if it doesn't exist.
   */
  update(id, fields) {
    db.prepare(
      `UPDATE profiles SET
         email = @email,
         phone_numbers = @phone_numbers,
         messengers = @messengers,
         social_media = @social_media,
         tags = @tags,
         privacy_chatbegruenung = @privacy_chatbegruenung,
         privacy_email = @privacy_email,
         privacy_overall = @privacy_overall
       WHERE id = @id`
    ).run({
      id,
      email: fields.email ?? null,
      phone_numbers: JSON.stringify(fields.phoneNumbers ?? []),
      messengers: JSON.stringify(fields.messengers ?? []),
      social_media: JSON.stringify(fields.socialMedia ?? []),
      tags: JSON.stringify(fields.tags ?? []),
      privacy_chatbegruenung: fields.privacy?.chatbegruenung ?? null,
      privacy_email: fields.privacy?.email ?? null,
      privacy_overall: fields.privacy?.overall ?? null,
    })
    return this.byId(id)
  },

  setImage(id, image) {
    db.prepare('UPDATE profiles SET image = ? WHERE id = ?').run(
      JSON.stringify(image ?? {}),
      id
    )
    return this.byId(id)
  },

  /**
   * Delete profiles matching any of profileIds or userIds. Returns the deleted
   * profiles as { id, userId }.
   */
  deleteByIdsOrUserIds(profileIds, userIds) {
    const rows = db.prepare('SELECT id, user_id FROM profiles').all()
    const deleted = rows.filter(
      (r) => profileIds?.includes(r.id) || userIds?.includes(r.user_id)
    )
    const tx = db.transaction(() => {
      const del = db.prepare('DELETE FROM profiles WHERE id = ?')
      for (const r of deleted) del.run(r.id)
    })
    tx()
    return deleted.map((r) => ({ id: r.id, userId: r.user_id }))
  },
}

// --- seeding ----------------------------------------------------------------

function readSeedJson(file) {
  return JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, file), { encoding: 'utf-8' })
  )
}

function readSeedUsers() {
  const dir = path.join(DATA_DIR, 'users')
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) =>
      JSON.parse(fs.readFileSync(path.join(dir, f), { encoding: 'utf-8' }))
    )
}

/**
 * Seed the database from the repo json (the authoritative definition).
 *
 * - reset: false (default) only seeds tables that are currently empty.
 * - reset: true drops and recreates the tables, then reseeds — used by
 *   `npm run db:reset` / DB_RESET=true to push updated definitions and clear
 *   any live edits.
 */
export function seed({ reset = false } = {}) {
  if (reset) {
    db.exec('DROP TABLE IF EXISTS users; DROP TABLE IF EXISTS profiles;')
    createSchema()
  }

  const seedUsers = db.transaction((rows) => {
    for (const u of rows) insertUserStmt.run(userToRow(u))
  })
  const seedProfiles = db.transaction((rows) => {
    for (const p of rows) insertProfileStmt.run(profileToRow(p))
  })

  if (db.prepare('SELECT count(*) AS c FROM users').get().c === 0) {
    const rows = readSeedUsers()
    seedUsers(rows)
    console.info(`seeded ${rows.length} users from repo json`)
  }
  if (db.prepare('SELECT count(*) AS c FROM profiles').get().c === 0) {
    const rows = readSeedJson('profiles.json')
    seedProfiles(rows)
    console.info(`seeded ${rows.length} profiles from repo json`)
  }
}
