import fs from 'fs/promises'
import * as url from 'url'
const __dirname = url.fileURLToPath(new URL('.', import.meta.url))

/**
 * Read a file from {projectRoot}/data and parse it as json
 * @param {String} path - relative path
 */
export function readDataFile(path) {
  const fullPath = `${__dirname}../data/${path}`
  return fs
    .readFile(fullPath, { encoding: 'utf-8' })
    .then((text) => JSON.parse(text))
}

/**
 * Read a file from {projectRoot}/data and parse it as json
 * @param {String} path - relative path
 */
export function readDataDir(path) {
  const fullPath = `${__dirname}../data/${path}`
  return fs.readdir(fullPath).then(async (files) => {
    const jsonFiles = files.filter((file) => file.endsWith('.json'))
    const results = await Promise.all(
      jsonFiles.map((file) =>
        fs.readFile(`${fullPath}/${file}`, { encoding: 'utf-8' }).then(JSON.parse)
      )
    )
    return results
  })
}

/**
 * Encode given data as json and write it to {projectRoot}/data
 * @param {String} path - relative path
 */
export function writeDataFile(path, data) {
  const fullPath = `${__dirname}../data/${path}`
  return fs
    .writeFile(fullPath, JSON.stringify(data, null, 2), { encoding: 'utf-8' })
}
