import { Router } from 'express'
import type { DatabaseSync } from 'node:sqlite'
import { samlError } from './errors.ts'
import { validateBody } from '../../middleware/validate-body.ts'
import type { Schemas } from '../../types.ts'
import { findUsers, toSamlUser } from '../../store/users.ts'

function parseDate(value: unknown) {
  if (typeof value !== 'string') return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function toStringArray(value: unknown) {
  if (value === undefined) return undefined
  return Array.isArray(value) ? value.map(String) : [String(value)]
}

export function samlRouter(db: DatabaseSync) {
  const router = Router()

  router.post(
    '/saml/party/newusers',
    validateBody('post', '/saml/party/newusers'),
    (req, res) => {
      const from = parseDate(req.body.from)
      const to = parseDate(req.body.to)
      const users: Schemas['SamlNewUser'][] = findUsers(db, {
        createdFrom: from,
        createdTo: to,
      }).map(({ id, name1, name2, email }) => ({
        toType: 'SamlOnboardingPartyTO',
        id,
        name1,
        name2,
        email,
      }))
      res.json(users)
    }
  )

  router.post(
    '/saml/party/list',
    validateBody('post', '/saml/party/list'),
    (req, res) => {
      const users = findUsers(db, { ids: req.body.partyIdList })
      res.json(users.map((user) => toSamlUser(db, user)))
    }
  )

  router.get('/saml/v1/users', (req, res) => {
    const { limit = '200', after, modified_after, modified_before } = req.query
    const pageSize = Number(limit)
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1000) {
      res
        .status(400)
        .json(samlError(400, 'limit must be an integer from 1 to 1000'))
      return
    }
    if (after !== undefined && !/^\d+$/.test(String(after))) {
      res.status(400).json(samlError(400, 'after must be a user id'))
      return
    }
    const modifiedAfter = parseDate(modified_after)
    const modifiedBefore = parseDate(modified_before)
    if (
      (modified_after !== undefined && !modifiedAfter) ||
      (modified_before !== undefined && !modifiedBefore)
    ) {
      res
        .status(400)
        .json(
          samlError(400, 'modified_after and modified_before must be dates')
        )
      return
    }

    const users = findUsers(db, {
      ids: toStringArray(req.query['include[]']),
      after: typeof after === 'string' ? after : undefined,
      modifiedAfter,
      modifiedBefore,
      limit: pageSize + 1,
    })
    const response: Schemas['SamlFindUsersResponse'] = {
      data: users.slice(0, pageSize).map((user) => toSamlUser(db, user)),
      meta: { hasNext: users.length > pageSize },
    }
    res.json(response)
  })

  return router
}
