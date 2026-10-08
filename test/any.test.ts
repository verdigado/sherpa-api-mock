import { describe, expect, it } from 'vitest'
import { setup } from './setup.ts'
import { expectMatchesSpec } from './spec.ts'

describe('any', () => {
  const api = setup()

  it('lists divisions', async () => {
    const res = await api.get('/any/v1/divisions')
    expectMatchesSpec('get', '/any/v1/divisions', res)
    expect(res.body.length).toBeGreaterThan(0)
  })

  it('lists roles', async () => {
    const res = await api.get('/any/v1/roles')
    expectMatchesSpec('get', '/any/v1/roles', res)
    expect(res.body.length).toBeGreaterThan(0)
  })

  it('reports alive', async () => {
    const res = await api.get('/any/v1/alive')
    expectMatchesSpec('get', '/any/v1/alive', res)
    expect(res.body.alive).toBe(true)
  })

  it('answers 501 for endpoints it does not implement', async () => {
    const res = await api.get('/any/v1/tags')
    expect(res.status).toBe(501)
  })
})
