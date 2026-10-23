import { openDatabase } from './db.mjs';
import { passwordHash } from './security.mjs';
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve,join } from 'node:path';
const directory=resolve(process.env.PORTAL_DATA_DIR||'data'); const {db}=openDatabase(directory);
if(db.prepare('SELECT id FROM admin').get()) { console.error('管理员已存在，未修改账号。');process.exitCode=1; }
else {
  const password=randomBytes(24).toString('base64url');
  db.prepare('INSERT INTO admin(id,username,password) VALUES(1,?,?)').run('admin',passwordHash(password));
  writeFileSync(join(directory,'initial-admin.txt'),`用户名：admin（英文 admin）\n密码：${password}\n首次登录必须绑定 TOTP 验证器。登录后请修改密码，并删除本文件。\n`,{mode:0o600,flag:'wx'});
  console.log(`管理员已初始化。初始凭据保存在 ${join(directory,'initial-admin.txt')}，权限 0600。`);
}
db.close();
