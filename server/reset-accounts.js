// 기본 계정(admin/manager/member)의 비밀번호를 알려진 값으로 재설정하고
// 기기 등록(device_hash)을 초기화합니다. 기존 프로젝트/데이터는 보존됩니다.
// 사용: 서버를 먼저 종료한 뒤 reset-accounts.cmd 더블클릭 (또는 node reset-accounts.js)
import bcrypt from 'bcryptjs';
import sqlite3pkg from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const sqlite3 = sqlite3pkg.verbose();
const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, 'local.db');

const accounts = [
  ['admin', 'admin123'],
  ['manager', 'manager123'],
  ['member', 'member123'],
];

const db = new sqlite3.Database(dbPath);
const run = (sql, params = []) =>
  new Promise((res, rej) => db.run(sql, params, function (e) { e ? rej(e) : res(this); }));

(async () => {
  console.log('DB:', dbPath);
  for (const [username, password] of accounts) {
    const hash = await bcrypt.hash(password, 10);
    const r = await run(
      "UPDATE users SET password_hash = ?, device_hash = NULL, status = 'active', force_password_change = 0 WHERE username = ?",
      [hash, username]
    );
    console.log(`  ${username}: ${r.changes} row updated -> password "${password}", device reset`);
  }
  // 다중 기기 테이블이 있으면 함께 정리 (없으면 무시)
  await run("DELETE FROM user_devices").catch(() => {});
  db.close();
  console.log('\nDONE. Now start the server (start-server.cmd) and log in.');
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
