/** Build a safe redirect to the web app. Only same-app relative paths allowed. */
export function safeRedirectUrl(webBase: string, nextPath?: string, params?: Record<string, string>): string {
  const base = (webBase || process.env.WEB_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
  let path = (nextPath || "").trim();
  // Normalize bare relative paths ("onboarding" -> "/onboarding"); reject escapes
  if (path && !path.startsWith("/")) path = `/${path}`;
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\") || path.includes(":")) {
    path = "";
  }
  // Strip query/hash smuggling from the path itself
  path = path.split("?")[0].split("#")[0].replace(/\/+$/, "") || "";
  const qs = params ? new URLSearchParams(params).toString() : "";
  return `${base}${path || ""}${qs ? `?${qs}` : ""}`;
}

export function authErrorRedirect(
  webBase: string,
  nextPath: string | undefined,
  errorCode: string,
  errorMessage: string,
  extra?: Record<string, string>,
): string {
  return safeRedirectUrl(webBase, nextPath, { error_code: errorCode, error_message: errorMessage, ...extra });
}
