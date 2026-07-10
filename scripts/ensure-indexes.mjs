import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MongoClient } from "mongodb";

function loadEnvFile(fileName) {
  const filePath = resolve(process.cwd(), fileName);
  if (!existsSync(filePath)) return;
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 0) continue;
    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    if (!key || process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not configured.");
  process.exit(1);
}

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000 });
const dbName = process.env.MONGODB_DB ?? "monochrome_translations";

try {
  await client.connect();
  const db = client.db(dbName);
  await Promise.all([
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("novels").createIndex({ userId: 1, id: 1 }, { unique: true }),
    db.collection("chapters").createIndex({ userId: 1, novelId: 1, order: 1 }),
    db.collection("chapters").createIndex({ userId: 1, id: 1 }, { unique: true }),
    db.collection("glossaryTerms").createIndex({ userId: 1, novelId: 1, sourceTerm: 1 }, { unique: true }),
    db.collection("glossaryTerms").createIndex({ userId: 1, id: 1 }, { unique: true }),
    db.collection("styleGuides").createIndex({ userId: 1, id: 1 }, { unique: true }),
    db.collection("translationVersions").createIndex({ userId: 1, chapterId: 1, version: 1 }, { unique: true }),
    db.collection("jobs").createIndex({ userId: 1, status: 1 }),
    db.collection("jobs").createIndex({ userId: 1, id: 1 }, { unique: true }),
  ]);
  console.log(`MongoDB indexes are ready for database "${dbName}".`);
} finally {
  await client.close();
}