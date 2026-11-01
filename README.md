# Bible & Breakfast, Group 3 — Prayer Requests

A private, large-print prayer list for the group. Members open one shared link (no passwords).
Lisa and Rebecca open a separate manager link that adds a **Manage** page.
The list is stored in Notion. The site runs on Netlify's free plan.

## How it works

| Address | Who | What they see |
|---|---|---|
| `/<MEMBER_PATH>` | Everyone in the group | New, Members and Praise |
| `/<MANAGER_PATH>` | Lisa and Rebecca | The same, plus **Manage** |
| anything else | Strangers, search engines | "This page is private. Please ask Lisa for the link." |

- Every page sends `noindex` headers and `robots.txt` blocks crawlers, so search engines will not list it.
- The data endpoints (`/api/*`) answer only when the request carries the member or manager link.
- Data lives in three Notion databases: **Group 3 Prayer Requests**, **Group 3 Members** and **Group 3 Chat Inbox**.

## Page addresses
Each screen has its own clean address under the link, for example (with `MEMBER_PATH=praying-together`):
`/praying-together` (New), `/praying-together/members`, `/praying-together/members/carmen-m`,
`/praying-together/praise-reports`, `/praying-together/praise-reports/2026-10`, `/praying-together/add-prayer`,
`/praying-together/share-praise`, `/praying-together/answered-prayer`, and for managers
`/<MANAGER_PATH>/manage/prayer-requests`, `/manage/members`, `/manage/zoom-chat`.
Older links with `#` still work and switch to the clean address.

## Manage page (manager link only)
- **Requests** — filter by On the list / Hidden / Removed; edit, hide/show, remove (with confirm) and restore.
- **Members** — copy the group link, add a member, remove a member (with confirm).
- **From chat** — paste the Zoom chat as it is. It is saved to the Chat Inbox as *Waiting*. The Claude routine
  ("Group 3 prayer list update", Mon/Wed/Fri 12:23 pm Eastern) sorts it into the prayer list and marks it
  *Added* or *Needs a look* with a short note, which shows on this page.

## Set up (about 15 minutes)

### 1. Give the site permission to use the Notion lists
1. Go to <https://www.notion.so/profile/integrations> and choose **New integration**.
2. Name: `Group 3 prayer app`. Type: **Internal**. Save.
3. Under **Capabilities**, tick **Read content**, **Update content** and **Insert content**. Save.
4. Copy the **Internal integration secret** (it starts with `ntn_`). Keep it private.
5. Open **Group 3 Prayer Requests** in Notion → **•••** (top right) → **Connections** → add **Group 3 prayer app**.
6. Do the same for **Group 3 Members** and **Group 3 Chat Inbox**.

### 2. Put the site on Netlify
1. In Netlify choose **Add new project → Import an existing project → GitHub** and pick **bb3-prayer-requests**.
2. Leave the build settings as they are (they come from `netlify.toml`) and deploy.
3. Open **Project configuration → Environment variables** and add:

| Name | Value |
|---|---|
| `NOTION_TOKEN` | the secret from step 1 |
| `MEMBER_PATH` | the words for the group link, for example `morning-fellowship` |
| `MANAGER_PATH` | the words for Lisa's and Rebecca's link — make it different and keep it private, for example `leaders-table-4827` |

4. Choose **Deploys → Trigger deploy → Deploy project** so the settings take effect.

### 3. Try it
- Group link: `https://<your-site>.netlify.app/<MEMBER_PATH>`
- Manager link: `https://<your-site>.netlify.app/<MANAGER_PATH>`
- Any other address should show "This page is private".

### Changing a link later
Change `MEMBER_PATH` or `MANAGER_PATH` in Netlify and redeploy. The old link stops working straight away.
Members then need the new link (and to re-add the home-screen icon).

