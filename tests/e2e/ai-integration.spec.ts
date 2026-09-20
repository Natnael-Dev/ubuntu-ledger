// AI Widgets Integration & Surfacing E2E Tests (T-AI-050)
// Verifies additive surfacing of the 4 AI widgets across Simulator, Console, and Receipt pages.

import { test, expect } from '@playwright/test';

test.describe('T-AI-050: AI Widgets Surfacing & Integration', () => {
  test('Simulator: toggle between USSD Simulation and Voice AI Evidence', async ({ page }) => {
    await page.goto('/simulator');

    // Default tab is USSD Simulation
    const ussdTab = page.getByTestId('mode-tab-ussd');
    const voiceTab = page.getByTestId('mode-tab-voice');
    await expect(ussdTab).toBeVisible();
    await expect(voiceTab).toBeVisible();

    // Verify USSD handset is visible by default
    await expect(page.getByTestId('feature-phone')).toBeVisible();

    // Switch to Voice AI Evidence
    await voiceTab.click();
    await expect(page.getByText('Citizen Voice Inspection Recorder')).toBeVisible();
    await expect(page.getByText('Citizen Voice Evidence Capture')).toBeVisible();

    // Switch back to USSD Simulation
    await ussdTab.click();
    await expect(page.getByTestId('feature-phone')).toBeVisible();
  });

  test('Console: expand AI Oversight Insights and view Sybil & Cross-Ward panels', async ({ page }) => {
    await page.goto('/console');

    // AI Oversight Insights card is present above the project board
    const toggleBtn = page.getByTestId('toggle-ai-insights-btn');
    await expect(toggleBtn).toBeVisible();
    await expect(page.getByText('AI Oversight Insights')).toBeVisible();

    // Expand the insights section
    await toggleBtn.click();
    await expect(toggleBtn).toContainText('Collapse Insights');

    // Verify both panels or tabs are rendered
    await expect(page.getByText('Sybil & Collusion Ring Auditor')).toBeVisible();
    await expect(page.getByText('Cross-Ward Contractor Patterns')).toBeVisible();

    // Verify the project board below remains fully functional
    await expect(page.getByTestId('project-row-4412')).toBeVisible();
  });

  test('Receipt: expand Plain Language Summary (AI) and view ELI5 summary', async ({ page }) => {
    await page.goto('/receipt/4412');

    // Plain Language Summary accordion summary is present
    const summaryText = page.getByText('Plain Language Summary (AI)');
    await expect(summaryText).toBeVisible();

    // Click to expand accordion
    await summaryText.click();

    // Verify ELI5 panel elements are visible
    await expect(page.getByText('Plain-Language Civic Summary')).toBeVisible();
    await expect(page.getByTestId('receipt-sha256')).toBeVisible();
  });
});
