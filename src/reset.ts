import { config } from './config.ts'
import { openDatabase } from './store/db.ts'
import { resetDatabase } from './store/seed.ts'

resetDatabase(openDatabase(config.databasePath))
console.info(`reset ${config.databasePath} to the fixtures`)
