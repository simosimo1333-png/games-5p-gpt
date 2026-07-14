export interface BrowserLocation {
  hostname: string;
  protocol: string;
  search: string;
}

export const PRODUCTION_CLIENT_HOSTNAME = "games-5p-gpt.pages.dev";
export const PRODUCTION_GAME_SERVER_URL = "wss://games-5p-gpt-server.onrender.com";

export function resolveServerUrl(location: BrowserLocation, configured?: string): string {
  const selected = new URLSearchParams(location.search).get("server")?.trim();
  if (selected) return selected;

  const environmentUrl = configured?.trim();
  if (environmentUrl) return environmentUrl;

  // Keep the official free deployment playable even when no Cloudflare variable is configured.
  if (location.hostname === PRODUCTION_CLIENT_HOSTNAME) return PRODUCTION_GAME_SERVER_URL;

  const scheme = location.protocol === "https:" ? "wss" : "ws";
  return `${scheme}://${location.hostname || "127.0.0.1"}:8787`;
}
