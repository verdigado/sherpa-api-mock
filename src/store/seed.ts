import type { DatabaseSync } from 'node:sqlite'
import { clearDatabase, transaction } from './db.ts'
import { readProfileFixtures, readUserFixtures } from './fixtures.ts'
import { insertProfile } from './profiles.ts'

const toIso = (date: string) => new Date(date).toISOString()
const toIsoOrNull = (date: string | null) => (date ? toIso(date) : null)
const json = (value: unknown) => JSON.stringify(value ?? null)

export function seedIfEmpty(db: DatabaseSync) {
  if (!db.prepare('SELECT 1 FROM users LIMIT 1').get()) {
    transaction(db, () => seed(db))
  }
  return db
}

export function resetDatabase(db: DatabaseSync) {
  clearDatabase(db)
  transaction(db, () => seed(db))
}

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

  for (const profile of readProfileFixtures()) insertProfile(db, profile)
}
