// Liveness only. Database readiness is checked by actual database operations.
export function GET() {
  return Response.json({ status: "ok", service: "care-circle" });
}
