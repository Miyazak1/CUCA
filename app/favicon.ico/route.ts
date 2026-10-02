export function GET(request: Request): Response {
  return Response.redirect(new URL("/ucac-icon.png?v=20261002-transparent-wordmark", request.url), 308);
}
