// Every address except the member link and the manager link shows the "private" page.
// The links are set in Netlify as MEMBER_PATH and MANAGER_PATH (for example "morning-fellowship").
// Search engines and AI crawlers never get the page, even with the right link.
const BOTS = /bot\b|bot\/|crawl|spider|slurp|archiver|GPTBot|ChatGPT|OAI-SearchBot|Claude|anthropic|Google-Extended|GoogleOther|CCBot|Perplexity|Bytespider|Amazonbot|Applebot|meta-externalagent|facebookexternalhit|cohere|MistralAI|DuckAssist|Diffbot|Timpibot|ImagesiftBot|Omgili|Pinterest|Embedly|Iframely|Google-InspectionTool|Storebot/i;
// Link previews (WhatsApp, iMessage, Facebook, Telegram, Slack...) only ever see the page's name, a one-line
// description and the logo. Prayer requests load separately and need the link, so previews are safe to allow.
const PREVIEWS = /WhatsApp|facebookexternalhit|Facebot|Twitterbot|TelegramBot|Slackbot-LinkExpanding|Discordbot|LinkedInBot|SkypeUriPreview|Signal|Viber/i;

export default async (request) => {
  const url = new URL(request.url);
  const ua = request.headers.get("user-agent") || "";
  if (BOTS.test(ua) && !PREVIEWS.test(ua)) {
    return new Response("This page is private.", {
      status: 403,
      headers: { "content-type": "text/plain; charset=utf-8", "x-robots-tag": "noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate, noai, noimageai", "cache-control": "no-store" },
    });
  }
  const first = decodeURIComponent(url.pathname.split("/")[1] || "");
  const member = Netlify.env.get("MEMBER_PATH");
  const manager = Netlify.env.get("MANAGER_PATH");
  if (first && first === member) return new URL("/app/index.html", request.url);
  if (first && first === manager) return managerPage(request);
  return new URL("/private.html", request.url);
};

export const config = {
  path: "/*",
  excludedPath: ["/app/*", "/api/*", "/private.html", "/robots.txt", "/.netlify/*"],
};

// Lisa's and Rebecca's link: same page, but the title and link preview say it is for managing the list.
const MEMBER_TITLE = "Bible &amp; Breakfast, Group 3 · Prayer Requests";
const MEMBER_TEXT = "Prayer requests and answered prayers for Bible &amp; Breakfast, Group 3. Private to our group.";
const MANAGER_TITLE = "Manage · Bible &amp; Breakfast, Group 3 Prayer Requests";
const MANAGER_TEXT = "Add prayer requests from the Zoom chat, keep the member list up to date, and look after the group\u2019s prayer list. Please don\u2019t share this link.";
async function managerPage(request) {
  const page = await fetch(new URL("/app/index.html", request.url));
  if (!page.ok) return new URL("/app/index.html", request.url);
  const html = (await page.text()).split(MEMBER_TITLE).join(MANAGER_TITLE).split(MEMBER_TEXT).join(MANAGER_TEXT)
    .replace('content="Prayer Requests"', 'content="Manage Prayers"');
  const headers = new Headers(page.headers);
  headers.delete("content-length");
  headers.set("cache-control", "no-store");
  // Keep the same protections as every other page, in case they weren't passed along.
  headers.set("x-robots-tag", "noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate, noai, noimageai");
  if (!headers.has("content-security-policy")) {
    headers.set("content-security-policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'");
    headers.set("x-frame-options", "DENY");
    headers.set("referrer-policy", "no-referrer");
    headers.set("x-content-type-options", "nosniff");
  }
  return new Response(html, { status: 200, headers });
}
