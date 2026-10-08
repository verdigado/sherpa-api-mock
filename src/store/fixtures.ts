import { readdirSync, readFileSync } from 'node:fs'
import type { NewProfile } from './profiles.ts'
import type { Schemas } from '../types.ts'
import type { RoleTag } from './users.ts'

const dir = new URL('../../fixtures/', import.meta.url)

function readJson(path: string) {
  return JSON.parse(readFileSync(new URL(path, dir), 'utf-8'))
}

export type UserFixture = Omit<
  Schemas['SamlUser'],
  'toType' | 'memberships' | 'roles'
> & {
  personalId: string
  memberships: (Omit<Schemas['SamlUserMembership'], 'toType'> & {
    joinedAt: string
    exitedAt: string | null
  })[]
  roles: (Omit<Schemas['SamlUserRole'], 'toType' | 'tags'> & {
    tags: RoleTag[] | null
  })[]
  achievements: string[] | null
  formValues: Schemas['GnProfileFormValues']
  profile?: Omit<NewProfile, 'userId'>
}

export const divisions: Schemas['AnyDivision'][] = readJson('divisions.json')
export const roles: Schemas['AnyRole'][] = readJson('roles.json')
export const gnetzTags: Schemas['GnTag'][] = readJson('gnetz-tags.json')

export function readUserFixtures(): UserFixture[] {
  return readdirSync(new URL('users/', dir))
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => readJson(`users/${file}`))
}
