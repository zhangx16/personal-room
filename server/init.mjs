import { openDatabase } from './db.mjs';
import { passwordHash } from './security.mjs';
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve,join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runtimeConfig } from './config.mjs';
export function initializeAdmin(config=runtimeConfig()) {
  const {db}=openDatabase(config.directory);
  try {
    if(db.prepare('SELECT id FROM admin').get()) return false;
    const password=randomBytes(24).toString('base64url');
    const credentialFile=join(config.directory,'initial-admin.txt');
    writeFileSync(credentialFile,`用户名：${config.username}\n密码：${password}\n首次登录必须绑定 TOTP 验证器。登录后请修改密码，并删除本文件。\n`,{mode:0o600,flag:'wx'});
    db.prepare('INSERT INTO admin(id,username,password) VALUES(1,?,?)').run(config.username,passwordHash(password));
    console.log(`管理员已初始化。初始凭据：${credentialFile}（0600）。`);
    return true;
  } finally { db.close(); }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  if(!initializeAdmin()) console.log('管理员已存在，保留现有账号、密码和 2FA。');
}
