import { createApp } from './app.ts'
import { config } from './config.ts'
import { openDatabase } from './store/db.ts'
import { seedIfEmpty } from './store/seed.ts'

const db = seedIfEmpty(openDatabase(config.databasePath))

createApp(db).listen(config.port, () => {
  console.info(
    `server running on port ${config.port}, database at ${config.databasePath}`
  )
})
