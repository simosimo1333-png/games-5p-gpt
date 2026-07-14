import { describe, expect, it } from "vitest";

import { PRODUCTION_GAME_SERVER_URL, resolveServerUrl } from "./server-url";

const location = (
  overrides: Partial<{ hostname: string; protocol: string; search: string }> = {},
) => ({
  hostname: "localhost",
  protocol: "http:",
  search: "",
  ...overrides,
});

describe("server URL selection", () => {
  it("connects the official Cloudflare site to the Render server", () => {
    expect(
      resolveServerUrl(location({ hostname: "games-5p-gpt.pages.dev", protocol: "https:" })),
    ).toBe(PRODUCTION_GAME_SERVER_URL);
  });

  it("allows a deployment variable to override the built-in production address", () => {
    expect(
      resolveServerUrl(location({ hostname: "games-5p-gpt.pages.dev" }), "wss://example.test"),
    ).toBe("wss://example.test");
  });

  it("allows a temporary server address in the URL", () => {
    expect(resolveServerUrl(location({ search: "?server=wss%3A%2F%2Ftemporary.example" }))).toBe(
      "wss://temporary.example",
    );
  });

  it("uses the local development server outside production", () => {
    expect(resolveServerUrl(location())).toBe("ws://localhost:8787");
  });
});
