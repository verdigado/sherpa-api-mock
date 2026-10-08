import type { DatabaseSync } from 'node:sqlite'
import request from 'supertest'
import { BASE_PATH, createApp } from '../src/app.ts'
import { openDatabase } from '../src/db.ts'

export function setup(db: DatabaseSync = openDatabase(':memory:')) {
  const app = createApp(db)
  return {
    db,
    get: (path: string) => request(app).get(BASE_PATH + path),
    post: (path: string, body?: object) =>
      request(app)
        .post(BASE_PATH + path)
        .send(body),
    put: (path: string, body?: object) =>
      request(app)
        .put(BASE_PATH + path)
        .send(body),
  }
}
