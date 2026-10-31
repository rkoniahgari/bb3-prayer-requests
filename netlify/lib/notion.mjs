// Shared helpers for talking to Notion and checking who is asking.
const API = "https://api.notion.com/v1";
export const REQUESTS_DB = process.env.REQUESTS_DB || "a6df3e46824040d2b752ab19497fb0eb";
export const MEMBERS_DB = process.env.MEMBERS_DB || "f808ba54207640bf973ee98d707b58bc";

export async function notion(path, method = "GET", body) {
  const res = await fetch(API + path, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Notion ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function queryAll(db, body = {}) {
  const rows = [];
  let cursor;
  do {
    const page = await notion(`/databases/${db}/query`, "POST", { page_size: 100, start_cursor: cursor, ...body });
    rows.push(...page.results);
    cursor = page.has_more ? page.next_cursor : undefined;
  } while (cursor);
  return rows;
}

// "member" for the group link, "manager" for Lisa's and Rebecca's link, otherwise null.
export function role(request) {
  const key = request.headers.get("x-group-key") || "";
  if (key && key === process.env.MANAGER_PATH) return "manager";
  if (key && key === process.env.MEMBER_PATH) return "member";
  return null;
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" },
  });
}

export const denied = () => json({ error: "This page is private." }, 403);

export async function readBody(request) {
  try { return await request.json(); } catch { return {}; }
}

export const clean = (s, max) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);
export const plain = (prop) => ((prop && (prop.title || prop.rich_text)) || []).map((t) => t.plain_text).join("").trim();
export const day = (prop) => (prop && prop.date && prop.date.start ? prop.date.start.slice(0, 10) : null);
export const text = (s) => [{ type: "text", text: { content: String(s).slice(0, 2000) } }];
export const todayET = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
const bare = (id) => String(id || "").replace(/-/g, "");

// Make sure a page id really is a row in the prayer requests database before changing it.
export async function requestRow(id) {
  if (!/^[0-9a-f-]{32,36}$/i.test(String(id || ""))) return null;
  const page = await notion(`/pages/${id}`);
  return page.parent && bare(page.parent.database_id) === bare(REQUESTS_DB) ? page : null;
}

export function toItem(row) {
  const p = row.properties;
  const kind = p.Type && p.Type.select && p.Type.select.name === "Praise report" ? "praise" : "request";
  const status = (p.Status && p.Status.select && p.Status.select.name) || "Praying";
  const added = day(p["Study date"]) || row.created_time.slice(0, 10);
  return {
    id: row.id,
    name: plain(p.Person) || "Someone",
    kind,
    text: plain(p.Request),
    added,
    answered: kind === "request" && status === "Answered" ? day(p["Answered date"]) || added : null,
    note: plain(p["How it was answered"]),
    source: /^website/i.test(plain(p.Source)) ? "web" : "study",
    hidden: !(p["Show on page"] && p["Show on page"].checkbox),
    archived: status === "Archived",
  };
}
