import { describe, expect, it } from "vitest";
import { publicUrl } from "../server/features";

describe("publicUrl (SSRF guard for the Reader)", () => {
  it.each([
    "http://localhost:8787/api/health",
    "http://127.0.0.1/",
    "http://10.0.0.5/",
    "http://172.20.1.1/",
    "http://192.168.1.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://[::1]/",
    "http://[fd00::1]/",
    "http://metadata.internal/",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "https://user:pass@8.8.8.8/",
    "not a url",
  ])("rejects %s", async (u) => {
    expect(await publicUrl(u)).toBeNull();
  });

  it("accepts a public IP literal", async () => {
    expect((await publicUrl("https://8.8.8.8/dns"))?.hostname).toBe("8.8.8.8");
  });
});
