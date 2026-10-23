import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runtimeConfig } from './config.mjs';
import { initializeAdmin } from './init.mjs';
import { openDatabase } from './db.mjs';
import { createApp } from './index.mjs';

test('origin configuration rejects credentials, paths and insecure public addresses',()=>{
  for(const origin of ['https://user:pass@example.com','https://example.com/subpath','http://example.com','https://example.com?key=x','not-a-url'])assert.throws(()=>runtimeConfig({PORTAL_ORIGIN:origin}));
  assert.equal(runtimeConfig({PORT:'3100'}).origin,'http://localhost:3100');
  assert.equal(runtimeConfig({PORTAL_ORIGIN:'https://my-room.example/'}).origin,'https://my-room.example');
  assert.throws(()=>runtimeConfig({PORT:'0'}));
});
test('independent installations have unique credentials and keys; restarts preserve the account',async t=>{
  const root=mkdtempSync(join(tmpdir(),'personal-room-config-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const configs=['alice','bob'].map((username,i)=>runtimeConfig({PORTAL_ORIGIN:`https://room${i}.example`,PORTAL_SITE_NAME:`Room ${i}`,PORTAL_ADMIN_USERNAME:username,PORTAL_DATA_DIR:join(root,username)}));
  for(const config of configs)assert.equal(initializeAdmin(config),true);
  const first=readFileSync(join(configs[0].directory,'initial-admin.txt'),'utf8');
  assert.match(first,/alice/);assert.notEqual(first,readFileSync(join(configs[1].directory,'initial-admin.txt'),'utf8'));
  assert.notDeepEqual(readFileSync(join(configs[0].directory,'server.key')),readFileSync(join(configs[1].directory,'server.key')));
  assert.equal(initializeAdmin({...configs[0],username:'changed'}),false);
  assert.equal(first,readFileSync(join(configs[0].directory,'initial-admin.txt'),'utf8'));
  const {db,master}=openDatabase(configs[0].directory);t.after(()=>db.close());
  assert.equal(db.prepare('SELECT username FROM admin').get().username,'alice');
  const handle=createApp({db,master,origin:configs[0].origin,siteName:configs[0].siteName});
  const response=await handle(new Request(configs[0].origin+'/api/config'));
  assert.deepEqual(await response.json(),{siteName:'Room 0'});
});
