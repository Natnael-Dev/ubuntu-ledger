import { test, expect } from "@playwright/test";

test.describe("application shell", () => {
  test("loads the home page and renders title", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toHaveText("Ward Proof-Line");
  });
});
