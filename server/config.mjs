import { resolve } from 'node:path';
export function runtimeConfig(env = process.env) {
  const port = Number(env.PORT || 22836);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT 必须是 1–65535 的端口号');
  let url;
  try { url = new URL(env.PORTAL_ORIGIN || `http://localhost:${port}`); } catch { throw new Error('PORTAL_ORIGIN 必须是完整的访问地址'); }
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash || !['https:', 'http:'].includes(url.protocol)) throw new Error('PORTAL_ORIGIN 只允许协议、域名和可选端口');
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('生产访问地址必须使用 HTTPS；HTTP 仅用于 localhost 调试');
  const siteName = (env.PORTAL_SITE_NAME || 'Dev Room').trim();
  if (!siteName || siteName.length > 60 || /[\r\n\x00]/.test(siteName)) throw new Error('PORTAL_SITE_NAME 需要 1–60 个字符');
  const username = env.PORTAL_ADMIN_USERNAME || 'admin';
  if (!/^[A-Za-z0-9_.@-]{3,64}$/.test(username)) throw new Error('PORTAL_ADMIN_USERNAME 需要 3–64 个字母、数字或 _.@-');
  return { port, host: env.HOST || '127.0.0.1', origin: url.origin, siteName, username, directory: resolve(env.PORTAL_DATA_DIR || 'data') };
}
