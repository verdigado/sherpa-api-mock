import { describe, expect, it } from 'vitest'
import { setup } from '../setup.ts'
import { expectMatchesSpec } from '../spec.ts'
import { guestRole } from '../../src/store/guests.ts'

const COLLECTION = '/saml/v1/guest-accounts'
const ITEM = '/saml/v1/guest-accounts/{userId}'
const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000

type Role = { roleId: string; ownerIdentifier: string; expiresOn: string }

const guestMarker = (user: { roles: Role[] }) =>
  user.roles.find((role) => role.roleId === guestRole.id)

function expectExpiryIn90Days(role: Role | undefined) {
  expect(role).toBeDefined()
  const remaining = Date.parse(role!.expiresOn) - Date.now()
  expect(Math.abs(remaining - NINETY_DAYS)).toBeLessThan(60_000)
}

const invitation = (email: string) => ({
  name1: 'Jane',
  name2: 'Doe',
  email,
  birthDate: '1990-04-17',
  ownerIdentifier: '10903700',
})

describe('guest accounts', () => {
  describe(`POST ${COLLECTION}`, () => {
    it('creates a marked record when none matches', async () => {
      const api = setup()
      const res = await api.post(COLLECTION, invitation('jane.doe@example.com'))
      expectMatchesSpec('post', COLLECTION, res)
      expect(res.status).toBe(201)
      expect(res.body.id).toBe('200001')
      expect(res.body.memberships).toEqual([])
      expect(guestMarker(res.body)?.ownerIdentifier).toBe('10903700')
      expectExpiryIn90Days(guestMarker(res.body))

      const read = await api.get(`/saml/v1/users?include[]=${res.body.id}`)
      expect(read.body.data).toEqual([res.body])
    })

    it('marks a record without access, matching the email in any case', async () => {
      const api = setup()
      const res = await api.post(
        COLLECTION,
        invitation('Lukas.Kaiser@example.com')
      )
      expectMatchesSpec('post', COLLECTION, res)
      expect(res.status).toBe(200)
      expect(res.body.id).toBe('100022')
      expect(res.body.name1).toBe('Lukas')
      expectExpiryIn90Days(guestMarker(res.body))
      expect(Date.parse(res.body.lastModifiedOn)).toBeGreaterThan(
        Date.parse('2025-06-01T12:00:00+0200')
      )
    })

    it.each([
      ['a member', 'john.doe@example.com'],
      ['the holder of an access role', 'luz.may@example.com'],
      ['an active guest', 'gabi.bauer@example.com'],
    ])('rejects %s', async (_, email) => {
      const api = setup()
      const res = await api.post(COLLECTION, invitation(email))
      expectMatchesSpec('post', COLLECTION, res)
      expect(res.status).toBe(409)
    })

    it('rejects an email shared by several records', async () => {
      const api = setup()
      const res = await api.post(COLLECTION, invitation('kim.wolf@example.com'))
      expectMatchesSpec('post', COLLECTION, res)
      expect(res.status).toBe(422)
    })

    it('rejects an invalid body', async () => {
      const api = setup()
      const res = await api.post(COLLECTION, { name1: 'Jane', name2: 'Doe' })
      expectMatchesSpec('post', COLLECTION, res)
      expect(res.status).toBe(400)
    })

    it('rejects an unknown division', async () => {
      const api = setup()
      const res = await api.post(COLLECTION, {
        ...invitation('jane.doe@example.com'),
        ownerIdentifier: '99999999',
      })
      expectMatchesSpec('post', COLLECTION, res)
      expect(res.status).toBe(400)
    })
  })

  describe(`PATCH ${ITEM}`, () => {
    it('moves the expiry to 90 days from now', async () => {
      const api = setup()
      const res = await api.patch(`${COLLECTION}/100021`)
      expectMatchesSpec('patch', ITEM, res)
      expect(res.status).toBe(200)
      expectExpiryIn90Days(guestMarker(res.body))
    })

    it('answers 404 for a record without a guest marker', async () => {
      const api = setup()
      const res = await api.patch(`${COLLECTION}/100001`)
      expectMatchesSpec('patch', ITEM, res)
      expect(res.status).toBe(404)
    })
  })

  describe(`DELETE ${ITEM}`, () => {
    it('removes the guest marker', async () => {
      const api = setup()
      const res = await api.delete(`${COLLECTION}/100021`)
      expectMatchesSpec('delete', ITEM, res)
      expect(res.status).toBe(204)

      const read = await api.get('/saml/v1/users?include[]=100021')
      expect(guestMarker(read.body.data[0])).toBeUndefined()
    })

    it('answers 404 for a record without a guest marker', async () => {
      const api = setup()
      const res = await api.delete(`${COLLECTION}/100001`)
      expectMatchesSpec('delete', ITEM, res)
      expect(res.status).toBe(404)
    })
  })
})
