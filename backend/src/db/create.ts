import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to create the database.");
}

const targetUrl = new URL(databaseUrl);
const databaseName = targetUrl.pathname.replace(/^\//, "");

if (!databaseName) {
  throw new Error("DATABASE_URL must include a database name.");
}

const adminUrl = new URL(targetUrl);
adminUrl.pathname = "/postgres";

const quoteIdentifier = (value: string) => `"${value.replaceAll('"', '""')}"`;

const sql = postgres(adminUrl.toString(), {
  max: 1,
  prepare: false,
});

try {
  const existing = await sql<{ exists: boolean }[]>`
    select exists(
      select 1 from pg_database where datname = ${databaseName}
    ) as "exists"
  `;

  if (existing[0]?.exists) {
    console.log(`Database "${databaseName}" already exists.`);
  } else {
    await sql.unsafe(`create database ${quoteIdentifier(databaseName)}`);
    console.log(`Database "${databaseName}" created.`);
  }
} finally {
  await sql.end();
}
