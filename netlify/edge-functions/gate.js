// Every address except the member link and the manager link shows the "private" page.
// The links are set in Netlify as MEMBER_PATH and MANAGER_PATH (for example "morning-fellowship").
// Search engines, AI crawlers and link-preview bots never get the page, even with the right link.
const BOTS = /bot\b|bot\/|crawl|spider|slurp|archiver|GPTBot|ChatGPT|OAI-SearchBot|Claude|anthropic|Google-Extended|GoogleOther|CCBot|Perplexity|Bytespider|Amazonbot|Applebot|meta-externalagent|facebookexternalhit|cohere|MistralAI|DuckAssist|Diffbot|Timpibot|ImagesiftBot|Omgili|WhatsApp|TelegramBot|Twitterbot|LinkedInBot|Discordbot|Pinterest|Embedly|Iframely|Google-InspectionTool|Storebot/i;

export default async (request) => {
  const url = new URL(request.url);
  if (BOTS.test(request.headers.get("user-agent") || "")) {
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
