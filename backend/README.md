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
bun run dev
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
