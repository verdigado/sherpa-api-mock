# Sherpa API Mock

The **Sherpa API Mock** is a lightweight, mock implementation of the Sherpa API designed for local development. It offers the minimal set of endpoints necessary for developing features in other infrastructure components.

The Sherpa API specification can be found at https://git.verdigado.com/verdigado/sherpa-api

## Concept

- **Simple Node.js Express App**: This mock service is built using Node.js and Express, serving data from JSON files.
- **Realistic Data**: JSON files contain data closely mirroring production data (for divisions and roles) alongside fake user data.
- **Dockerized Deployment**: A prebuilt Docker image is available on the GitHub Container Registry. You can pull it using:
  ```
  docker run -d -p 5000:5000 --name sherpa-mock ghcr.io/verdigado/sherpa-api-mock:latest
  ```
- **Configurable Port**: By default, the service runs on port 5000. This can be customized via the `APP_PORT` environment variable.

## Modifing Example Data

To modify the api responses, simply update or replace the sample JSON files located in the `data` directory.

**No Type Checking**
This mock service does not perform type checking. If the data from the data directory does not conform to the API specification you won't get any warning.


When running inside docker you can use a volume mapping to `/app/data` to serve your example json files.

**Copy Sample Files to Host**

```
docker cp <container id>:/app/data ./local/path
```

**Docker Compose Example**
```yaml
services:
  sherpa-api-mock:
    image: ghcr.io/verdigado/sherpa-api-mock:latest
    ports:
      - 5000:5000
    volumes:
      - ./local/path:/app/data
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
