// Manager-only actions: fix or hide requests, and keep the member list up to date.
import { MEMBERS_DB, notion, role, json, denied, readBody, clean, text, requestRow, toItem } from "../lib/notion.mjs";

const bare = (id) => String(id || "").replace(/-/g, "");

export default async (request) => {
  if (request.method !== "POST") return json({ error: "Use POST." }, 405);
  if (role(request) !== "manager") return denied();
  const body = await readBody(request);
  const action = body.action;

  if (action === "member-add") {
    const name = clean(body.name, 60);
    if (!name) return json({ error: "Please type a name." }, 400);
    const row = await notion("/pages", "POST", {
      parent: { database_id: MEMBERS_DB },
      properties: { Name: { title: text(name) }, Active: { checkbox: true } },
    });
    return json({ id: row.id, name });
  }

  if (action === "member-remove") {
    const page = await notion(`/pages/${body.id}`);
    if (!page.parent || bare(page.parent.database_id) !== bare(MEMBERS_DB)) return json({ error: "Member not found." }, 404);
    await notion(`/pages/${page.id}`, "PATCH", { properties: { Active: { checkbox: false } } });
    return json({ ok: true });
  }

  const row = await requestRow(body.id);
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
  return json(toItem(updated));
};

export const config = { path: "/api/manage" };
