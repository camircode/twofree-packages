import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiProvider } from "../src/browser.js";

describe("browser product API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("updates a generic product through the exact PATCH endpoint", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ record: { id: "budget-1" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetch);

    await new ApiProvider("https://api.example.test").update("budget", "budget-1", {
      riskPercent: "85",
    });

    expect(fetch).toHaveBeenCalledWith(
      new URL("https://api.example.test/products/budget/budget-1"),
      expect.objectContaining({ method: "PATCH", credentials: "include" }),
    );
    expect(JSON.parse(fetch.mock.calls[0]![1].body)).toEqual({ riskPercent: "85" });
  });
});
