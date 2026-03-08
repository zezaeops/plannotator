/**
 * Bearer token authentication for Hub API.
 * Only validates if a token is configured via PLANNOTATOR_HUB_TOKEN.
 */
export function validateAuth(
  req: Request,
  expectedToken: string | undefined
): Response | null {
  if (!expectedToken) return null;

  const auth = req.headers.get("Authorization");
  if (auth !== `Bearer ${expectedToken}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
