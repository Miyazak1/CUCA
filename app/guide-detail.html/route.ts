import { legacyPageHref } from "../legacy-redirect.ts";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const slug = params.get("guide") || "";
  const path = slugPattern.test(slug) ? `/guides/${slug}` : "/guides/";
  params.delete("guide");
  const search = Object.fromEntries([...new Set(params.keys())].map(key => [key, params.getAll(key)]));
  const location = legacyPageHref(path, search);
  return new Response(null, {
    status: 308,
    headers: {
      location,
      "cache-control": "public, max-age=3600",
    },
  });
}
