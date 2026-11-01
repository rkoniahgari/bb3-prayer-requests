// Everything the page needs: members and prayer requests. Managers also get hidden and removed ones.
import { MEMBERS_DB, REQUESTS_DB, INBOX_DB, queryAll, role, json, denied, toItem, plain, safe } from "../lib/notion.mjs";

export default safe(async (request) => {
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
  // A request waiting for "Which Carol is this?" stays off the shared list until Lisa or Rebecca picks.
  const items = all.filter((it) => !it.hidden && !it.archived && !(it.choices && it.choices.length));
  const updated = items.reduce((m, it) => [it.added, it.answered || ""].reduce((a, b) => (b > a ? b : a), m), "");
  const out = { role: who, members: members.map((m) => m.name), items, updated: updated || null };
  if (who === "manager") {
    Object.assign(out, { all, memberRows: members, memberPath: process.env.MEMBER_PATH || "" });
    try {
      const chats = await queryAll(INBOX_DB, { sorts: [{ property: "Pasted at", direction: "descending" }], page_size: 20 });
      out.inbox = chats.slice(0, 10).map((r) => ({
        id: r.id,
        status: (r.properties.Status && r.properties.Status.select && r.properties.Status.select.name) || "Waiting",
        pastedAt: (r.properties["Pasted at"] && r.properties["Pasted at"].date && r.properties["Pasted at"].date.start) || r.created_time,
        preview: plain(r.properties.Chat).replace(/\s+/g, " ").slice(0, 140),
        note: plain(r.properties.Note),
      }));
    } catch (e) {
      out.inbox = null; // the Chat Inbox is not connected to the integration yet
    }
  }
  return json(out);
});

export const config = { path: "/api/data" };
