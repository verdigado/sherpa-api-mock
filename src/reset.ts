import { config } from './config.ts'
import { openDatabase, resetDatabase } from './db.ts'

resetDatabase(openDatabase(config.databasePath))
console.info(`reset ${config.databasePath} to the fixtures`)
