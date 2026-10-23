import { z } from "zod";

const webAddress = z.string().max(2048).refine(value => {
  if (!value) return true;
  try { return ["https:", "http:"].includes(new URL(value).protocol); } catch { return false; }
}, "请输入 http 或 https 地址");
export const sessionSchema = z.object({
  id: z.string().uuid(), title: z.string().min(1).max(120),
  thread: z.string().regex(/^[a-zA-Z0-9-]{8,100}$/, "会话编号只能包含字母、数字和连字符"),
  directory: z.string().max(500), progress: z.string().max(4000), next: z.string().max(4000),
}).strict();
export const recordSchema = z.object({
  id: z.string().uuid(), kind: z.enum(["project", "link", "script", "secret", "emby"]),
  title: z.string().trim().min(1, "请输入名称").max(120),
  description: z.string().max(4000), url: webAddress, github: webAddress, adminUrl: webAddress,
  tags: z.array(z.string().max(40)).max(12), status: z.enum(["active", "paused", "done"]),
  favorite: z.boolean(), order: z.number().int().min(0).max(1000000),
  content: z.string().max(50000), environment: z.string().max(300),
  sessions: z.array(sessionSchema).max(100),
  username: z.string().max(300), relatedProject: z.string().max(120),
  secret: z.object({ salt: z.string().max(100), iv: z.string().max(100), ciphertext: z.string().max(12000) }).strict().nullable(),
  updatedAt: z.string().datetime(), version: z.number().int().nonnegative(),
}).strict();
export type PortalRecord = z.infer<typeof recordSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type Kind = PortalRecord["kind"];
export const kindLabel = { project: "项目", link: "网站", script: "脚本", secret: "密钥", emby: "Emby 账号" };
export function emptyRecord(kind: Kind): PortalRecord {
  return { id: crypto.randomUUID(), kind, title: "", description: "", url: "", github: "", adminUrl: "", tags: [], status: "active", favorite: false, order: 0, content: "", environment: "", sessions: [], username: "", relatedProject: "", secret: null, updatedAt: new Date().toISOString(), version: 0 };
}
export function resumeCommand(session: Session) { return `codex resume ${session.thread}`; }
export function searchText(record: PortalRecord) {
  return [record.title, record.description, record.url, record.github, record.environment, record.content, ...record.tags,
    ...record.sessions.flatMap(s => [s.title, s.thread, s.directory, s.progress, s.next])].join(" ").toLowerCase();
}
