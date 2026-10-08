import { readdirSync, readFileSync } from 'node:fs'
import type { NewProfile } from './profiles.ts'
import type { Schemas } from '../types.ts'

const dir = new URL('../../fixtures/', import.meta.url)

function readJson(path: string) {
  return JSON.parse(readFileSync(new URL(path, dir), 'utf-8'))
}

export type UserFixture = Omit<Schemas['SamlUser'], 'memberships'> & {
  personalId: string
  memberships: (Schemas['SamlUserMembership'] & {
    joinedAt: string
    exitedAt: string | null
  })[]
  achievements: string[] | null
  formValues: Schemas['GnProfileFormValues']
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

export function readProfileFixtures(): NewProfile[] {
  return readJson('profiles.json')
}
