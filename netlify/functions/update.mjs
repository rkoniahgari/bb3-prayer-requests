// Mark a prayer answered, take it off the list, or undo either.
// change: { answered: true, note, by } | { removed: true, by } | null (undo: back to the prayer list)
import { notion, role, json, denied, readBody, clean, text, todayET, requestRow, toItem } from "../lib/notion.mjs";

export default async (request) => {
  if (request.method !== "POST") return json({ error: "Use POST." }, 405);
  if (!role(request)) return denied();
  const { id, change } = await readBody(request);
  const row = await requestRow(id);
  if (!row) return json({ error: "That prayer request was not found." }, 404);
  const isPraise = row.properties.Type && row.properties.Type.select && row.properties.Type.select.name === "Praise report";
  let properties;
  if (!change) {
    properties = { Status: { select: { name: isPraise ? "Answered" : "Praying" } }, "Answered date": { date: null }, "How it was answered": { rich_text: [] } };
  } else if (change.removed) {
    properties = { Status: { select: { name: "Archived" } } };
  } else {
    const note = clean(change.note, 300);
    properties = {
      Status: { select: { name: "Answered" } },
      "Answered date": { date: { start: todayET() } },
      "How it was answered": { rich_text: note ? text(note) : [] },
    };
  }
  const updated = await notion(`/pages/${row.id}`, "PATCH", { properties });
  return json(toItem(updated));
};

export const config = { path: "/api/update" };
