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
