// AES-256-GCM encryption for at-rest secrets (LLM API keys etc.) stored in the
// database. Never log encrypted values, never log decrypted values, never
// return decrypted values to the client.
//
// Storage format (base64-encoded, single string):
//   [ 12-byte IV ][ 16-byte auth tag ][ N-byte ciphertext ]
//
// The key is derived from process.env.ENCRYPTION_KEY via SHA-256 so the env
// var doesn't need to be exactly 32 bytes — just long enough to have decent
// entropy. Rotate by changing ENCRYPTION_KEY *only* in tandem with a backfill
// that re-encrypts every stored value, or you'll silently break decrypt().

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

const ALGO = 'aes-256-gcm'
const IV_LEN = 12
const TAG_LEN = 16

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) {
    throw new Error('ENCRYPTION_KEY is not set — cannot encrypt/decrypt secrets')
  }
  return createHash('sha256').update(raw).digest()
}

export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGO, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

// Returns null on any failure (bad ciphertext, wrong key, tampered data) so
// callers can degrade gracefully instead of crashing on decrypt errors.
export function decrypt(ciphertext: string): string | null {
  try {
    const buf = Buffer.from(ciphertext, 'base64')
    if (buf.length < IV_LEN + TAG_LEN) return null

    const iv = buf.subarray(0, IV_LEN)
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN)
    const encrypted = buf.subarray(IV_LEN + TAG_LEN)

    const key = getKey()
    const decipher = createDecipheriv(ALGO, key, iv)
    decipher.setAuthTag(tag)
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
    return decrypted.toString('utf8')
  } catch {
    return null
  }
}
