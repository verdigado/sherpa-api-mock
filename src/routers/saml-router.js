import express from 'express'
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
    res.send(_users)
  })
)

function getUsers() {
  return readDataFile('users.json')
}
