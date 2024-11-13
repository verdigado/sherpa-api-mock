/**
 * This script iterates over the division data returned by
 * the `/any/v/divisions` endpoint (stored in an given input file),
 * removes all sensitive data and writes it back to an output file.
 */
import fs from 'fs/promises'

const INPUT_FILE = './local/divisions-original.json'
const OUTPUT_FILE = './data/divisions.json'

function readJsonFile(path) {
  return fs
    .readFile(path, { encoding: 'utf-8' })
    .then((text) => JSON.parse(text))
}

function writeJsonFile(path, data) {
  return fs.writeFile(path, JSON.stringify(data, null, 2), {
    encoding: 'utf-8',
  })
}

const divisions = await readJsonFile(INPUT_FILE)

const modified = divisions.map((div) => {
  // remove real street names and house numbers
  if (div.officeStreet) {
    div.officeStreet = 'Beispielstraße'
  }
  if (div.officeHouseNumber) {
    div.officeHouseNumber = '1a'
  }

  // replace emails with placeholder emails based on division name

  // map for fake email replacements
  // 'real-division-email@example.com' => 'oberndorf_ov@example.com'
  const emailMap = {}
  let i = 0
  for (const email of div.emails) {
    let name = div.shortName.toLowerCase().replace(/\s+/g, '_')
    name = replaceUmlauts(name)
    if (i) {
      name += '_' + i
    }
    emailMap[email] = name + '@example.com'
    i++
  }

  div.emails = div.emails.map((email) => emailMap[email])
  if (div.favoriteEmail) {
    div.favoriteEmail = emailMap[div.favoriteEmail] ?? null
  }

  div.emailTags = Object.fromEntries(
    Object.entries(div.emailTags)
      .map(([email, tag]) => {
        const r = emailMap[email]
        return r ? [r, tag] : null
      })
      .filter((v) => !!v)
  )
  div.emailPurpose = Object.fromEntries(
    Object.entries(div.emailPurpose)
      .map(([email, purpose]) => {
        const r = emailMap[email]
        return r ? [r, purpose] : null
      })
      .filter((v) => !!v)
  )

  div.phoneNumbers = div.phoneNumbers.map(
    (_v, i) => '0049 800 ' + div.internalId + (i > 0 ? i.toString() : '')
  )

  return div
})

function replaceUmlauts(str) {
  const umlautMap = {
    'ä': 'ae',
    'ö': 'oe',
    'ü': 'ue',
    'ß': 'ss',
    'Ä': 'Ae',
    'Ö': 'Oe',
    'Ü': 'Ue'
  };

  return str.replace(/[äöüßÄÖÜ]/g, match => umlautMap[match]);
}

await writeJsonFile(OUTPUT_FILE, modified)
