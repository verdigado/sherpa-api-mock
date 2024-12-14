import express from 'express'
import lodash from 'lodash'
import ash from 'express-async-handler'
import { readDataFile } from '../utils.js'

export const samlRouter = express.Router()


samlRouter.post(
  '/newusers',
  ash(async (req, res) => {
    const { from, to } = req.body

    const users = await getUsers()
    const newUsers = users
      .map(({ id, name1, name2, email }) => ({
        toType: 'SamlOnboardingPartyTO',
        id,
        name1,
        name2,
        email,
      })).slice(0, 10)


    res.send(newUsers)
  })
)

samlRouter.post(
  '/list',
  ash(async (req, res) => {
    const { partyIdList } = req.body

    const users = await getUsers()
    const _users = users.filter((user) => partyIdList.includes(user.id))
    res.send(buildUsersResponse(_users))
  })
)

function getUsers() {
  return readDataFile('users.json')
}

/**
 * remove all properties that are not returned by the user endpoints
 */
function buildUsersResponse(users) {
  return users.map((user) => {
    const _user = lodash.pick(user, [
      'toType',
      'id',
      // 'personalId',
      'ownerIdentifier',
      'ownerId',
      'createdOn',
      'lastModifiedOn',
      // 'memberships',
      'roles',
      'name1',
      'name2',
      'email',
      // 'achievements',
      // 'formValues',
    ])
    _user.memberships = user.memberships.map((m) => lodash.pick(m, [
      'toType',
      'id',
      'ownerIdentifier',
      'memberOfStructureIdentifier',
      // 'joinedAt',
      // 'exitedAt',
    ]))
    return _user
  })
}
