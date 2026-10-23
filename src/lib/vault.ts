// Encryption happens in the browser. Neither passphrase nor plaintext is sent to the server.
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const decode = (value: string) => Uint8Array.from(atob(value), c => c.charCodeAt(0));
async function key(passphrase: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", iterations: 600000, salt: salt as BufferSource }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
export async function seal(plaintext: string, passphrase: string) {
  if (passphrase.length < 12) throw new Error("加密口令至少需要 12 个字符");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(passphrase, salt), new TextEncoder().encode(plaintext));
  return { salt: encode(salt), iv: encode(iv), ciphertext: encode(new Uint8Array(ciphertext)) };
}
export async function unseal(secret: { salt: string; iv: string; ciphertext: string }, passphrase: string) {
  const result = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(secret.iv) }, await key(passphrase, decode(secret.salt)), decode(secret.ciphertext));
  return new TextDecoder().decode(result);
}