## Code map
- `public/app/index.html` — the whole app (design approved in the prototype). Loads data from `/api/data`.
- `public/private.html` — the page strangers see.
- `netlify/edge-functions/gate.js` — sends the two links to the app and everything else to the private page.
- `netlify/functions/` — `data` (read), `add` (new request or praise), `update` (answered / removed / undo), `manage` (manager-only: edits, members, pasting a chat).
- `netlify/lib/notion.mjs` — shared Notion helpers and the link check.

## Security

- The page addresses (MEMBER_PATH, MANAGER_PATH) act as passwords. Make the manager one long and random, and never post it in the group.
- Every page tells search engines and AI tools not to list, quote, archive or train on it (robots.txt, `X-Robots-Tag` and meta tags), and known search and AI crawlers are turned away at the door (`netlify/edge-functions/gate.js`), even with the right link.
- Pages refuse to load code from anywhere except this site (Content Security Policy in `netlify.toml`).
- The server checks the address on every request. Only the manager address can change members, hide, edit or remove requests.
- If a link leaks: change MEMBER_PATH or MANAGER_PATH in Netlify, redeploy, and share the new link.
- If the Notion token leaks: open notion.so/profile/integrations, refresh the secret, and paste the new one into NOTION_TOKEN in Netlify.
- Keep two-step sign-in turned on for GitHub, Netlify, Notion and Claude, and keep this repository private.

## Safeguards against lost or vandalized requests

- **Nothing is ever deleted.** "Remove" only sets Status to *Archived*; removing a member only unticks *Active*. Everything can be brought back from Manage → Removed, or in Notion.
- **Activity log.** Every change from the page is written to the Notion database **Group 3 Activity Log**: what happened, which link was used (member or manager), and the wording *before* and *after*. Use it to see who changed what and to put anything back.
- **Speed limit.** In any one hour, the member link can remove at most 10 requests and add 30; the manager link can remove, hide or edit at most 40 and add 100. Past that, changes pause for an hour and a "Blocked" line appears in the log.
- **Nightly backup.** A GitHub Action (`.github/workflows/backup.yml`) saves a full copy of all four databases every night, kept for 30 days (without the raw pasted chats) under the repo's Actions tab → *Nightly backup* → a run → *Artifacts*. It needs the repository secret `NOTION_TOKEN`.
- **Notion's own history.** Each Notion page keeps its edit history, and Notion's trash keeps deleted pages for 30 days.

### If someone vandalizes the list
1. Change MEMBER_PATH (or MANAGER_PATH) in Netlify and redeploy. The old link stops working at once.
2. Open the Activity Log in Notion, filter by the time it happened, and use Manage → Removed → Restore (or the *Before* column) to put things back.
3. Share the new link with the group.

## Sort pasted chats right away (optional)

When a chat is added from Manage → From chat, the page can start the Claude routine at once instead of
waiting for its Mon/Wed/Fri 12:23 pm run. Runs use your Claude plan, not a paid API.

1. Open https://claude.ai/code/routines → **Group 3 prayer list update** → **Edit**.
2. Make sure the **Notion** connector is added and the routine is **on**.
3. In **Trigger**, click **+** → **API**. Copy the **Fire URL**, then click **Generate token** and copy the token (it is shown once).
4. In Netlify → Site configuration → Environment variables, add:
   - `ROUTINE_FIRE_URL` = the Fire URL
   - `ROUTINE_TOKEN` = the token
5. Redeploy.

The token stays on the server; the page never sees it. If it leaks, click **Regenerate** on the routine
and paste the new one into Netlify. Without these two values, chats are simply sorted at the next scheduled run.

## How long things are kept

- **Prayer requests and members:** kept until someone removes them. Nothing below touches them.
- **Pasted chats (Group 3 Chat Inbox) and the Activity Log:** 14 days. A Netlify scheduled function
  (`netlify/functions/cleanup.mjs`) runs every night and moves older rows to Notion's trash, where Notion
  deletes them for good after 30 days. A chat that is still waiting to be added is never removed.
  Change the number of days with a `KEEP_DAYS` environment variable in Netlify.
- **"Filed chats" on the Notion paste page:** the routine removes copies older than 14 days.
- **Nightly backups:** 30 days, without the raw pasted chat text.
