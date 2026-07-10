import { ObjectId } from "mongodb";
import { getDatabase } from "./db";
import { decryptSecret, encryptSecret } from "./crypto";
import type { Provider } from "./schemas/translation";

type UserDocument = {
  _id?: ObjectId;
  email: string;
  passwordHash: string;
  provider?: Provider;
  encryptedApiKey?: { iv: string; authTag: string; ciphertext: string };
  selectedModel?: string;
  appState?: unknown;
  createdAt: Date;
  updatedAt: Date;
};

export async function ensureIndexes() {
  const db = await getDatabase();
  await Promise.all([
    db.collection<UserDocument>("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("translationJobs").createIndex({ userId: 1, status: 1 }),
    db.collection("chapters").createIndex({ novelId: 1, order: 1 }),
    db.collection("glossaryTerms").createIndex({ novelId: 1, sourceTerm: 1 }, { unique: true }),
    db.collection("styleGuides").createIndex({ userId: 1 }),
  ]);
}

export async function usersCollection() {
  await ensureIndexes();
  return (await getDatabase()).collection<UserDocument>("users");
}

export async function findUserByEmail(email: string) {
  return (await usersCollection()).findOne({ email: email.toLowerCase() });
}

export async function createUser(email: string, passwordHash: string) {
  const users = await usersCollection();
  const now = new Date();
  const result = await users.insertOne({ email: email.toLowerCase(), passwordHash, createdAt: now, updatedAt: now });
  return { _id: result.insertedId, email: email.toLowerCase() };
}

export async function getSafeUser(userId: string) {
  const user = await (await usersCollection()).findOne({ _id: new ObjectId(userId) });
  if (!user) return null;
  return {
    id: user._id.toHexString(),
    email: user.email,
    provider: user.provider,
    selectedModel: user.selectedModel,
    hasApiKey: Boolean(user.encryptedApiKey),
  };
}


export async function getBootstrapState(userId: string) {
  const user = await (await usersCollection()).findOne(
    { _id: new ObjectId(userId) },
    { projection: { email: 1, provider: 1, selectedModel: 1, encryptedApiKey: 1, appState: 1 } },
  );
  if (!user) return { user: null, appState: null };
  return {
    user: {
      id: user._id?.toHexString() ?? userId,
      email: user.email,
      provider: user.provider,
      selectedModel: user.selectedModel,
      hasApiKey: Boolean(user.encryptedApiKey),
    },
    appState: user.appState ?? null,
  };
}
export async function getAppState(userId: string) {
  const user = await (await usersCollection()).findOne({ _id: new ObjectId(userId) }, { projection: { appState: 1 } });
  return user?.appState ?? null;
}

export async function saveAppState(userId: string, appState: unknown) {
  await (await usersCollection()).updateOne({ _id: new ObjectId(userId) }, { $set: { appState, updatedAt: new Date() } });
}

export async function saveProviderConfig(userId: string, provider: Provider, apiKey: string, selectedModel: string) {
  await (await usersCollection()).updateOne(
    { _id: new ObjectId(userId) },
    { $set: { provider, selectedModel, encryptedApiKey: encryptSecret(apiKey), updatedAt: new Date() } },
  );
}
export async function getProviderConfig(userId: string) {
  const user = await (await usersCollection()).findOne({ _id: new ObjectId(userId) });
  if (!user?.provider || !user.selectedModel || !user.encryptedApiKey) return null;
  return {
    provider: user.provider,
    model: user.selectedModel,
    apiKey: decryptSecret(user.encryptedApiKey),
  };
}