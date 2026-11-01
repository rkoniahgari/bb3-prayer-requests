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
  if (first && (first === member || first === manager)) return new URL("/app/index.html", request.url);
  return new URL("/private.html", request.url);
};

export const config = {
  path: "/*",
  excludedPath: ["/app/*", "/api/*", "/private.html", "/robots.txt", "/.netlify/*"],
};
