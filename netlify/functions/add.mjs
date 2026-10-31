// A member adds a prayer request or a praise report.
import { REQUESTS_DB, notion, role, json, denied, readBody, clean, text, todayET, toItem } from "../lib/notion.mjs";

export default async (request) => {
  if (request.method !== "POST") return json({ error: "Use POST." }, 405);
  const who = role(request);
  if (!who) return denied();
  const body = await readBody(request);
  const name = clean(body.name, 60);
  const words = clean(body.text, 300);
  const kind = body.kind === "praise" ? "praise" : "request";
  if (!name || !words) return json({ error: "A name and a few words are needed." }, 400);
  const row = await notion("/pages", "POST", {
    parent: { database_id: REQUESTS_DB },
    properties: {
      Request: { title: text(words) },
      Person: { rich_text: text(name) },
      Type: { select: { name: kind === "praise" ? "Praise report" : "Prayer request" } },
      Status: { select: { name: kind === "praise" ? "Answered" : "Praying" } },
      "Study date": { date: { start: todayET() } },
      "Show on page": { checkbox: true },
      Source: { rich_text: text(`Website (${who === "manager" ? "manager" : "member"})`) },
    },
  });
  return json(toItem(row));
};

export const config = { path: "/api/add" };
