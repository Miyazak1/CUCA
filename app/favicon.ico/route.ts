export function GET(request: Request): Response {
  return Response.redirect(new URL("/favicon.svg", request.url), 308);
}
