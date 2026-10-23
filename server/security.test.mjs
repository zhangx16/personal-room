import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { openDatabase } from './db.mjs';
import { createApp } from './index.mjs';
import { passwordHash, checkPassword, base32, totp, verifyTotp, decrypt } from './security.mjs';
import { validRecord } from './validate.mjs';

test('TOTP follows RFC 6238 SHA-1 vector and rejects a reused time step',()=>{
  const secret=base32(Buffer.from('12345678901234567890'));
  assert.equal(totp(secret,1),'287082');
  assert.equal(verifyTotp(secret,'287082',-1,59000),1);
  assert.equal(verifyTotp(secret,'287082',1,59000),null);
  assert.equal(verifyTotp(secret,'287083',-1,59000),null);
});
test('password storage is salted and verifies only the correct password',()=>{
  const a=passwordHash('a secure test password'),b=passwordHash('a secure test password');
  assert.notEqual(a,b);assert.equal(checkPassword('a secure test password',a),true);assert.equal(checkPassword('wrong',a),false);
});
function fixture(t){
  const directory=mkdtempSync(join(tmpdir(),'dev-room-test-'));
  const {db,master}=openDatabase(directory);let clock=Date.UTC(2026,9,23,12,0,1);
  db.prepare('INSERT INTO admin(id,username,password) VALUES(1,?,?)').run('admin',passwordHash('secure-test-password'));
  const origin='https://room.example.test';const handle=createApp({db,master,origin,now:()=>clock});
  t.after(()=>{db.close();rmSync(directory,{recursive:true,force:true});});
  const request=(path,body,cookie='',overrides={})=>new Request(origin+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Origin:origin,Cookie:cookie,...overrides},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const call=(path,body,cookie='',overrides={})=>handle(request(path,body,cookie,overrides),'test-ip');
  async function enroll(){
    const login=await call('login',{username:'admin',password:'secure-test-password'});assert.equal(login.status,200);
    const setupCookie=login.headers.get('set-cookie').split(';')[0];const setup=await login.json();
    assert.equal(setup.setupRequired,true);
    const finish=await call('setup-2fa',{code:totp(setup.secret,Math.floor(clock/30000))},setupCookie);assert.equal(finish.status,200);
    const cookie=finish.headers.get('set-cookie').split(';')[0];const body=await finish.json();
    return {cookie,secret:setup.secret,codes:body.recoveryCodes};
  }
  return {db,master,call,request,handle,enroll,tick:ms=>{clock+=ms;},time:()=>clock};
}
test('first login cannot access records until TOTP enrollment; setup secret is encrypted at rest',async t=>{
  const f=fixture(t);
  assert.equal((await f.call('records')).status,401);
  const setup=await f.call('login',{username:'admin',password:'secure-test-password'});const secret=(await setup.json()).secret;
  const cookie=setup.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=Strict/);
  assert.equal((await f.call('records',undefined,cookie)).status,401);
  assert.equal((await f.call('setup-2fa',{code:'123456'})).status,401);
  assert.notEqual(f.db.prepare('SELECT secret FROM pending').get().secret,secret);
  const enrolled=await f.enroll();const admin=f.db.prepare('SELECT totp FROM admin').get();assert.equal(decrypt(admin.totp,f.master),enrolled.secret);
  assert.equal((await f.call('me',undefined,enrolled.cookie)).status,200);
});
test('password login requires an unused TOTP or single-use recovery code',async t=>{
  const f=fixture(t);const {secret,codes}=await f.enroll();
  assert.equal((await f.call('login',{username:'admin',password:'secure-test-password',code:''})).status,401);
  assert.equal((await f.call('login',{username:'admin',password:'secure-test-password',code:totp(secret,Math.floor(f.time()/30000))})).status,401);
  f.tick(30000);
  assert.equal((await f.call('login',{username:'admin',password:'secure-test-password',code:totp(secret,Math.floor(f.time()/30000))})).status,200);
  assert.equal((await f.call('login',{username:'admin',password:'secure-test-password',code:codes[0]})).status,200);
  assert.equal((await f.call('login',{username:'admin',password:'secure-test-password',code:codes[0]})).status,401);
});
test('cross-origin writes are rejected; logout and expiry invalidate sessions',async t=>{
  const f=fixture(t);const {cookie,codes}=await f.enroll();
  assert.equal((await f.call('logout',{},cookie,{Origin:'https://evil.example'})).status,403);
  assert.equal((await f.call('me',undefined,cookie)).status,200);
  assert.equal((await f.call('logout',{},cookie)).status,200);
  assert.equal((await f.call('me',undefined,cookie)).status,401);
  const fresh=await f.call('login',{username:'admin',password:'secure-test-password',code:codes[0]});
  assert.equal(fresh.status,200);
  const newCookie=fresh.headers.get('set-cookie').split(';')[0];
  f.tick(8*3600000+1);
  assert.equal((await f.call('me',undefined,newCookie)).status,401);
});
test('records enforce validation and optimistic versions; plaintext secret fields cannot slip in',async t=>{
  const f=fixture(t);const {cookie}=await f.enroll();
  const record={id:randomUUID(),kind:'project',title:'门户网站',description:'进度',url:'https://example.com',github:'',adminUrl:'',tags:['个人'],status:'active',favorite:true,order:0,content:'',environment:'',sessions:[{id:randomUUID(),title:'开发',thread:'01a16396-4d3c-7800-a4ae-310f1d097f01',directory:'/root/project',progress:'完成首页',next:'添加搜索'}],username:'',relatedProject:'',secret:null,updatedAt:new Date().toISOString(),version:0};
  assert.equal(validRecord(record),true);
  const first=await f.call('records',record,cookie);assert.equal(first.status,200);const saved=await first.json();assert.equal(saved.version,1);
  assert.equal((await f.call('records',record,cookie)).status,409);
  assert.equal((await f.call('records',{...saved,title:'修改'},cookie)).status,200);
  assert.equal((await f.call('records',{...saved,title:'覆盖旧版本'},cookie)).status,409);
  assert.equal((await f.call('records',{...record,id:randomUUID(),url:'javascript:alert(1)'},cookie)).status,400);
  assert.equal((await f.call('records',{...record,id:randomUUID(),kind:'secret',content:'plaintext-key',sessions:[]},cookie)).status,400);
  assert.equal((await f.call('records',{...record,id:randomUUID(),plaintext:'bad'},cookie)).status,400);
  const rows=await (await f.call('records',undefined,cookie)).json();assert.equal(rows.length,1);assert.equal(rows[0].title,'修改');
  assert.equal((await f.handle(new Request('https://room.example.test/api/records?id='+record.id+'&version=1',{method:'DELETE',headers:{Origin:'https://room.example.test',Cookie:cookie}}))).status,409);
  assert.equal((await f.handle(new Request('https://room.example.test/api/records?id='+record.id+'&version=2',{method:'DELETE',headers:{Origin:'https://room.example.test',Cookie:cookie}}))).status,200);
});
test('invalid passkey attempts cannot authenticate and login rate limits persist in SQLite',async t=>{
  const f=fixture(t);
  assert.equal((await f.call('passkey/verify',{id:'unregistered'})).status,401);
  for(let i=0;i<8;i++)assert.equal((await f.call('login',{username:'admin',password:'wrong'})).status,401);
  assert.equal((await f.call('login',{username:'admin',password:'wrong'})).status,429);
  assert.ok(f.db.prepare('SELECT count FROM limits WHERE key=?').get('login:test-ip').count>8);
});
test('Emby managed keys require login and remain stable per account',async t=>{
  const f=fixture(t);const id=randomUUID();
  assert.equal((await f.call('emby-key',{id})).status,401);
  const {cookie}=await f.enroll();
  const first=await (await f.call('emby-key',{id},cookie)).json();
  const again=await (await f.call('emby-key',{id},cookie)).json();
  const other=await (await f.call('emby-key',{id:randomUUID()},cookie)).json();
  assert.equal(first.key,again.key);assert.notEqual(first.key,other.key);
  assert.equal((await f.call('emby-key',{id:'invalid'},cookie)).status,400);
});
