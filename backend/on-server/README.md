# ReelLink Server Deploy Bundle

Copy this `backend/on-server/` folder to your server. It contains the production
`docker-compose.yml` and `.env` files. Edit `.env`, then start the stack.

## 1. Registry Login

Log in to the registry once before deploying:

```bash
docker login ghcr.io -u YOUR_GITHUB_USER
ssh root@207.180.206.99 "docker login ghcr.io -u YOUR_GITHUB_USER"
```

Use a GitHub classic PAT as the password. The token needs:

```text
write:packages
read:packages
```

For private packages/repos, also include `repo`.

## 2. Deploy Script

Run from the `backend/` folder:

```bash
bun run deploy:server
```

The script builds and pushes the image, copies this `on-server/` bundle to
`root@207.180.206.99:/projects/reellink/on-server`, pulls the image on the
server, and starts Docker Compose.

Deploy values live in `backend/.env`:

```env
REGISTRY=ghcr.io
REGISTRY_USERNAME=YOUR_GITHUB_USER
IMAGE_NAME=reellink-api
IMAGE_TAG=latest
IMAGE_PLATFORM=linux/amd64
```

Optional deploy overrides:

```env
SSH_HOST=root@207.180.206.99
REMOTE_BASE_DIR=/projects/reellink
REELLINK_API_IMAGE=ghcr.io/YOUR_GITHUB_USER/reellink-api:latest
OVERWRITE_SERVER_ENV=0
```

## 3. Configure the Server

Edit `backend/on-server/.env` before the first deploy, or edit
`/projects/reellink/on-server/.env` directly on the server:

```env
REELLINK_API_IMAGE=ghcr.io/YOUR_GITHUB_USER/reellink-api:latest
POSTGRES_PASSWORD=use-a-long-random-password
JWT_ACCESS_SECRET=use-a-long-random-secret-at-least-32-characters
JWT_REFRESH_SECRET=use-another-long-random-secret-at-least-32-characters
APP_PORT=3001
```

## 4. Start Test Production Manually

From the server folder containing `.env` and `docker-compose.yml`:

```bash
docker compose pull
docker compose up -d
docker compose logs -f api
```

The API container waits for Postgres, ensures the database exists, runs Drizzle
migrations, and starts the API.

Check it:

```bash
curl http://localhost:3001/health
```

Docs:

```text
http://SERVER_IP:3001/docs
```

## Useful Commands

```bash
docker compose ps
docker compose logs -f api
docker compose restart api
docker compose down
```

Start Adminer locally on the server:

```bash
docker compose --profile tools up -d adminer
```

Adminer listens on `127.0.0.1:8080` only. Use an SSH tunnel if needed:

```bash
ssh -L 8080:127.0.0.1:8080 user@SERVER_IP
```
