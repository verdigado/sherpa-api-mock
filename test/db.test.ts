import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { openDatabase, resetDatabase } from '../src/db.ts'
import { setup } from './setup.ts'

describe('database', () => {
  const path = join(
    mkdtempSync(join(tmpdir(), 'sherpa-api-mock-')),
    'sherpa.db'
  )

  it('keeps changes across restarts and resets to the fixtures', async () => {
    const before = setup(openDatabase(path))
    await before.post('/gnetz/v2/profiles/delete', { userIds: ['100001'] })
    before.db.close()

    const after = setup(openDatabase(path))
    const res = await after.post('/gnetz/v2/profiles/list', {
      userIds: ['100001'],
    })
    expect(res.body).toEqual([])

    resetDatabase(after.db)
    const reset = await after.post('/gnetz/v2/profiles/list', {
      userIds: ['100001'],
    })
    expect(reset.body).toHaveLength(1)
  })
})
