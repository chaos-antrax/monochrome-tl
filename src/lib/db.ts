import { MongoClient } from "mongodb";

let clientPromise: Promise<MongoClient> | undefined;

export class DatabaseUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "DatabaseUnavailableError";
  }
}

function describeMongoConnectionError(error: unknown) {
  if (error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "ECONNREFUSED" && "syscall" in error && (error as { syscall?: unknown }).syscall === "querySrv") {
    return "MongoDB Atlas SRV DNS lookup was refused. Check DNS/VPN/firewall settings, Atlas Network Access, or use a non-SRV mongodb:// connection string.";
  }
  return error instanceof Error ? error.message : "Unable to connect to MongoDB.";
}

export function getMongoClient() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new DatabaseUnavailableError("MONGODB_URI is not configured.");
  }

  if (!clientPromise) {
    clientPromise = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 }).connect().catch((error) => {
      clientPromise = undefined;
      throw new DatabaseUnavailableError(describeMongoConnectionError(error), { cause: error });
    });
  }

  return clientPromise;
}

export async function getDatabase() {
  const client = await getMongoClient();
  return client.db(process.env.MONGODB_DB ?? "monochrome_translations");
}