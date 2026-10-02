export function GET(request: Request): Response {
  return Response.redirect(new URL("/ucac-icon.png?v=20261002-contrast-logo", request.url), 308);
}
