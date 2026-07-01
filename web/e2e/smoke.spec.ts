import { test, expect } from "@playwright/test";

test("landing page renders the degen hero, wallet connect, and how-it-works", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Launch an AI agent/i })).toBeVisible();
  // Wallet connect entry point is present in the nav.
  await expect(page.getByRole("button", { name: /connect wallet/i })).toBeVisible();
  // The three-step explainer.
  await expect(page.getByText(/How it works/i)).toBeVisible();
  await expect(page.getByText(/Launch the token/i)).toBeVisible();
});

test("can navigate from landing to the create wizard", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Deploy your agent/i }).click();
  await expect(page).toHaveURL(/\/create$/);
  // Create wizard fields render: name, the skill file, and the bring-your-own-model endpoint.
  await expect(page.getByPlaceholder(/Degen Oracle/i)).toBeVisible();
  await expect(page.getByPlaceholder(/market-sage/i)).toBeVisible();
  await expect(page.getByPlaceholder(/ngrok/i)).toBeVisible();
});
