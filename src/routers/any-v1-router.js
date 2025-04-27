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

anyV1Router.get(
  '/alive',
  ash(async (req, res) => {
    const now = new Date()
    const pad = (num) => String(num).padStart(2, '0');
    const formattedDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    res.send({
      "toType": "ServerAliveTO",
      "alive": true,
      "serverInfo": `Live-System (Version 1.5-74, Serverzeit ${formattedDate}, 1 active users)`
    })
  })
)
