import { randomBytes, createHash, createHmac, timingSafeEqual, scryptSync, createCipheriv, createDecipheriv } from 'node:crypto';
export const hash = text => createHash('sha256').update(text).digest('hex');
export const token = () => randomBytes(32).toString('base64url');
export function passwordHash(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
export function checkPassword(password, stored) {
  try { const [salt, hex] = stored.split(':'); const candidate = scryptSync(password, salt, 64); const expected = Buffer.from(hex, 'hex'); return expected.length === candidate.length && timingSafeEqual(expected, candidate); } catch { return false; }
}
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32(bytes) {
  let acc=0, bits=0, out='';
  for (const b of bytes) { acc=(acc<<8)|b; bits+=8; while(bits>=5) { bits-=5; out+=alphabet[(acc>>>bits)&31]; } }
  if(bits) out+=alphabet[(acc<<(5-bits))&31]; return out;
}
function unbase32(text) {
  let acc=0,bits=0; const out=[];
  for(const c of text.replace(/=+$/, '').toUpperCase()) { const n=alphabet.indexOf(c); if(n<0) throw Error('invalid secret'); acc=(acc<<5)|n;bits+=5;if(bits>=8){bits-=8;out.push((acc>>>bits)&255);} } return Buffer.from(out);
}
export function totp(secret, step = Math.floor(Date.now()/30000)) {
  const counter=Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(step));
  const digest=createHmac('sha1', unbase32(secret)).update(counter).digest(); const offset=digest[19]&15;
  return ((digest.readUInt32BE(offset)&0x7fffffff)%1000000).toString().padStart(6,'0');
}
export function verifyTotp(secret, code, lastStep = -1, now=Date.now()) {
  if(!/^\d{6}$/.test(code)) return null;
  const current=Math.floor(now/30000);
  for(const offset of [0,-1,1]) { const step=current+offset; if(step>lastStep && timingSafeEqual(Buffer.from(totp(secret,step)),Buffer.from(code))) return step; }
  return null;
}
export function encrypt(text, master) {
  const iv=randomBytes(12); const cipher=createCipheriv('aes-256-gcm',master,iv);
  const data=Buffer.concat([cipher.update(text,'utf8'),cipher.final()]);
  return [iv.toString('base64'),cipher.getAuthTag().toString('base64'),data.toString('base64')].join('.');
}
export function decrypt(value, master) {
  const [iv,tag,data]=value.split('.').map(x=>Buffer.from(x,'base64'));
  const cipher=createDecipheriv('aes-256-gcm',master,iv);cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(data),cipher.final()]).toString('utf8');
}
