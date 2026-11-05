import { Router } from 'express'
import type { DatabaseSync } from 'node:sqlite'
import { samlError } from './errors.ts'
import {
  assertValidBody,
  InvalidRequest,
  validateBody,
} from '../../middleware/validate-body.ts'
import type { Schemas } from '../../types.ts'
import { divisions } from '../../store/fixtures.ts'
import {
  createGuestAccount,
  renewGuestAccount,
  revokeGuestAccount,
} from '../../store/guests.ts'
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

  router.post('/saml/v1/guest-accounts', (req, res) => {
    // unlike the older SAML endpoints, this one documents 400 for invalid input
    try {
      assertValidBody('post', '/saml/v1/guest-accounts', req.body)
    } catch (error) {
      if (!(error instanceof InvalidRequest)) throw error
      res.status(400).json(samlError(400, error.message))
      return
    }
    const body: Schemas['SamlCreateGuestAccountDto'] = req.body
    const division = divisions.find(
      (division) => division.divisionKey === body.ownerIdentifier
    )
    if (!division) {
      res.status(400).json(samlError(400, 'unknown division'))
      return
    }

    const result = createGuestAccount(db, {
      ...body,
      ownerId: division.internalId,
    })
    switch (result.outcome) {
      case 'created':
      case 'reused':
        res
          .status(result.outcome === 'created' ? 201 : 200)
          .json(toSamlUser(db, result.user))
        return
      case 'has-access':
        res.status(409).json(samlError(409, 'the person already has access'))
        return
      case 'ambiguous':
        res
          .status(422)
          .json(samlError(422, 'several party records match the email'))
        return
    }
  })

  router.patch('/saml/v1/guest-accounts/:userId', (req, res) => {
    const user = renewGuestAccount(db, req.params.userId)
    if (!user) {
      res.status(404).json(samlError(404, 'no guest account with this id'))
      return
    }
    res.json(toSamlUser(db, user))
  })

  router.delete('/saml/v1/guest-accounts/:userId', (req, res) => {
    if (!revokeGuestAccount(db, req.params.userId)) {
      res.status(404).json(samlError(404, 'no guest account with this id'))
      return
    }
    res.status(204).end()
  })

  return router
}
