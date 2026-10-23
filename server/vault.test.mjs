import test from 'node:test';
import assert from 'node:assert/strict';
import { seal,unseal } from '../src/lib/vault.ts';

test('vault encryption uses a fresh salt and IV; wrong passwords and modified ciphertext fail',async()=>{
  const phrase='correct horse battery staple';const plain='test-token-not-a-real-secret';
  const a=await seal(plain,phrase),b=await seal(plain,phrase);
  assert.notEqual(a.salt,b.salt);assert.notEqual(a.iv,b.iv);assert.notEqual(a.ciphertext,b.ciphertext);
  assert.equal(await unseal(a,phrase),plain);
  assert.equal(JSON.stringify(a).includes(plain),false);
  await assert.rejects(unseal(a,'incorrect password'));
  const bytes=Uint8Array.from(atob(a.ciphertext),c=>c.charCodeAt(0));bytes[0]^=1;
  await assert.rejects(unseal({...a,ciphertext:btoa(String.fromCharCode(...bytes))},phrase));
  await assert.rejects(seal(plain,'short'));
});
