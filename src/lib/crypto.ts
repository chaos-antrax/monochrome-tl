import crypto from "node:crypto";

type EncryptedValue = {
  iv: string;
  authTag: string;
  ciphertext: string;
};

function getKey(secret = process.env.ENCRYPTION_SECRET ?? "") {
  if (secret.length < 32) {
    throw new Error("ENCRYPTION_SECRET must be at least 32 characters.");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptSecret(plainText: string, secret?: string): EncryptedValue {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  return {
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

export function decryptSecret(value: EncryptedValue, secret?: string) {
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(secret), Buffer.from(value.iv, "base64"));
  decipher.setAuthTag(Buffer.from(value.authTag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(value.ciphertext, "base64")), decipher.final()]).toString("utf8");
}