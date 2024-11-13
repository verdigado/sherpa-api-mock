import express from 'express'
import ash from 'express-async-handler'
import { readDataFile } from '../utils.js'

export const anyV1Router = express.Router()

anyV1Router.get(
  '/divisions',
  ash(async (req, res) => {
    const divisions = await getDivisions()
    res.send(divisions)
  })
)

function getDivisions() {
  return readDataFile('divisions.json')
}
