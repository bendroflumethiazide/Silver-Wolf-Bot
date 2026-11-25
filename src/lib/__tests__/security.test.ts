import { afterEach, describe, expect, it } from "vitest";
import { isSameOrigin } from "../security";

const req = (headers: Record<string, string>, url = "http://127.0.0.1:47923/api/silverwolf") => new Request(url, { method: "POST", headers });

describe("same-origin guard", () => {
  afterEach(() => { delete process.env.ASTRAL_LOCAL_ONLY; });
  it("allows the app's own requests", () => {
    expect(isSameOrigin(req({ host: "127.0.0.1:47923", origin: "http://127.0.0.1:47923", "sec-fetch-site": "same-origin" }))).toBe(true);
    expect(isSameOrigin(req({ host: "127.0.0.1:47923" }))).toBe(true);
  });
  it("blocks other websites", () => {
    expect(isSameOrigin(req({ host: "127.0.0.1:47923", origin: "https://evil.example", "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(isSameOrigin(req({ host: "127.0.0.1:47923", origin: "https://evil.example" }))).toBe(false);
    expect(isSameOrigin(req({ host: "127.0.0.1:47923", "sec-fetch-site": "same-site" }))).toBe(false);
  });
  it("blocks DNS rebinding in desktop mode", () => {
    process.env.ASTRAL_LOCAL_ONLY = "1";
    expect(isSameOrigin(req({ host: "evil.example:47923", origin: "http://evil.example:47923", "sec-fetch-site": "same-origin" }))).toBe(false);
    expect(isSameOrigin(req({ host: "localhost:47923", origin: "http://localhost:47923" }))).toBe(true);
  });
});
