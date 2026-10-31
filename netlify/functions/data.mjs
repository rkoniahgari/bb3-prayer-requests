// Everything the page needs: members and prayer requests. Managers also get hidden and removed ones.
import { MEMBERS_DB, REQUESTS_DB, queryAll, role, json, denied, toItem, plain } from "../lib/notion.mjs";

export default async (request) => {
  const who = role(request);
  if (!who) return denied();
  const [rows, memberRows] = await Promise.all([
    queryAll(REQUESTS_DB, { sorts: [{ property: "Study date", direction: "descending" }] }),
    queryAll(MEMBERS_DB),
  ]);
  const all = rows.map(toItem).filter((it) => it.text);
  const members = memberRows
    .filter((m) => m.properties.Active && m.properties.Active.checkbox)
    .map((m) => ({ id: m.id, name: plain(m.properties.Name) }))
    .filter((m) => m.name)
    .sort((a, b) => a.name.localeCompare(b.name));
  const items = all.filter((it) => !it.hidden && !it.archived);
  const updated = items.reduce((m, it) => [it.added, it.answered || ""].reduce((a, b) => (b > a ? b : a), m), "");
  const out = { role: who, members: members.map((m) => m.name), items, updated: updated || null };
  if (who === "manager") Object.assign(out, { all, memberRows: members, memberPath: process.env.MEMBER_PATH || "" });
  return json(out);
};

export const config = { path: "/api/data" };
