import { db, seed } from '../src/db.js'

// Seed the database from the repo json (the authoritative definition).
//   node scripts/seed.js            seed only empty tables
//   node scripts/seed.js --reset    drop + reseed, clearing any live edits
const reset =
  process.argv.includes('--reset') || process.env.DB_RESET === 'true'

seed({ reset })
db.close()

console.info(
  reset
    ? 'database reset and reseeded from repo json'
    : 'database seeded from repo json (empty tables only)'
)
