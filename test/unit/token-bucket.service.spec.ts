import { TokenBucketService } from "../../src/common/rate-limit/token-bucket.service";

describe("TokenBucketService", () => {
  it("allows up to capacity instantly, then blocks, then refills", async () => {
    const tb = new TokenBucketService();
    for (let i = 0; i < 5; i++) expect(tb.allow("k")).toBe(true);
    expect(tb.allow("k")).toBe(false);
    await new Promise((r) => setTimeout(r, 1050));
    expect(tb.allow("k")).toBe(true);
  });

  it("separate keys have separate buckets", () => {
    const tb = new TokenBucketService();
    for (let i = 0; i < 5; i++) expect(tb.allow("A")).toBe(true);
    expect(tb.allow("A")).toBe(false);
    for (let i = 0; i < 5; i++) expect(tb.allow("B")).toBe(true);
  });
});
