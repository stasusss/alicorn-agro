import bcrypt from "bcryptjs";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function hashApiKey(apiKey: string) {
  return bcrypt.hashSync(apiKey, 10);
}

export function verifyApiKey(apiKey: string, hash: string) {
  return bcrypt.compareSync(apiKey, hash);
}
