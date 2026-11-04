// Shared helpers for talking to Notion and checking who is asking.
const API = "https://api.notion.com/v1";
export const REQUESTS_DB = process.env.REQUESTS_DB || "a6df3e46824040d2b752ab19497fb0eb";
export const MEMBERS_DB = process.env.MEMBERS_DB || "f808ba54207640bf973ee98d707b58bc";
export const INBOX_DB = process.env.INBOX_DB || "f9d78d0b73514a3eb7ccdc7eb057cb6b";

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

import { timingSafeEqual } from "node:crypto";

// Compare secrets in constant time, so response timing gives nothing away.
function same(a, b) {
  if (!a || !b) return false;
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

// "member" for the group link, "manager" for Lisa's and Rebecca's link, otherwise null.
export function role(request) {
  const key = request.headers.get("x-group-key") || "";
  if (same(key, process.env.MANAGER_PATH)) return "manager";
  if (same(key, process.env.MEMBER_PATH)) return "member";
  return null;
}

export const isId = (id) => /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(String(id || ""));

// Wrap a function so unexpected errors are logged on the server and answered with a plain message.
export function safe(handler) {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (err) {
      console.error(err);
      return json({ error: "Something went wrong. Please try again." }, 500);
    }
  };
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" },
  });
}

export const denied = () => json({ error: "This page is private." }, 403);

// Read a JSON body, refusing anything unreasonably large (a whole Zoom chat is well under this).
export async function readBody(request) {
  try {
    const raw = await request.text();
    if (raw.length > 60000) return {};
    return JSON.parse(raw);
  } catch { return {}; }
}

export const clean = (s, max) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);
export const plain = (prop) => ((prop && (prop.title || prop.rich_text)) || []).map((t) => t.plain_text).join("").trim();
export const day = (prop) => (prop && prop.date && prop.date.start ? prop.date.start.slice(0, 10) : null);
export const text = (s) => [{ type: "text", text: { content: String(s).slice(0, 2000) } }];
// Long text (like a whole Zoom chat) is stored in 2,000-character pieces, which is Notion's limit per piece.
export const longText = (s) => {
  const str = String(s).slice(0, 40000), out = [];
  for (let i = 0; i < str.length; i += 2000) out.push({ type: "text", text: { content: str.slice(i, i + 2000) } });
  return out;
};
export const todayET = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
const bare = (id) => String(id || "").replace(/-/g, "");

// Make sure a page id really is a row in the prayer requests database before changing it.
export async function requestRow(id) {
  if (!isId(id)) return null;
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
    markedNew: day(p["Marked new"]),
    // Members the name could be, when the chat wasn't clear (e.g. "Carol" → Carol G. or Carol W.).
    choices: plain(p["Name options"]).split(",").map((s) => s.trim()).filter(Boolean),
  };
}

// ---------- Safeguards: an activity log, and a speed limit on changes ----------
export const LOG_DB = process.env.LOG_DB || "cb5939603f1c4a4c8cbe0de5e80292d1";
const LINK = { member: "Member link", manager: "Manager link" };

// A short, readable copy of a request row, kept in the log so any change can be undone by hand.
export function describe(row) {
  if (!row) return "";
  const p = row.properties;
  const status = p.Status && p.Status.select ? p.Status.select.name : "";
  const shown = p["Show on page"] && p["Show on page"].checkbox === false ? ", hidden" : "";
  return `${plain(p.Person)}: ${plain(p.Request)} [${status}${shown}]`;
}

// If the log can't be reached (for example, not yet connected in Notion), stop trying for 10 minutes
// so saving stays fast.
let logDownUntil = 0;
const logDown = (err) => { logDownUntil = Date.now() + 10 * 60 * 1000; console.error("Activity log unreachable:", err.message); };

// Let a slow side job (like writing the log) finish after the person already has their answer.
export function later(context, promise) {
  if (context && typeof context.waitUntil === "function") context.waitUntil(promise);
  else return promise;
}

// Write one line to the Activity Log. Never stops the change itself if the log can't be reached.
export async function logChange(who, action, { summary, person = "", before = "", after = "", id = "" } = {}) {
  if (Date.now() < logDownUntil) return;
  try {
    await notion("/pages", "POST", {
      parent: { database_id: LOG_DB },
      properties: {
        "What happened": { title: text(String(summary || action).slice(0, 200)) },
        Action: { select: { name: action } },
        "Link used": { select: { name: LINK[who] || "Member link" } },
        Person: { rich_text: text(String(person).slice(0, 100)) },
        Before: { rich_text: longText(String(before).slice(0, 1900)) },
        After: { rich_text: longText(String(after).slice(0, 1900)) },
        "Row ID": { rich_text: text(String(id)) },
      },
    });
  } catch (err) {
    logDown(err);
  }
}

// How many of each kind of change one link may make in an hour. Normal use is far below this.
const LIMITS = {
  member: { remove: 10, add: 30 },
  manager: { remove: 40, add: 100 },
};
const GROUPS = {
  remove: ["Removed", "Hidden", "Edited", "Member removed"],
  add: ["Added", "Member added", "Chat pasted", "Answered", "Undo"],
};

// Returns a "please slow down" response if this link has made too many changes in the last hour.
export async function tooFast(who, group) {
  const limit = (LIMITS[who] || LIMITS.member)[group];
  const since = Date.now() - 60 * 60 * 1000;
  if (Date.now() < logDownUntil) return null;
  let recent;
  try {
    // One small lookup: only this link's changes of this kind in the last hour, and no more than needed.
    recent = (await notion(`/databases/${LOG_DB}/query`, "POST", {
      page_size: limit,
      filter: { and: [
        { timestamp: "created_time", created_time: { on_or_after: new Date(since).toISOString() } },
        { property: "Link used", select: { equals: LINK[who] } },
        { or: GROUPS[group].map((a) => ({ property: "Action", select: { equals: a } })) },
      ] },
    })).results;
  } catch (err) {
    logDown(err);
    return null;
  }
  const count = recent.filter((r) => {
    const p = r.properties || {};
    const action = p.Action && p.Action.select && p.Action.select.name;
    const link = p["Link used"] && p["Link used"].select && p["Link used"].select.name;
    return Date.parse(r.created_time) >= since && link === LINK[who] && GROUPS[group].includes(action);
  }).length;
  if (count < limit) return null;
  await logChange(who, "Blocked", { summary: `Stopped: more than ${limit} changes in an hour` });
  return json({ error: "That's a lot of changes at once, so changes are paused for an hour. Please try again after that." }, 429);
}
