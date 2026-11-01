// Nightly clean-up (runs on Netlify's schedule, not from the page).
// Moves to Notion's trash anything older than KEEP_DAYS in:
//   - the Activity Log
//   - the Chat Inbox (only chats that were already added; a chat still waiting is never touched)
// Prayer requests and members are never touched. Notion keeps trashed pages for 30 days, then deletes them.
import { notion, LOG_DB, INBOX_DB } from "../lib/notion.mjs";

const KEEP_DAYS = Number(process.env.KEEP_DAYS || 14);
const MAX_PER_RUN = 150; // stay well inside the time a scheduled function may run

async function oldRows(db, extraFilter) {
  const before = new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const filter = { timestamp: "created_time", created_time: { before } };
  const res = await notion(`/databases/${db}/query`, "POST", {
    page_size: 100,
    filter: extraFilter ? { and: [filter, extraFilter] } : filter,
  });
  return res.results.filter((r) => Date.parse(r.created_time) < Date.parse(before));
}

async function trash(rows) {
  let done = 0;
  for (let i = 0; i < rows.length && done < MAX_PER_RUN; i += 5) {
    const batch = rows.slice(i, i + 5);
    await Promise.all(batch.map((r) => notion(`/pages/${r.id}`, "PATCH", { archived: true })));
    done += batch.length;
  }
  return done;
}

export default async () => {
  const out = {};
  for (const [name, db, extra] of [
    ["activityLog", LOG_DB, null],
    ["chatInbox", INBOX_DB, { property: "Status", select: { does_not_equal: "Waiting" } }],
  ]) {
    try {
      out[name] = await trash(await oldRows(db, extra));
    } catch (err) {
      console.error(`Clean-up of ${name} failed:`, err.message);
      out[name] = "failed";
    }
  }
  console.log(`Clean-up (older than ${KEEP_DAYS} days):`, JSON.stringify(out));
  return new Response(JSON.stringify(out), { headers: { "content-type": "application/json" } });
};

export const config = { schedule: "@daily" };
