# Sherpa API Mock

A stand-in for the [Sherpa API](https://git.verdigado.com/verdigado/sherpa-api), for developing and testing the services that talk to Sherpa.

It is a fake rather than a mock: it keeps its data in SQLite, so a write shows up in later reads and survives a restart. It applies Sherpa's rules only where a caller's behaviour depends on them. It covers only the endpoints our services call. Any other path answers `501`. It speaks plain HTTP, without mTLS.

## Running

```shell
docker run -d -p 5000:5000 -v ./sherpa-data:/app/data ghcr.io/verdigado/sherpa-api-mock:latest
```

The API lives under `/sherpa/ws/m2m`, like Sherpa's. Mount `/app/data` to keep the data across container restarts.

| Variable        | Default          | Purpose                      |
| --------------- | ---------------- | ---------------------------- |
| `APP_PORT`      | `5000`           | Port to listen on            |
| `DATABASE_PATH` | `data/sherpa.db` | Where the database is stored |

## Data

On its first start, with an empty database, the mock seeds itself from the fixtures in the repo:

- divisions, roles and gnetz tags: real Sherpa data with sensitive details replaced. These are read-only.
- example users with memberships, roles and gnetz profiles, including one per case the guest account endpoints tell apart

To change the data, either edit the fixtures and reset, or change it through the API. A reset wipes the database and seeds it again:

```shell
npm run reset                             # locally
docker exec <container> node src/reset.ts # in Docker
```

## Spec

The mock is built against a pinned copy of the Sherpa spec. Its types come from that copy. It rejects request bodies that don't match it, in the error format Sherpa uses for that API. The tests check every response against it. To move to another version of the spec, point the update script at a ref in a local sherpa-api checkout (`../sherpa-api` by default, or set `SHERPA_API_DIR`):

```shell
npm run spec:update -- <ref>
```

## Endpoints

- `GET /any/v1/divisions`, `/any/v1/roles`, `/any/v1/alive`
- `POST /saml/party/newusers`, `/saml/party/list`
- `GET /saml/v1/users`
- `POST /saml/v1/guest-accounts`, `PATCH` and `DELETE /saml/v1/guest-accounts/{userId}`
- `GET /gnetz/v2/profiles/ids`, `/gnetz/v2/profiles/{profileId}/form-values`, `/gnetz/v2/tags`
- `POST /gnetz/v2/profiles`, `/gnetz/v2/profiles/list`, `/gnetz/v2/profiles/delete`
- `PUT /gnetz/v2/profiles/{profileId}`

## Development

Needs Node 22.18 or later, which runs the TypeScript sources directly.

```shell
npm install
npm run dev       # restarts on changes
npm test
npm run typecheck
```
