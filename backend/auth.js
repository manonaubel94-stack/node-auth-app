// Pure logic: validation and password hashing. No HTTP or database code in this file.

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
export const MIN_PASSWORD_LENGTH = 8;

export class AuthError extends Error {}

const encoder = new TextEncoder();
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const fromHex = (hex) => new Uint8Array(hex.match(/../g).map((h) => parseInt(h, 16)));

// Returns "salt$hash" (both hex) using PBKDF2-SHA256, via Node's Web Crypto API.
export async function hashPassword(password, salt = crypto.getRandomValues(new Uint8Array(16))) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 100_000 },
    key,
    256,
  );
  return `${toHex(salt)}$${toHex(bits)}`;
}

export async function verifyPassword(password, stored) {
  const [saltHex] = stored.split("$");
  return (await hashPassword(password, fromHex(saltHex))) === stored;
}

export function normalize(username) {
  return String(username ?? "").trim().toLowerCase();
}

export function validateUsername(username) {
  if (!USERNAME_RE.test(username)) {
    throw new AuthError("Username must be 3-20 characters: letters, digits or underscore");
  }
}

export function validatePassword(password) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new AuthError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (!/\d/.test(password)) {
    throw new AuthError("Password must contain at least one digit");
  }
}
