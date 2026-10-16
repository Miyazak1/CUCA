export function GET(request: Request): Response {
  return Response.redirect(new URL("/ucac-favicon.ico?v=20261016", request.url), 307);
}
