/** Build a safe redirect to the web app. Only same-app relative paths allowed. */
export function safeRedirectUrl(webBase: string, nextPath?: string, params?: Record<string, string>): string {
  const base = (webBase || process.env.WEB_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
  let path = (nextPath || "").trim();
  // Normalize bare relative paths ("onboarding" -> "/onboarding"); reject escapes
  if (path && !path.startsWith("/")) path = `/${path}`;
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\") || path.includes(":")) {
    path = "";
  }
  // Strip query/hash smuggling from the path itself; keep "/" distinct from "".
  const raw = path.split("?")[0].split("#")[0];
  if (raw === "/") {
    path = "/";
  } else {
    path = raw.replace(/\/+$/, "") || "";
  }
  const qs = params ? new URLSearchParams(params).toString() : "";
  // When we are rendering an error banner via the query string, ensure the URL
  // has an explicit "/" so `/ ?error_code=` does not become `http://host?error_code=`
  // (Caddy and the SPA treat both as "/", but the shorter form made the error
  // invisible during debugging and some proxies drop the empty-path variant).
  if (!path && qs) path = "/";
  return `${base}${path}${qs ? `?${qs}` : ""}`;
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
