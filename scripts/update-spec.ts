/**
 * Copies openapi.yaml from a local sherpa-api checkout at the given ref,
 * records where it came from and regenerates the types.
 *
 * Usage: npm run spec:update -- <ref>
 * The checkout defaults to ../sherpa-api, override with SHERPA_API_DIR.
 */
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const ref = process.argv[2]
if (!ref) {
  console.error('usage: npm run spec:update -- <ref>')
  process.exit(1)
}
const repo = process.env.SHERPA_API_DIR ?? '../sherpa-api'

const git = (...args: string[]) =>
  execFileSync('git', ['-C', repo, ...args], { encoding: 'utf-8' })

const commit = git('rev-parse', `${ref}^{commit}`).trim()
writeFileSync('spec/openapi.yaml', git('show', `${commit}:openapi.yaml`))
writeFileSync(
  'spec/SOURCE',
  `https://git.verdigado.com/verdigado/sherpa-api/src/commit/${commit}/openapi.yaml\n`
)
execFileSync(
  'npx',
  ['openapi-typescript', 'spec/openapi.yaml', '-o', 'spec/openapi.d.ts'],
  {
    stdio: 'inherit',
  }
)
