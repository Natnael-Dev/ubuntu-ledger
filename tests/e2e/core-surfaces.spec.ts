import { test, expect } from "@playwright/test";

test.describe("6 Core Proof-Line Surfaces Verification", () => {
  test("Surface 1: Home (/) renders primary brand heading", async ({ page }) => {
    await page.goto("/");
    const heading = page.locator("h1");
    await expect(heading).toBeVisible();
    await expect(heading).toContainText("Ward Proof-Line");
  });

  test("Surface 2: Simulator (/simulator) renders feature phone simulator shell", async ({ page }) => {
    await page.goto("/simulator");
    await expect(page.locator("text=Proof A · Sybil Resistance")).toBeVisible();
    await expect(page.locator('[data-testid="feature-phone"]')).toBeVisible();
    await expect(page.locator('[data-testid="lcd-display"]')).toBeVisible();
  });

  test("Surface 3: Console (/console) renders municipal operator console heading", async ({ page }) => {
    await page.goto("/console");
    const heading = page.locator("h1");
    await expect(heading).toBeVisible();
    await expect(heading).toContainText("CONSOLE:");
  });

  test("Surface 4: Receipt (/receipt/4412) renders verified civic spending receipt", async ({ page }) => {
    await page.goto("/receipt/4412");
    const heading = page.locator("h1");
    await expect(heading).toBeVisible();
    await expect(heading).toContainText("Health post generator overhaul");
  });

  test("Surface 5: Services (/services/ET-ID-REPLACE) renders statutory divergence card", async ({ page }) => {
    await page.goto("/services/ET-ID-REPLACE");
    const heading = page.locator("h1");
    await expect(heading).toHaveCount(1);
    await expect(heading).toContainText("Public Service Fee Divergence Card");
    await expect(page.locator('[data-testid="divergence-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="statutory-ledger"]')).toBeVisible();
    await expect(page.locator('[data-testid="community-ledger"]')).toBeVisible();
  });

  test("Surface 6: PWA (/pwa) renders field monitor outbox interface", async ({ page }) => {
    await page.goto("/pwa");
    const heading = page.locator("h1");
    await expect(heading).toBeVisible();
    await expect(heading).toContainText("Monitor Field Observation (PWA)");
  });
});
