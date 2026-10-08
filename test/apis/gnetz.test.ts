import { randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it } from 'vitest'
import { setup } from '../setup.ts'
import { expectMatchesSpec } from '../spec.ts'

const JOHN = {
  userId: '100001',
  profileId: '89015b5a-a4e9-435e-a137-6a21bff4b3e6',
}

const update = {
  userId: JOHN.userId,
  username: 'doejohn',
  email: 'john@example.org',
  loginEmail: 'john.doe@example.com',
  image: {
    thumbnail: {
      url: 'https://example.org/t.jpg',
      mimetype: 'image/jpeg',
      width: 150,
      height: 150,
    },
    large: null,
  },
  phoneNumbers: [{ country: '+49', number: '17712341234' }],
  messengers: [{ type: 'threema', externalId: 'GAvh15G12512125H' }],
  socialMedia: [{ type: 'mastodon', url: 'https://example.org/@john' }],
  tags: ['101'],
  privacy: { overall: 'public', email: 'private', chatbegruenung: null },
}

describe('gnetz', () => {
  let api: ReturnType<typeof setup>
  beforeEach(() => {
    api = setup()
  })

  it('lists profile ids', async () => {
    const res = await api.get('/gnetz/v2/profiles/ids')
    expectMatchesSpec('get', '/gnetz/v2/profiles/ids', res)
    expect(res.body).toContain(JOHN.profileId)
  })

  describe('POST /gnetz/v2/profiles/list', () => {
    it('gets profiles by user id', async () => {
      const res = await api.post('/gnetz/v2/profiles/list', {
        userIds: [JOHN.userId],
      })
      expectMatchesSpec('post', '/gnetz/v2/profiles/list', res)
      expect(res.body).toHaveLength(1)
      expect(res.body[0].id).toBe(JOHN.profileId)
    })

    it('rejects ids that are not arrays', async () => {
      const res = await api.post('/gnetz/v2/profiles/list', {
        userIds: JOHN.userId,
      })
      expectMatchesSpec('post', '/gnetz/v2/profiles/list', res)
      expect(res.status).toBe(422)
    })
  })

  describe('POST /gnetz/v2/profiles', () => {
    it('creates a profile', async () => {
      await api.post('/gnetz/v2/profiles/delete', { userIds: [JOHN.userId] })
      const id = randomUUID()
      const res = await api.post('/gnetz/v2/profiles', {
        id,
        userId: JOHN.userId,
        username: 'doejohn',
        email: 'john.doe@example.com',
      })
      expectMatchesSpec('post', '/gnetz/v2/profiles', res)
      expect(res.body.id).toBe(id)
      expect((await api.get('/gnetz/v2/profiles/ids')).body).toContain(id)
    })

    it('rejects a user that does not exist', async () => {
      const res = await api.post('/gnetz/v2/profiles', {
        id: randomUUID(),
        userId: '999',
        username: 'nobody',
        email: 'nobody@example.com',
      })
      expectMatchesSpec('post', '/gnetz/v2/profiles', res)
      expect(res.status).toBe(422)
    })

    it('rejects a second profile for a user', async () => {
      const res = await api.post('/gnetz/v2/profiles', {
        id: randomUUID(),
        userId: JOHN.userId,
        username: 'doejohn',
        email: 'john.doe@example.com',
      })
      expectMatchesSpec('post', '/gnetz/v2/profiles', res)
      expect(res.status).toBe(422)
    })
  })

  it('deletes profiles by profile or user id', async () => {
    const res = await api.post('/gnetz/v2/profiles/delete', {
      profileIds: [JOHN.profileId],
      userIds: ['100002', '999'],
    })
    expectMatchesSpec('post', '/gnetz/v2/profiles/delete', res)
    expect(res.body.map((p: { userId: string }) => p.userId).sort()).toEqual([
      '100001',
      '100002',
    ])
  })

  describe('PUT /gnetz/v2/profiles/{profileId}', () => {
    it('updates a profile and gives new items ids', async () => {
      const res = await api.put(`/gnetz/v2/profiles/${JOHN.profileId}`, update)
      expectMatchesSpec('put', '/gnetz/v2/profiles/{profileId}', res)
      expect(res.body.email).toBe(update.email)
      expect(res.body.phoneNumbers[0].id).toBeDefined()
      expect(res.body.image.thumbnail.id).toBeDefined()

      const [stored] = (
        await api.post('/gnetz/v2/profiles/list', {
          profileIds: [JOHN.profileId],
        })
      ).body
      expect(stored).toEqual(res.body)
    })

    it('rejects a body with missing fields', async () => {
      const res = await api.put(`/gnetz/v2/profiles/${JOHN.profileId}`, {
        email: 'x@example.org',
      })
      expectMatchesSpec('put', '/gnetz/v2/profiles/{profileId}', res)
      expect(res.status).toBe(422)
    })

    it('rejects a body that does not match the spec', async () => {
      const res = await api.put(`/gnetz/v2/profiles/${JOHN.profileId}`, {
        ...update,
        image: null,
        phoneNumbers: '017712341234',
      })
      expectMatchesSpec('put', '/gnetz/v2/profiles/{profileId}', res)
      expect(res.status).toBe(422)
      expect(
        res.body.validationErrors.map((e: { path: string }) => e.path)
      ).toEqual(expect.arrayContaining(['image', 'phoneNumbers']))
    })

    it('answers 404 for an unknown profile', async () => {
      // The spec documents no 404 here, but Sherpa answers unknown profiles with one
      const res = await api.put(`/gnetz/v2/profiles/${randomUUID()}`, update)
      expect(res.status).toBe(404)
    })
  })

  describe('GET /gnetz/v2/profiles/{profileId}/form-values', () => {
    it('gets the form values', async () => {
      const res = await api.get(
        `/gnetz/v2/profiles/${JOHN.profileId}/form-values`
      )
      expectMatchesSpec(
        'get',
        '/gnetz/v2/profiles/{profileId}/form-values',
        res
      )
      expect(res.body.emails).toEqual(['john.doe@example.com'])
    })

    it('answers 404 for an unknown profile', async () => {
      const res = await api.get(
        `/gnetz/v2/profiles/${randomUUID()}/form-values`
      )
      expectMatchesSpec(
        'get',
        '/gnetz/v2/profiles/{profileId}/form-values',
        res
      )
      expect(res.status).toBe(404)
    })
  })

  it('answers malformed JSON in its error format', async () => {
    const res = await api
      .post('/gnetz/v2/profiles/list')
      .set('content-type', 'application/json')
      .send('{"userIds": [')
    expectMatchesSpec('post', '/gnetz/v2/profiles/list', res)
    expect(res.status).toBe(422)
  })

  it('lists tags', async () => {
    const res = await api.get('/gnetz/v2/tags')
    expectMatchesSpec('get', '/gnetz/v2/tags', res)
    expect(res.body.length).toBeGreaterThan(0)
  })
})
