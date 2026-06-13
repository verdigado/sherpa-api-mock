# Sherpa API Mock

The **Sherpa API Mock** is a lightweight, mock implementation of the Sherpa API designed for local development. It offers the minimal set of endpoints necessary for developing features in other infrastructure components.

The Sherpa API specification can be found at https://git.verdigado.com/verdigado/sherpa-api

## Concept

- **Simple Node.js Express App**: This mock service is built using Node.js and Express.
- **Static data from JSON, dynamic data in SQLite**: `divisions`, `roles` and `gnetz-tags` are static and served directly from JSON files. The dynamic entities (`users` and `profiles`) live in a small embedded SQLite database, seeded from the JSON in `data/`. This keeps writes consistent under concurrent requests.
- **Realistic Data**: JSON files contain data closely mirroring production data (for divisions and roles) alongside fake user data.
- **Dockerized Deployment**: A prebuilt Docker image is available on the GitHub Container Registry. You can pull it using:
  ```
  docker run -d -p 5000:5000 --name sherpa-mock ghcr.io/verdigado/sherpa-api-mock:latest
  ```
- **Configurable Port**: By default, the service runs on port 5000. This can be customized via the `APP_PORT` environment variable.

## Modifing Example Data

The JSON files in `data/` are the source of truth:

- **Static data** (`divisions.json`, `roles.json`, `gnetz-tags.json`) is served directly — edit the file and restart.
- **Dynamic data** (`data/users/*.json`, `data/profiles.json`) is the *seed* for the SQLite database. Edit the JSON, then reseed (see below) to apply it.

**No Type Checking**
This mock service does not perform type checking. If the data from the data directory does not conform to the API specification you won't get any warning.

## Database & Seeding

`users` and `profiles` are stored in a SQLite database (`DB_PATH`, default `./data/app.db`). On startup empty tables are auto-seeded from the repo JSON, so a fresh instance just works.

```
npm run db:seed     # seed only empty tables
npm run db:reset    # drop + reseed users/profiles from the repo json (clears live edits)
```

For quick experiments you can edit the database in place with plain SQL — no redeploy needed. Scalar fields are real columns:

```
sqlite3 ./data/app.db "UPDATE profiles SET privacy_email='private' WHERE username='doejohn'"
```

These live edits are throwaway: `db:reset` (or `DB_RESET=true` on startup) restores the exact repo definition. The repo JSON stays authoritative.

### Docker

The image bakes the JSON into `/app/data` and keeps the database on a separate path (`/app/db`) so a volume mount can't shadow the seed/static data. Mount a volume at `/app/db` to persist the database across restarts:

```yaml
services:
  sherpa-api-mock:
    image: ghcr.io/verdigado/sherpa-api-mock:latest
    ports:
      - 5000:5000
    volumes:
      - sherpa-db:/app/db
volumes:
  sherpa-db:
```

To reseed a running container after updating the JSON (rebuild/redeploy the image first):

```
docker exec <container id> npm run db:reset
```

---

## Implemented Endpoints

### ANY API

```
GET /any/v1/divisions
```

```
GET /any/v1/roles
```

### SAML API

```
POST /saml/party/newusers
```

```
POST /saml/party/list
```

---

## Development

### Install Dependencies

```
npm install
```

### Start App

```
npm run start
```

### Start in Development Mode

```
npm run dev
```
