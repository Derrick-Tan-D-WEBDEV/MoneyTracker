/**
 * Per-user field-level encryption using AES-256-GCM.
 *
 * Key derivation: PBKDF2 (password + per-user salt) → 256-bit AES key.
 * Each encrypted value: base64("enc:v1:" + iv(12) + authTag(16) + ciphertext).
 * The "enc:v1:" prefix lets us distinguish encrypted from plaintext (for lazy migration).
 */

import { randomBytes, pbkdf2Sync, createCipheriv, createDecipheriv } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits
const PBKDF2_ITERATIONS = 100_000;
const ENCRYPTED_PREFIX = "enc:v1:";

// ─── Key Derivation ──────────────────────────────────────────────

/** Generate a random salt for a new user. */
export function generateSalt(): string {
  return randomBytes(32).toString("base64");
}

/** Derive a 256-bit AES key from a password and salt via PBKDF2. */
export function deriveKey(password: string, salt: string): string {
  const key = pbkdf2Sync(password, Buffer.from(salt, "base64"), PBKDF2_ITERATIONS, KEY_LENGTH, "sha512");
  return key.toString("base64");
}

// ─── Encrypt / Decrypt ───────────────────────────────────────────

/** Encrypt a plaintext string. Returns a prefixed base64 string. */
export function encrypt(plaintext: string, keyBase64: string): string {
  const key = Buffer.from(keyBase64, "base64");
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Pack: iv + authTag + ciphertext
  const packed = Buffer.concat([iv, authTag, encrypted]);
  return ENCRYPTED_PREFIX + packed.toString("base64");
}

/** Decrypt an encrypted string. Returns plaintext.
 *  If the value is not encrypted (no prefix), returns it as-is (migration safety).
 *  If decryption fails (wrong key / corrupt data), returns "[Encrypted]" gracefully. */
export function decrypt(value: string, keyBase64: string): string {
  if (!value.startsWith(ENCRYPTED_PREFIX)) {
    return value; // Not encrypted yet — return as-is for lazy migration
  }

  try {
    const key = Buffer.from(keyBase64, "base64");
    const packed = Buffer.from(value.slice(ENCRYPTED_PREFIX.length), "base64");

    const iv = packed.subarray(0, IV_LENGTH);
    const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return "[Encrypted]";
  }
}

/** Check if a value is already encrypted. */
export function isEncrypted(value: string): boolean {
  return value.startsWith(ENCRYPTED_PREFIX);
}

// ─── Bulk Field Helpers ──────────────────────────────────────────

/**
 * Encrypt specified fields in an object. Nullish values are left as-is.
 * Returns a new object with encrypted fields.
 */
export function encryptFields<T extends Record<string, unknown>>(data: T, fields: (keyof T)[], keyBase64: string): T {
  const result = { ...data };
  for (const field of fields) {
    const val = result[field];
    if (typeof val === "string" && val.length > 0) {
      (result as Record<string, unknown>)[field as string] = encrypt(val, keyBase64);
    }
  }
  return result;
}

/**
 * Decrypt specified fields in an object. Nullish or non-string values are left as-is.
 * Non-encrypted values pass through unchanged (migration safety).
 */
export function decryptFields<T extends Record<string, unknown>>(data: T, fields: (keyof T)[], keyBase64: string): T {
  const result = { ...data };
  for (const field of fields) {
    const val = result[field];
    if (typeof val === "string" && val.length > 0) {
      (result as Record<string, unknown>)[field as string] = decrypt(val, keyBase64);
    }
  }
  return result;
}

// ─── Auth Helpers ────────────────────────────────────────────────

/**
 * Get the encryption key from the current auth JWT.
 * The key is stored in the JWT token (server-side only via jose, never sent in session to the client).
 * Throws if the key is not available.
 */
export async function getEncryptionKey(): Promise<string> {
  const { auth } = await import("@/lib/auth");
  const session = await auth();
  if (!session) throw new Error("Not authenticated");

  // The key is injected into the JWT in the jwt callback but NOT into the session callback.
  // We need to access the raw token. However, next-auth's auth() gives us the session.
  // Since we DO pass the key through the jwt callback and the session callback runs on the server,
  // we store the key in a way that's accessible server-side.
  // We'll use a different approach: derive the key from the stored salt using a server-side secret.

  // Fallback: read encryption key from internal token storage
  // In next-auth v5, the jwt callback's token is what feeds session.
  // We smuggle the key through by storing it in the token.
  // But auth() only returns session, not the raw token.
  // Solution: We read the raw JWT ourselves.
  const { cookies } = await import("next/headers");
  const { decode } = await import("next-auth/jwt");

  const cookieStore = await cookies();
  // NextAuth uses __Secure- prefix only when AUTH_URL is https
  const useSecurePrefix = (process.env.AUTH_URL || process.env.NEXTAUTH_URL || "").startsWith("https://");
  const cookieName = useSecurePrefix ? "__Secure-authjs.session-token" : "authjs.session-token";
  const tokenValue = cookieStore.get(cookieName)?.value;

  if (!tokenValue) throw new Error("Encryption key not available. Please log in again.");

  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET not configured");

  const decoded = await decode({ token: tokenValue, secret, salt: cookieName });
  const key = (decoded as Record<string, unknown> | null)?.encryptionKey as string | undefined;
  if (!key) throw new Error("Encryption key not available. Please log in again.");

  return key;
}

/**
 * Re-encrypt all user data when password changes.
 * Reads all records, decrypts with old key, encrypts with new key, writes back.
 */
