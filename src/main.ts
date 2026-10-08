import { createApp } from './app.ts'
import { config } from './config.ts'
import { openDatabase } from './db.ts'

const db = openDatabase(config.databasePath)

createApp(db).listen(config.port, () => {
  console.info(
    `server running on port ${config.port}, database at ${config.databasePath}`
  )
})
