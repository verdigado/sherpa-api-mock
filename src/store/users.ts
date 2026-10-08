import type { DatabaseSync, SQLInputValue } from 'node:sqlite'
import { placeholders } from './db.ts'
import type { Schemas } from '../types.ts'

export type UserRow = {
  id: string
  personal_id: string
  name1: string
  name2: string
  email: string | null
  owner_id: string
  owner_identifier: string
  created_on: string
  last_modified_on: string
  achievements: string
  form_values: string
}

export type MembershipRow = {
  id: string
  user_id: string
  owner_identifier: string
  member_of_structure_identifier: string
  joined_at: string
  exited_at: string | null
}

export type RoleAssignmentRow = {
  id: string
  user_id: string
  owner_identifier: string
  role_id: string
  delegated_by_organization_identifier: string | null
  tags: string
}

export type UserFilter = {
  ids?: string[]
  after?: string
  modifiedAfter?: string
  modifiedBefore?: string
  createdFrom?: string
  createdTo?: string
  limit?: number
}

export function findUsers(db: DatabaseSync, filter: UserFilter): UserRow[] {
  const where: string[] = []
  const params: SQLInputValue[] = []
  if (filter.ids) {
    where.push(`id IN (${placeholders(filter.ids)})`)
    params.push(...filter.ids)
  }
  if (filter.after !== undefined) {
    where.push('CAST(id AS INTEGER) > CAST(? AS INTEGER)')
    params.push(filter.after)
  }
  if (filter.modifiedAfter) {
    where.push('last_modified_on > ?')
    params.push(filter.modifiedAfter)
  }
  if (filter.modifiedBefore) {
    where.push('last_modified_on < ?')
    params.push(filter.modifiedBefore)
  }
  if (filter.createdFrom) {
    where.push('created_on >= ?')
    params.push(filter.createdFrom)
  }
  if (filter.createdTo) {
    where.push('created_on <= ?')
    params.push(filter.createdTo)
  }
  const sql = `
    SELECT * FROM users
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY CAST(id AS INTEGER)
    ${filter.limit ? `LIMIT ${Number(filter.limit)}` : ''}
  `
  return db.prepare(sql).all(...params) as UserRow[]
}

export function getUser(db: DatabaseSync, id: string) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as
    UserRow | undefined
}

export function getMemberships(db: DatabaseSync, userId: string) {
  return db
    .prepare(
      'SELECT * FROM memberships WHERE user_id = ? ORDER BY CAST(id AS INTEGER)'
    )
    .all(userId) as MembershipRow[]
}

export function getRoleAssignments(db: DatabaseSync, userId: string) {
  return db
    .prepare(
      'SELECT * FROM role_assignments WHERE user_id = ? ORDER BY CAST(id AS INTEGER)'
    )
    .all(userId) as RoleAssignmentRow[]
}

export function toSamlUser(
  db: DatabaseSync,
  user: UserRow
): Schemas['SamlUser'] {
  return {
    toType: 'SamlSynchronizationPartyTO',
    id: user.id,
    ownerIdentifier: user.owner_identifier,
    ownerId: user.owner_id,
    createdOn: user.created_on,
    lastModifiedOn: user.last_modified_on,
    name1: user.name1,
    name2: user.name2,
    email: user.email,
    roles: getRoleAssignments(db, user.id).map((assignment) => ({
      toType: 'SamlSynchronizationRoleAssignmentTO',
      id: assignment.id,
      ownerIdentifier: assignment.owner_identifier,
      roleId: assignment.role_id,
      delegatedByOrganizationIdentifier:
        assignment.delegated_by_organization_identifier,
      tags: JSON.parse(assignment.tags),
    })),
    memberships: getMemberships(db, user.id).map((membership) => ({
      toType: 'SamlSynchronizationMembershipTO',
      id: membership.id,
      ownerIdentifier: membership.owner_identifier,
      memberOfStructureIdentifier: membership.member_of_structure_identifier,
    })),
  }
}
