export function GET(request: Request): Response {
  return Response.redirect(new URL("/ucac-icon.png?v=20261009-holalobe-brand", request.url), 308);
}
