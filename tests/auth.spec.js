import { test, expect } from "@playwright/test";

// Helper: fill the form on the current page and submit it.
async function submitForm(page, username, password, button) {
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: button }).click();
}

// Users are stored in the database and survive between runs,
// so each test registers a new user with a unique name first.
let username;

test.beforeEach(async ({ page }) => {
  username = `alice_${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
  await page.goto("/#/register");
  await submitForm(page, username, "secret123", "Register");
  await expect(page.getByRole("alert")).toHaveText(`Account created for ${username}. Please log in.`);
});

// Happy path
test("registered user can log in", async ({ page }) => {
  await submitForm(page, username, "secret123", "Log in");

  await expect(page).toHaveURL(/#\/welcome$/);
  await expect(page.getByRole("heading", { name: `Welcome, ${username}!` })).toBeVisible();
});

// Sad path
test("login with invalid credentials shows an error", async ({ page }) => {
  await submitForm(page, username, "wrong-pass1", "Log in");

  await expect(page.getByRole("alert")).toHaveText("Wrong message");
  await expect(page).toHaveURL(/#\/login$/);
  await expect(page.getByRole("heading", { name: "Welcome" })).toBeHidden();
});
