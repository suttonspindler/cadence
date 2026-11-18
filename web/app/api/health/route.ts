// Liveness probe for Render. Deliberately does NOT touch the database: if Neon is
// cold or briefly unreachable, the app should stay "up" (pages degrade) rather than
// have Render fail the health check and restart-loop the instance into a 502.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok" });
}
