import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomBytes, createHmac } from 'node:crypto';
import { openDatabase } from './db.mjs';
import { hash, token, passwordHash, checkPassword, base32, verifyTotp, encrypt, decrypt } from './security.mjs';
import { validRecord } from './validate.mjs';
import { runtimeConfig } from './config.mjs';

const headers={ 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'no-referrer', 'X-Frame-Options':'DENY', 'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'" };
const reply=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8',...extra}});
export function createApp({db,master,origin='http://localhost:22836',siteName='Dev Room',dist=resolve('dist'),now=()=>Date.now()}) {
  const cookie=(name,value,maxAge)=>`${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
  const cookies=request=>Object.fromEntries((request.headers.get('cookie')||'').split(';').map(v=>v.trim().split('=')));
  function throttle(key,max=8,window=15*60*1000) {
    const time=now();
    db.prepare('INSERT INTO limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires<=? THEN 1 ELSE count+1 END, expires=CASE WHEN expires<=? THEN excluded.expires ELSE expires END').run(key,time+window,time,time);
    return db.prepare('SELECT count FROM limits WHERE key=?').get(key).count>max;
  }
  function authorized(request) { const value=cookies(request).__Host_room;return value && db.prepare('SELECT token FROM sessions WHERE token=? AND expires>?').get(hash(value),now()); }
  const issueSession=()=>{const value=token();db.prepare('INSERT INTO sessions(token,expires) VALUES(?,?)').run(hash(value),now()+8*3600000);return cookie('__Host_room',value,8*3600);};
  function verifyAdminFactor(admin,code) {
    if(!admin?.totp) return false;
    const step=verifyTotp(decrypt(admin.totp,master),String(code||''),admin.last_step,now());
    if(step!==null) return db.prepare('UPDATE admin SET last_step=? WHERE id=1 AND last_step<?').run(step,step).changes===1;
    return db.prepare('DELETE FROM recovery WHERE hash=?').run(hash(String(code||'').replace(/\s/g,'').toUpperCase())).changes===1;
  }
  return async function handle(request,ip='local') {
    try {
      const url=new URL(request.url); const path=url.pathname;
      if(path==='/api/health') return reply({ok:true});
      if(path==='/api/config' && request.method==='GET') return reply({siteName});
      if(path.startsWith('/api/')) {
        if(!['GET','POST','DELETE'].includes(request.method)) return reply({error:'请求方法不支持'},405);
        if(request.method!=='GET' && request.headers.get('origin')!==origin) return reply({error:'请求来源无效'},403);
        let body={};
        if(request.method==='POST') {
          if(!request.headers.get('content-type')?.startsWith('application/json')) return reply({error:'请使用 JSON 请求'},415);
          const text=await request.text();if(Buffer.byteLength(text)>120000) return reply({error:'记录过大'},413);
          try{body=JSON.parse(text);}catch{return reply({error:'数据格式无效'},400);}
          if(!body||typeof body!=='object'||Array.isArray(body)) return reply({error:'数据格式无效'},400);
        }
        if(path==='/api/login' && request.method==='POST') {
          if(throttle(`login:${ip}`)) return reply({error:'尝试过于频繁，请 15 分钟后重试'},429);
          const admin=db.prepare('SELECT * FROM admin WHERE id=1').get();
          if(!admin) return reply({error:'管理员尚未初始化'},503);
          if(typeof body.password!=='string'||body.password.length>1000||body.username!==admin.username||!checkPassword(body.password,admin.password)) return reply({error:'账号、密码或验证码不正确'},401);
          if(!admin.totp) {
            const secret=base32(randomBytes(20)), value=token();
            db.prepare('DELETE FROM pending WHERE expires<=?').run(now());
            db.prepare('INSERT INTO pending(token,secret,expires) VALUES(?,?,?)').run(hash(value),encrypt(secret,master),now()+5*60000);
            return reply({setupRequired:true,secret,uri:`otpauth://totp/${encodeURIComponent(siteName)}:${encodeURIComponent(admin.username)}?secret=${secret}&issuer=${encodeURIComponent(siteName)}&algorithm=SHA1&digits=6&period=30`},200,{'Set-Cookie':cookie('__Host_room_setup',value,300)});
          }
          if(!verifyAdminFactor(admin,body.code)) return reply({error:'账号、密码或验证码不正确'},401);
          db.prepare('DELETE FROM limits WHERE key=?').run(`login:${ip}`);
          return reply({ok:true},200,{'Set-Cookie':issueSession()});
        }
        if(path==='/api/setup-2fa' && request.method==='POST') {
          if(throttle(`setup:${ip}`,8,300000)) return reply({error:'验证尝试过于频繁'},429);
          const value=cookies(request).__Host_room_setup;
          const pending=value&&db.prepare('SELECT * FROM pending WHERE token=? AND expires>?').get(hash(value),now());
          if(!pending) return reply({error:'绑定会话已过期，请重新登录'},401);
          const step=verifyTotp(decrypt(pending.secret,master),String(body.code||''),-1,now());
          if(step===null) return reply({error:'验证码无效，请检查验证器时间'},400);
          const codes=Array.from({length:10},()=>randomBytes(8).toString('hex').toUpperCase());
          db.exec('BEGIN IMMEDIATE');
          try {
            if(db.prepare('UPDATE admin SET totp=?,last_step=? WHERE id=1 AND totp IS NULL').run(pending.secret,step).changes!==1) { db.exec('ROLLBACK');return reply({error:'2FA 已绑定，请重新登录'},409); }
            for(const code of codes) db.prepare('INSERT INTO recovery(hash) VALUES(?)').run(hash(code));
            db.prepare('DELETE FROM pending').run();db.exec('COMMIT');
          }catch(error){db.exec('ROLLBACK');throw error;}
          return reply({ok:true,recoveryCodes:codes},200,{'Set-Cookie':issueSession()});
        }
        if(path==='/api/passkey/options' && request.method==='POST') {
          if(throttle(`passkey:${ip}`,30,300000))return reply({error:'尝试过于频繁'},429);
          const {generateAuthenticationOptions}=await import('@simplewebauthn/server');
          const keys=db.prepare('SELECT id,transports FROM passkeys').all();
          if(!keys.length)return reply({error:'请先通过密码和 2FA 登录，在安全设置中添加通行密钥'},400);
          const options=await generateAuthenticationOptions({rpID:new URL(origin).hostname,userVerification:'required',allowCredentials:keys.map(k=>({id:k.id,transports:JSON.parse(k.transports)}))});
          const value=token();db.prepare('INSERT INTO challenges(token,kind,challenge,expires) VALUES(?,?,?,?)').run(hash(value),'authenticate',options.challenge,now()+180000);
          return reply(options,200,{'Set-Cookie':cookie('__Host_room_webauthn',value,180)});
        }
        if(path==='/api/passkey/verify' && request.method==='POST') {
          if(throttle(`passkey-verify:${ip}`,30,300000))return reply({error:'尝试过于频繁'},429);
          const challengeToken=hash(cookies(request).__Host_room_webauthn||'');
          const challenge=db.prepare('DELETE FROM challenges WHERE token=? AND kind=? AND expires>? RETURNING *').get(challengeToken,'authenticate',now());
          const saved=typeof body.id==='string'&&db.prepare('SELECT * FROM passkeys WHERE id=?').get(body.id);
          if(!challenge||!saved)return reply({error:'设备验证会话已失效，请重试'},401);
          try {
            const {verifyAuthenticationResponse}=await import('@simplewebauthn/server');
            const result=await verifyAuthenticationResponse({response:body,expectedChallenge:challenge.challenge,expectedOrigin:origin,expectedRPID:new URL(origin).hostname,requireUserVerification:true,credential:{id:saved.id,publicKey:new Uint8Array(Buffer.from(saved.public_key,'base64')),counter:saved.counter,transports:JSON.parse(saved.transports)}});
            if(!result.verified)return reply({error:'设备验证失败'},401);
            const updated=db.prepare('UPDATE passkeys SET counter=? WHERE id=? AND counter=?').run(result.authenticationInfo.newCounter,saved.id,saved.counter);
            if(!updated.changes)return reply({error:'设备状态已更新，请重试'},409);
            return reply({ok:true},200,{'Set-Cookie':issueSession()});
          }catch{return reply({error:'设备验证失败'},401);}
        }
        if(!authorized(request)) return reply({error:'登录已过期，请重新登录'},401);
        if(path==='/api/emby-key' && request.method==='POST') {
          if(typeof body.id!=='string'||!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(body.id)) return reply({error:'账号编号无效'},400);
          const existing=db.prepare('SELECT payload FROM records WHERE id=?').get(body.id);
          if(existing&&JSON.parse(existing.payload).kind!=='emby')return reply({error:'账号类型无效'},400);
          return reply({key:createHmac('sha256',master).update('emby-account-v1:'+body.id.toLowerCase()).digest('base64url')});
        }
        if(path==='/api/passkeys'&&request.method==='GET')return reply(db.prepare('SELECT id,name FROM passkeys').all());
        if(path==='/api/passkeys/register-options'&&request.method==='POST') {
          if(throttle(`register:${ip}`))return reply({error:'尝试过于频繁'},429);
          const admin=db.prepare('SELECT * FROM admin WHERE id=1').get();
          if(typeof body.password!=='string'||!checkPassword(body.password,admin.password)||!verifyAdminFactor(admin,body.code))return reply({error:'密码或验证码不正确'},401);
          const {generateRegistrationOptions}=await import('@simplewebauthn/server');
          const options=await generateRegistrationOptions({rpName:siteName,rpID:new URL(origin).hostname,userName:admin.username,userID:new TextEncoder().encode('dev-room-admin'),attestationType:'none',authenticatorSelection:{residentKey:'required',userVerification:'required',authenticatorAttachment:'platform'},excludeCredentials:db.prepare('SELECT id FROM passkeys').all().map(k=>({id:k.id}))});
          const value=token();db.prepare('INSERT INTO challenges(token,kind,challenge,session,expires) VALUES(?,?,?,?,?)').run(hash(value),'register',options.challenge,hash(cookies(request).__Host_room),now()+180000);
          return reply(options,200,{'Set-Cookie':cookie('__Host_room_webauthn',value,180)});
        }
        if(path==='/api/passkeys/register-verify'&&request.method==='POST') {
          const challenge=db.prepare('DELETE FROM challenges WHERE token=? AND kind=? AND session=? AND expires>? RETURNING *').get(hash(cookies(request).__Host_room_webauthn||''),'register',hash(cookies(request).__Host_room),now());
          if(!challenge)return reply({error:'绑定会话已失效'},401);
          try {
            const {verifyRegistrationResponse}=await import('@simplewebauthn/server');
            const {verified,registrationInfo}=await verifyRegistrationResponse({response:body.credential,expectedChallenge:challenge.challenge,expectedOrigin:origin,expectedRPID:new URL(origin).hostname,requireUserVerification:true});
            if(!verified||!registrationInfo)return reply({error:'设备绑定失败'},400);
            const {credential}=registrationInfo;
            db.prepare('INSERT INTO passkeys(id,public_key,counter,transports,name) VALUES(?,?,?,?,?)').run(credential.id,Buffer.from(credential.publicKey).toString('base64'),credential.counter,JSON.stringify(credential.transports||[]),String(body.name||'我的设备').slice(0,80));
            return reply({ok:true});
          }catch{return reply({error:'设备绑定失败，请重试'},400);}
        }
        if(path==='/api/passkeys/remove'&&request.method==='POST') {
          if(throttle(`remove-key:${ip}`))return reply({error:'尝试过于频繁'},429);
          const admin=db.prepare('SELECT * FROM admin WHERE id=1').get();
          if(typeof body.password!=='string'||!checkPassword(body.password,admin.password)||!verifyAdminFactor(admin,body.code))return reply({error:'密码或验证码不正确'},401);
          db.prepare('DELETE FROM passkeys WHERE id=?').run(String(body.id));db.prepare('DELETE FROM sessions').run();
          return reply({ok:true},200,{'Set-Cookie':issueSession()});
        }
        if(path==='/api/me' && request.method==='GET') { const admin=db.prepare('SELECT username FROM admin WHERE id=1').get();return reply({username:admin.username,twoFactorEnabled:true}); }
        if(path==='/api/logout' && request.method==='POST') { db.prepare('DELETE FROM sessions WHERE token=?').run(hash(cookies(request).__Host_room||''));return reply({ok:true},200,{'Set-Cookie':cookie('__Host_room','',0)}); }
        if(path==='/api/password' && request.method==='POST') {
          if(throttle(`password:${ip}`)) return reply({error:'尝试过于频繁'},429);
          const admin=db.prepare('SELECT * FROM admin WHERE id=1').get();
          if(typeof body.current!=='string'||!checkPassword(body.current,admin.password)||!verifyAdminFactor(admin,body.code)) return reply({error:'当前密码或验证码不正确'},400);
          if(typeof body.password!=='string'||body.password.length<12||body.password.length>200) return reply({error:'新密码需要 12–200 个字符'},400);
          db.prepare('UPDATE admin SET password=? WHERE id=1').run(passwordHash(body.password));
          db.prepare('DELETE FROM sessions').run();return reply({ok:true},200,{'Set-Cookie':issueSession()});
        }
        if(path==='/api/records' && request.method==='GET') return reply(db.prepare('SELECT payload,version FROM records').all().map(row=>({...JSON.parse(row.payload),version:row.version})));
        if(path==='/api/records' && request.method==='POST') {
          if(!validRecord(body)) return reply({error:'记录字段无效，请检查名称、网址和会话编号'},400);
          const record={...body,title:body.title.trim(),version:body.version+1,updatedAt:new Date(now()).toISOString()};
          const payload=JSON.stringify(record);
          const result=body.version===0?db.prepare('INSERT INTO records(id,payload,version) VALUES(?,?,1) ON CONFLICT(id) DO NOTHING').run(body.id,payload):db.prepare('UPDATE records SET payload=?,version=? WHERE id=? AND version=?').run(payload,record.version,record.id,body.version);
          return result.changes ? reply(record) : reply({error:'记录已在其他窗口更新，请刷新后重试'},409);
        }
        if(path==='/api/records' && request.method==='DELETE') {
          const id=url.searchParams.get('id'),version=Number(url.searchParams.get('version'));
          if(!id||!Number.isSafeInteger(version)||version<1)return reply({error:'删除参数无效'},400);
          const result=db.prepare('DELETE FROM records WHERE id=? AND version=?').run(id,version);
          return result.changes ? reply({ok:true}) : reply({error:'记录已更新，请刷新后重试'},409);
        }
        return reply({error:'接口不存在'},404);
      }
      if(!['GET','HEAD'].includes(request.method))return reply({error:'请求方法不支持'},405);
      const decoded=decodeURIComponent(path);let file=resolve(dist,`.${decoded}`);
      if(file!==dist&&!file.startsWith(dist+sep)) return reply({error:'路径无效'},400);
      if(decoded==='/'||!extname(decoded))file=resolve(dist,'index.html');
      const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png'};
      try {const content=await readFile(file);return new Response(request.method==='HEAD'?null:content,{headers:{...headers,'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':file.includes('/assets/')?'public,max-age=31536000,immutable':'no-store'}});}catch{return reply({error:'页面尚未构建或资源不存在'},404);}
    }catch {return reply({error:'服务暂时不可用，请重试'},500);}
  };
}
export function startServer(config=runtimeConfig()) {
  const {db,master}=openDatabase(config.directory);
  const {origin}=config;
  const handle=createApp({db,master,origin,siteName:config.siteName});
  const server=createServer(async(req,res)=>{
    const chunks=[];let size=0;
    for await(const chunk of req){size+=chunk.length;if(size>120000){res.writeHead(413);res.end('Request too large');return;}chunks.push(chunk);}
    const request=new Request(new URL(req.url,origin),{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)});
    const response=await handle(request,req.socket.remoteAddress==='127.0.0.1'?(req.headers['x-real-ip']||'local'):req.socket.remoteAddress);
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  });
  const timer=setInterval(()=>{const time=Date.now();for(const table of ['sessions','pending','limits','challenges'])db.prepare(`DELETE FROM ${table} WHERE expires<=?`).run(time);},300000);timer.unref();
  server.listen(config.port,config.host,()=>console.log(`${config.siteName} listening on ${config.host}:${config.port}`));
  process.once('SIGTERM',()=>server.close(()=>{db.close();process.exit(0);}));
  return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) startServer();
