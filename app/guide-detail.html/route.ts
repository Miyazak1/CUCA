const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("guide") || "";
  const location = slugPattern.test(slug) ? `/guides/${slug}` : "/guides/";
  return new Response(null, {
    status: 308,
    headers: {
      location,
      "cache-control": "public, max-age=3600",
    },
  });
}
