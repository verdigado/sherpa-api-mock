import { describe, expect, it } from 'vitest'
import { setup } from './setup.ts'
import { expectMatchesSpec } from './spec.ts'

describe('saml', () => {
  const api = setup()

  describe('POST /saml/party/newusers', () => {
    it('finds users created in the given period', async () => {
      const res = await api.post('/saml/party/newusers', {
        from: '2026-01-01T00:00:00+0100',
        to: '2026-01-31T00:00:00+0100',
      })
      expectMatchesSpec('post', '/saml/party/newusers', res)
      expect(res.body.map((u: { id: string }) => u.id)).toEqual([
        '100018',
        '100019',
        '100020',
      ])
    })

    it('rejects a missing body', async () => {
      const res = await api.post('/saml/party/newusers')
      expectMatchesSpec('post', '/saml/party/newusers', res)
      expect(res.status).toBe(415)
    })

    it('rejects invalid dates', async () => {
      const res = await api.post('/saml/party/newusers', {
        from: 'yesterday',
        to: 'today',
      })
      expectMatchesSpec('post', '/saml/party/newusers', res)
      expect(res.status).toBe(500)
    })
  })

  describe('POST /saml/party/list', () => {
    it('gets users by id', async () => {
      const res = await api.post('/saml/party/list', {
        partyIdList: ['100001', '100005'],
      })
      expectMatchesSpec('post', '/saml/party/list', res)
      expect(res.body.map((u: { id: string }) => u.id)).toEqual([
        '100001',
        '100005',
      ])
    })

    it('answers malformed JSON in its error format', async () => {
      const res = await api
        .post('/saml/party/list')
        .set('content-type', 'application/json')
        .send('{"partyIdList": [')
      expectMatchesSpec('post', '/saml/party/list', res)
      expect(res.status).toBe(500)
    })

    it('rejects a missing id list', async () => {
      const res = await api.post('/saml/party/list', {})
      expectMatchesSpec('post', '/saml/party/list', res)
      expect(res.status).toBe(500)
    })
  })

  describe('GET /saml/v1/users', () => {
    it('pages through users by id', async () => {
      const first = await api.get('/saml/v1/users?limit=15')
      expectMatchesSpec('get', '/saml/v1/users', first)
      expect(first.body.data).toHaveLength(15)
      expect(first.body.meta.hasNext).toBe(true)

      const last = first.body.data.at(-1).id
      const second = await api.get(`/saml/v1/users?limit=15&after=${last}`)
      expectMatchesSpec('get', '/saml/v1/users', second)
      expect(second.body.data).toHaveLength(5)
      expect(second.body.meta.hasNext).toBe(false)
    })

    it('filters by modification date', async () => {
      const res = await api.get(
        '/saml/v1/users?modified_after=2025-12-31T00:00:00%2B0100&modified_before=2026-12-31T00:00:00Z'
      )
      expectMatchesSpec('get', '/saml/v1/users', res)
      expect(res.body.data.map((u: { id: string }) => u.id)).toEqual([
        '100018',
        '100019',
        '100020',
      ])
    })

    it('filters by user ids', async () => {
      const res = await api.get(
        '/saml/v1/users?include[]=100002&include[]=100003'
      )
      expectMatchesSpec('get', '/saml/v1/users', res)
      expect(res.body.data.map((u: { id: string }) => u.id)).toEqual([
        '100002',
        '100003',
      ])
    })

    it('rejects an after that is not a user id', async () => {
      const res = await api.get('/saml/v1/users?after=abc')
      expect(res.status).toBe(400)
    })

    it('rejects a limit out of range', async () => {
      const res = await api.get('/saml/v1/users?limit=1001')
      expect(res.status).toBe(400)
    })
  })
})
