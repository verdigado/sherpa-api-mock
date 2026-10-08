import { config } from './config.ts'
import { openDatabase } from './db.ts'
import { resetDatabase } from './seed.ts'

resetDatabase(openDatabase(config.databasePath))
console.info(`reset ${config.databasePath} to the fixtures`)
