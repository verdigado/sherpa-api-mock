export const BASE_PATH = '/sherpa/ws/m2m'

export const config = {
  port: Number(process.env.APP_PORT ?? 5000),
  databasePath: process.env.DATABASE_PATH ?? 'data/sherpa.db',
}
