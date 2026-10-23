import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
export function openDatabase(directory) {
  mkdirSync(directory,{recursive:true,mode:0o700});chmodSync(directory,0o700);
  const keyPath=join(directory,'server.key');
  if(!existsSync(keyPath)) writeFileSync(keyPath,randomBytes(32),{mode:0o600,flag:'wx'});
  const master=readFileSync(keyPath); if(master.length!==32) throw Error('Invalid server encryption key');
  const path=join(directory,'portal.sqlite'); const db=new DatabaseSync(path);chmodSync(path,0o600);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS admin (id INTEGER PRIMARY KEY CHECK(id=1), username TEXT NOT NULL, password TEXT NOT NULL, totp TEXT, last_step INTEGER NOT NULL DEFAULT -1);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS pending (token TEXT PRIMARY KEY, secret TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS recovery (hash TEXT PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, payload TEXT NOT NULL, version INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS passkeys (id TEXT PRIMARY KEY, public_key TEXT NOT NULL, counter INTEGER NOT NULL, transports TEXT NOT NULL, name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS challenges (token TEXT PRIMARY KEY, kind TEXT NOT NULL, challenge TEXT NOT NULL, session TEXT, expires INTEGER NOT NULL);
  `);
  return { db, master };
}
