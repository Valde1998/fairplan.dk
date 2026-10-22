import { test, expect } from "@playwright/test";

test("login, begge roller, genindlæsning og logout", async ({ page }) => {
  await page.goto("/adgangsstyring");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("E-mail").fill("sofie.andersen@example.com");
  await page.getByLabel("Adgangskode").fill("forkert");
  await page.getByRole("button", { name: "Log ind", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "E-mail eller adgangskode er forkert",
  );
  await page.getByLabel("Adgangskode").fill("Fairplan2026!");
  await page.getByRole("button", { name: "Log ind", exact: true }).click();
  await expect(page).toHaveURL(/\/perioder$/);
  expect(
    await page.evaluate(() => localStorage.getItem("fairplan_token")),
  ).toBeTruthy();
  await expect(page.locator(".signed-in")).toContainText("Admin · Personale");
  await expect(
    page.getByRole("navigation", { name: "Hovednavigation" }).getByRole("link"),
  ).toHaveCount(4);
  await page.reload();
  await expect(page.getByRole("table")).toBeVisible();
  await page.getByRole("button", { name: "Log ud", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(
    await page.evaluate(() => localStorage.getItem("fairplan_token")),
  ).toBeNull();
  await page.goto("/personale");
  await expect(page).toHaveURL(/\/login$/);
});

test("personale kan se oversigten; backend afviser administration", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("anna.moller@example.com");
  await page.getByLabel("Adgangskode").fill("Fairplan2026!");
  await page.getByRole("button", { name: "Log ind", exact: true }).click();
  await expect(page).toHaveURL(/\/personale$/);
  await expect(page.getByRole("table")).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Hovednavigation" }).getByRole("link"),
  ).toHaveCount(1);
  await page
    .getByLabel("Vælg planperiode")
    .selectOption({ label: "November 2026" });
  await expect(
    page.getByRole("row").filter({ hasText: "Freja Nielsen" }),
  ).toBeVisible();
  await page.goto("/adgangsstyring");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "rollen Admin",
  );
  const token = await page.evaluate(() =>
    localStorage.getItem("fairplan_token"),
  );
  expect(
    (
      await page.request.get("/api/users", {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).status(),
  ).toBe(403);
});

test("tilbagekaldt token sendes til login ved genindlæsning", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("sofie.andersen@example.com");
  await page.getByLabel("Adgangskode").fill("Fairplan2026!");
  await page.getByRole("button", { name: "Log ind", exact: true }).click();
  await expect(page).toHaveURL(/\/perioder$/);
  const token = await page.evaluate(() =>
    localStorage.getItem("fairplan_token"),
  );
  const response = await page.request.post("/api/auth/logout", {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.status()).toBe(200);
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
  expect(
    await page.evaluate(() => localStorage.getItem("fairplan_token")),
  ).toBeNull();
});

test("egen bruger opdaterer menuen, og ny adgangskode kræver login", async ({
  page,
  request,
}) => {
  const login = await request.post("/api/auth/login", {
    data: {
      email: "sofie.andersen@example.com",
      password: "Fairplan2026!",
    },
  });
  const admin = await login.json();
  const headers = { Authorization: `Bearer ${admin.token}` };
  const email = `e2e-self-${Date.now()}@example.com`;
  const created = await request.post("/api/users", {
    headers,
    data: {
      name: "E2E egen bruger",
      email,
      is_admin: true,
      is_staff: false,
      password: "Testkode2026!",
    },
  });
  expect(created.status()).toBe(201);
  const user = await created.json();
  try {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Adgangskode").fill("Testkode2026!");
    await page.getByRole("button", { name: "Log ind", exact: true }).click();
    await expect(page).toHaveURL(/\/perioder$/);
    await page
      .getByRole("link", { name: "Adgangsstyring", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Rediger E2E egen bruger", exact: true })
      .click();
    const dialog = page.locator("form.editor");
    await dialog.getByLabel("Navn", { exact: true }).fill("E2E nyt navn");
    await dialog
      .getByRole("button", { name: "Gem ændringer", exact: true })
      .click();
    await expect(page.locator(".signed-in")).toContainText("E2E nyt navn");
    await page
      .getByRole("button", { name: "Rediger E2E nyt navn", exact: true })
      .click();
    await dialog.getByLabel("Ny adgangskode (valgfri)").fill("NyTestkode2026!");
    await dialog
      .getByRole("button", { name: "Gem ændringer", exact: true })
      .click();
    await expect(page).toHaveURL(/\/login$/);
    expect(
      await page.evaluate(() => localStorage.getItem("fairplan_token")),
    ).toBeNull();
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Adgangskode").fill("NyTestkode2026!");
    await page.getByRole("button", { name: "Log ind", exact: true }).click();
    await expect(page).toHaveURL(/\/perioder$/);
  } finally {
    expect(
      (await request.delete(`/api/users/${user.id}`, { headers })).status(),
    ).toBe(200);
  }
});
