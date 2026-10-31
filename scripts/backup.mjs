// Nightly backup: copies every row of the four Group 3 databases into one JSON file.
// Run by .github/workflows/backup.yml. Needs NOTION_TOKEN.
import fs from "node:fs";
const DBS = {
  requests: process.env.REQUESTS_DB || "a6df3e46824040d2b752ab19497fb0eb",
  members: process.env.MEMBERS_DB || "f808ba54207640bf973ee98d707b58bc",
  inbox: process.env.INBOX_DB || "f9d78d0b73514a3eb7ccdc7eb057cb6b",
  log: process.env.LOG_DB || "cb5939603f1c4a4c8cbe0de5e80292d1",
};
async function queryAll(db) {
  const rows = [];
  let cursor;
  do {
    const res = await fetch(`https://api.notion.com/v1/databases/${db}/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.NOTION_TOKEN}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" },
      body: JSON.stringify({ page_size: 100, start_cursor: cursor }),
    });
    if (!res.ok) throw new Error(`Notion ${res.status} for ${db}: ${await res.text()}`);
    const page = await res.json();
    rows.push(...page.results);
    cursor = page.has_more ? page.next_cursor : undefined;
  } while (cursor);
  return rows;
}
const out = { takenAt: new Date().toISOString() };
for (const [name, id] of Object.entries(DBS)) {
  try { out[name] = await queryAll(id); console.log(name, out[name].length, "rows"); }
  catch (err) { out[name] = { error: err.message }; console.error(err.message); if (name === "requests") process.exitCode = 1; }
}
fs.mkdirSync("backup", { recursive: true });
fs.writeFileSync(`backup/group3-${out.takenAt.slice(0, 10)}.json`, JSON.stringify(out, null, 1));
