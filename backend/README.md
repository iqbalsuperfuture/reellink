# ReelLink Backend

ReelLink is a Bun + Hono backend that maps one Instagram Reel URL to one public landing page with many creator-managed resources.

## Stack

- Bun
- Hono
- PostgreSQL
- Drizzle ORM + drizzle-kit
- Zod validation
- Jose JWT auth
- Argon2 password hashing
- Scalar API docs

## Setup

### Docker Dev Setup

From the `backend/` folder:

```bash
bun run dev
```

This starts:

- API: `http://localhost:3000`
- Scalar API docs: `http://localhost:3000/docs`
- OpenAPI spec: `http://localhost:3000/openapi.json`
- PostgreSQL: `localhost:5432`
- Adminer database UI: `http://localhost:8080`

Adminer login:

```text
System: PostgreSQL
Server: postgres
Username: postgres
Password: postgres
Database: reellink
```

The API container waits for Postgres, ensures the `reellink` database exists,
applies the Drizzle schema with `bun run db:push --force`, and starts Bun in
watch mode. Source changes under `backend/` reload automatically.

To seed sample data:

```bash
bun run db:seed:docker
```

To stop the stack:

```bash
bun run dev:down
```

To remove the local database volume and start fresh:

```bash
bun run dev:fresh
```

Useful Docker dev commands:

```bash
bun run dev           # start Docker dev stack in watch mode
bun run dev:detached  # start Docker dev stack in the background
bun run dev:logs      # follow API logs
bun run dev:down      # stop containers
bun run dev:fresh     # stop containers and remove dev volumes
bun run db:seed:docker
```

### Server Deploy

Production deploy files live in `backend/on-server/`.

Before the first deploy, log in to GitHub Container Registry once on your local
machine and once on the server:

```bash
docker login ghcr.io -u YOUR_GITHUB_USER
ssh root@207.180.206.99 "docker login ghcr.io -u YOUR_GITHUB_USER"
```

Set these deploy values in `backend/.env`:

```env
REGISTRY=ghcr.io
REGISTRY_USERNAME=YOUR_GITHUB_USER
IMAGE_NAME=reellink-api
IMAGE_TAG=latest
IMAGE_PLATFORM=linux/amd64
SSH_HOST=root@207.180.206.99
REMOTE_BASE_DIR=/projects/reellink
OVERWRITE_SERVER_ENV=0
```

Then deploy from the `backend/` folder:

```bash
bun run deploy:server
```

The deploy script builds and pushes the production image, copies
`backend/on-server/` to `/projects/reellink/on-server`, pulls the image on the
server, and starts Docker Compose.

### Local Setup

1. Install dependencies:

```bash
bun install
```

2. Create your environment file:

```bash
cp .env.example .env
```

3. Set these environment variables in `.env`:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/reellink
JWT_ACCESS_SECRET=replace-with-a-long-random-secret
JWT_REFRESH_SECRET=replace-with-a-different-long-random-secret
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=30d
PORT=3000
NODE_ENV=development
```

4. Generate and apply database changes:

```bash
bun run db:generate
bun run db:push
```

5. Seed sample data:

```bash
bun run db:seed
```

6. Start the API:

```bash
bun run dev:local
```

## API Docs

- Scalar docs: `http://localhost:3000/docs`
- OpenAPI spec: `http://localhost:3000/openapi.json`

## Database Commands

- `bun run db:generate`
- `bun run db:migrate`
- `bun run db:push`
- `bun run db:studio`
- `bun run db:seed`

## Example Endpoints

Health:

```bash
curl http://localhost:3000/health
```

Register:

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "creator@example.com",
    "password": "Password123!",
    "username": "style_by_ana",
    "displayName": "Ana"
  }'
```

Resolve a Reel:

```bash
curl -X POST http://localhost:3000/public/resolve-reel \
  -H "Content-Type: application/json" \
  -d '{
    "instagramUrl": "https://instagram.com/reel/C123ABC"
  }'
```

## Notes

- Refresh tokens are hashed in the database and rotated on every refresh.
- Public endpoints only return published public reels and active resources.
- Unsafe resource URL protocols such as `javascript:`, `data:`, and `file:` are rejected.
