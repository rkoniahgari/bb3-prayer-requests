// Every address except the member link and the manager link shows the "private" page.
// The links are set in Netlify as MEMBER_PATH and MANAGER_PATH (for example "morning-fellowship").
export default async (request) => {
  const url = new URL(request.url);
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
