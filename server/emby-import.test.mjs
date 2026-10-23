import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEmbyMessage } from '../src/lib/emby-import.mjs';
test('Emby message extracts credentials, expiry and deduplicated lines locally',()=>{
  const result=parseEmbyMessage('▎创建用户成功🎉\n· 用户名称 | example_user\n· 用户密码 | test-password\n· 安全密码 | test-safe-code（仅发送一次）\n· 到期时间 | __无需保号，放心食用__\n· 当前线路：\nhttps://media.example.com\nhttps://backup.example.com\nhttps://media.example.com');
  assert.deepEqual(result,{username:'example_user',password:'test-password',securityCode:'test-safe-code',expiry:'无需保号，放心食用',urls:['https://media.example.com','https://backup.example.com']});
});
test('Emby parser tolerates missing fields and full-width delimiters',()=>{
  assert.deepEqual(parseEmbyMessage('用户名：viewer\n安全码｜safe\n有效期：2027-01-01'),{username:'viewer',password:'',securityCode:'safe',expiry:'2027-01-01',urls:[]});
});