export async function reEncryptUserData(userId: string, oldKey: string, newKey: string) {
  const { db } = await import("@/lib/db");

  // Helper to re-encrypt specified fields across all records
  async function reEncryptTable<T extends Record<string, unknown>>(
    records: (T & { id: string })[],
    fields: string[],
    updateFn: (id: string, data: Record<string, unknown>) => Promise<unknown>,
  ) {
    for (const record of records) {
      const updates: Record<string, unknown> = {};
      let hasChanges = false;
      for (const field of fields) {
        const val = record[field];
        if (typeof val === "string" && val.length > 0 && isEncrypted(val)) {
          const plaintext = decrypt(val, oldKey);
          updates[field] = encrypt(plaintext, newKey);
          hasChanges = true;
        }
      }
      if (hasChanges) {
        await updateFn(record.id, updates);
      }
    }
  }

  // Re-encrypt each table
  const financialAccounts = await db.financialAccount.findMany({ where: { userId } });
  await reEncryptTable(financialAccounts, ["name"], (id, data) => db.financialAccount.update({ where: { id }, data }));

  const transactions = await db.transaction.findMany({ where: { userId } });
  await reEncryptTable(transactions, ["description", "notes"], (id, data) => db.transaction.update({ where: { id }, data }));

  const investments = await db.investment.findMany({ where: { userId } });
  await reEncryptTable(investments, ["symbol", "name", "notes"], (id, data) => db.investment.update({ where: { id }, data }));

  const goals = await db.goal.findMany({ where: { userId } });
  await reEncryptTable(goals, ["name"], (id, data) => db.goal.update({ where: { id }, data }));

  const debts = await db.debt.findMany({ where: { userId } });
  await reEncryptTable(debts, ["name", "lender", "notes"], (id, data) => db.debt.update({ where: { id }, data }));

  const installments = await db.installment.findMany({ where: { userId } });
  await reEncryptTable(installments, ["name", "merchant", "notes"], (id, data) => db.installment.update({ where: { id }, data }));

  const assets = await db.asset.findMany({ where: { userId } });
  await reEncryptTable(assets, ["name", "location", "description", "notes"], (id, data) => db.asset.update({ where: { id }, data }));

  const subscriptions = await db.subscription.findMany({ where: { userId } });
  await reEncryptTable(subscriptions, ["name", "notes", "url"], (id, data) => db.subscription.update({ where: { id }, data }));

  const wishlistItems = await db.wishlistItem.findMany({ where: { userId } });
  await reEncryptTable(wishlistItems, ["name", "notes", "url"], (id, data) => db.wishlistItem.update({ where: { id }, data }));

  const tags = await db.tag.findMany({ where: { userId } });
  await reEncryptTable(tags, ["name"], (id, data) => db.tag.update({ where: { id }, data }));
}

/**
 * Encrypt all existing plaintext data for a user on first login after encryption is enabled.
 * Detects un-encrypted records and encrypts them in-place.
 */
export async function encryptExistingData(userId: string, key: string) {
  const { db } = await import("@/lib/db");

  async function encryptTable<T extends Record<string, unknown>>(
    records: (T & { id: string })[],
    fields: string[],
    updateFn: (id: string, data: Record<string, unknown>) => Promise<unknown>,
  ) {
    for (const record of records) {
      const updates: Record<string, unknown> = {};
      let hasChanges = false;
      for (const field of fields) {
        const val = record[field];
        if (typeof val === "string" && val.length > 0 && !isEncrypted(val)) {
          updates[field] = encrypt(val, key);
          hasChanges = true;
        }
      }
      if (hasChanges) {
        await updateFn(record.id, updates);
      }
    }
  }

  const financialAccounts = await db.financialAccount.findMany({ where: { userId } });
  await encryptTable(financialAccounts, ["name"], (id, data) => db.financialAccount.update({ where: { id }, data }));

  const transactions = await db.transaction.findMany({ where: { userId } });
  await encryptTable(transactions, ["description", "notes"], (id, data) => db.transaction.update({ where: { id }, data }));

  const investments = await db.investment.findMany({ where: { userId } });
  await encryptTable(investments, ["symbol", "name", "notes"], (id, data) => db.investment.update({ where: { id }, data }));

  const goals = await db.goal.findMany({ where: { userId } });
  await encryptTable(goals, ["name"], (id, data) => db.goal.update({ where: { id }, data }));

  const debts = await db.debt.findMany({ where: { userId } });
  await encryptTable(debts, ["name", "lender", "notes"], (id, data) => db.debt.update({ where: { id }, data }));

  const installments = await db.installment.findMany({ where: { userId } });
  await encryptTable(installments, ["name", "merchant", "notes"], (id, data) => db.installment.update({ where: { id }, data }));

  const assets = await db.asset.findMany({ where: { userId } });
  await encryptTable(assets, ["name", "location", "description", "notes"], (id, data) => db.asset.update({ where: { id }, data }));

  const subscriptions = await db.subscription.findMany({ where: { userId } });
  await encryptTable(subscriptions, ["name", "notes", "url"], (id, data) => db.subscription.update({ where: { id }, data }));

  const wishlistItems = await db.wishlistItem.findMany({ where: { userId } });
  await encryptTable(wishlistItems, ["name", "notes", "url"], (id, data) => db.wishlistItem.update({ where: { id }, data }));

  const tags = await db.tag.findMany({ where: { userId } });
  await encryptTable(tags, ["name"], (id, data) => db.tag.update({ where: { id }, data }));

  // Mark user as encrypted
  await db.user.update({
    where: { id: userId },
    data: { isDataEncrypted: true },
  });
}
