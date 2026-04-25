import { test, expect } from "@playwright/test";

/**
 * Smoke test: hits unauthenticated routes to verify the app boots and
 * the login page renders the email form. Authenticated flows require a
 * Firebase test user; out of scope for this smoke pass.
 */

test("landing page renders and links to login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/.+/);
  // Either redirects to /login or shows a sign-in CTA.
  const hasLoginCta = await page
    .getByRole("link", { name: /sign in/i })
    .first()
    .isVisible()
    .catch(() => false);
  if (!hasLoginCta) {
    await expect(page).toHaveURL(/\/login/);
  }
});

test("login page shows the email and password fields", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
  await expect(page.getByLabel(/password/i)).toBeVisible();
  await expect(
    page.getByRole("button", { name: /sign in|continue|log in/i }),
  ).toBeVisible();
});
