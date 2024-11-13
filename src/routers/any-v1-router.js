import express from 'express'
import ash from 'express-async-handler'
import { readDataFile } from '../utils.js'

export const anyV1Router = express.Router()

anyV1Router.get(
  '/divisions',
  ash(async (req, res) => {
    const divisions = await readDataFile('divisions.json')
    res.send(divisions)
  })
)

anyV1Router.get(
  '/roles',
  ash(async (req, res) => {
    const roles = await readDataFile('roles.json')
    res.send(roles)
  })
)
