// Manager-only actions: fix or hide requests, and keep the member list up to date.
import { MEMBERS_DB, INBOX_DB, isId, notion, role, json, denied, readBody, clean, text, longText, requestRow, toItem, safe, logChange, tooFast, describe, plain, later } from "../lib/notion.mjs";

const bare = (id) => String(id || "").replace(/-/g, "");

// Start the Claude routine that sorts pasted chats, right away instead of at the next scheduled time.
// Needs ROUTINE_FIRE_URL and ROUTINE_TOKEN in Netlify. Returns true if sorting started.
async function startSorting(inboxRowId) {
  const url = process.env.ROUTINE_FIRE_URL, token = process.env.ROUTINE_TOKEN;
  if (!url || !token) return false;
  if (!/^https:\/\/api\.anthropic\.com\/v1\/claude_code\/routines\/trig_\w+\/fire$/.test(url)) {
    console.error("ROUTINE_FIRE_URL doesn't look like a routine fire address; not sending.");
    return false;
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "experimental-cc-routine-2026-04-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: `Chat Inbox row: ${inboxRowId}` }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) { console.error("Routine did not start:", res.status, await res.text()); return false; }
    return true;
  } catch (err) {
    console.error("Routine did not start:", err.message);
    return false;
  }
}

export default safe(async (request, context) => {
  if (request.method !== "POST") return json({ error: "Use POST." }, 405);
  if (role(request) !== "manager") return denied();
  const body = await readBody(request);
  const action = body.action;
  const NAMES = { paste: "Chat pasted", "member-add": "Member added", "member-remove": "Member removed", edit: "Edited", hide: "Hidden", show: "Shown", archive: "Removed", restore: "Restored" };
  if (!NAMES[action]) return json({ error: "Unknown action." }, 400);
  // Start the speed check now; request changes look up the row at the same time.
  const slowCheck = tooFast("manager", ["member-remove", "edit", "hide", "archive"].includes(action) ? "remove" : "add");
  if (!["paste", "member-add", "member-remove"].includes(action)) return changeRequest(action, body, context, slowCheck);
  const slow = await slowCheck;
  if (slow) return slow;

  if (action === "paste") {
    const chat = String(body.chat || "").replace(/\r\n/g, "\n").trim().slice(0, 40000);
    if (!chat) return json({ error: "Please paste the chat first." }, 400);
    const now = new Date().toISOString();
    const row = await notion("/pages", "POST", {
      parent: { database_id: INBOX_DB },
      properties: {
        Title: { title: text("Chat pasted " + now.slice(0, 10)) },
        Chat: { rich_text: longText(chat) },
        Status: { select: { name: "Waiting" } },
        "Pasted by": { rich_text: text("Manage page") },
        "Pasted at": { date: { start: now } },
      },
    });
    later(context, logChange("manager", "Chat pasted", { summary: "Zoom chat pasted (see Group 3 Chat Inbox)", id: row.id }));
    const sorting = await startSorting(row.id);
    if (sorting) {
      await notion(`/pages/${row.id}`, "PATCH", { properties: { Note: { rich_text: text("Being sorted now. This usually takes a few minutes.") } } }).catch(() => {});
    }
    return json({ id: row.id, status: "Waiting", pastedAt: now, sorting });
  }

  if (action === "member-add") {
    const name = clean(body.name, 60);
    if (!name) return json({ error: "Please type a name." }, 400);
    const row = await notion("/pages", "POST", {
      parent: { database_id: MEMBERS_DB },
      properties: { Name: { title: text(name) }, Active: { checkbox: true } },
    });
    later(context, logChange("manager", "Member added", { summary: `Added member ${name}`, person: name, id: row.id }));
    return json({ id: row.id, name });
  }

  if (action === "member-remove") {
    if (!isId(body.id)) return json({ error: "Member not found." }, 404);
    const page = await notion(`/pages/${body.id}`);
    if (!page.parent || bare(page.parent.database_id) !== bare(MEMBERS_DB)) return json({ error: "Member not found." }, 404);
    await notion(`/pages/${page.id}`, "PATCH", { properties: { Active: { checkbox: false } } });
    const name = plain(page.properties && page.properties.Name);
    later(context, logChange("manager", "Member removed", { summary: `Removed member ${name} (tick Active in Group 3 Members to bring back)`, person: name, id: page.id }));
    return json({ ok: true });
  }

  return json({ error: "Unknown action." }, 400);
});

async function changeRequest(action, body, context, slowCheck) {
  const NAMES = { edit: "Edited", hide: "Hidden", show: "Shown", archive: "Removed", restore: "Restored" };
  const [row, slow] = await Promise.all([requestRow(body.id), slowCheck]);
  if (slow) return slow;
  if (!row) return json({ error: "That prayer request was not found." }, 404);
  let properties;
  if (action === "edit") {
    const name = clean(body.name, 60);
    const words = clean(body.text, 300);
    if (!name || !words) return json({ error: "A name and a few words are needed." }, 400);
    properties = { Person: { rich_text: text(name) }, Request: { title: text(words) } };
  } else if (action === "hide" || action === "show") {
    properties = { "Show on page": { checkbox: action === "show" } };
  } else if (action === "archive") {
    properties = { Status: { select: { name: "Archived" } } };
  } else if (action === "restore") {
    const isPraise = row.properties.Type && row.properties.Type.select && row.properties.Type.select.name === "Praise report";
    properties = { Status: { select: { name: isPraise ? "Answered" : "Praying" } }, "Show on page": { checkbox: true } };
  } else {
    return json({ error: "Unknown action." }, 400);
  }
  const updated = await notion(`/pages/${row.id}`, "PATCH", { properties });
  const person = plain(row.properties.Person);
  later(context, logChange("manager", NAMES[action], { summary: `${NAMES[action]}: ${person}'s request`, person, before: describe(row), after: describe(updated), id: row.id }));
  return json(toItem(updated));
}

export const config = { path: "/api/manage" };
