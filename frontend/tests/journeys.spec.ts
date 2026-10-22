import {
  test,
  expect,
  submitAndRemember,
  deleteRow,
  checkApiRejected,
} from "./fixtures";

test("perioder: opret, ret, søg, sortér, filtrér og slet med permanente data", async ({
  page,
  api,
}) => {
  await api.create("periods", {
    name: "E2E A periode",
    start_date: "2039-12-01",
    end_date: "2039-12-31",
  });
  await page.goto("/perioder");
  await page
    .getByRole("button", { name: "Opret periode", exact: true })
    .click();
  const dialog = page.locator("form.editor");
  await dialog.getByLabel("Periodens navn").fill("E2E Z periode");
  await dialog.getByLabel("Startdato").fill("2040-01-01");
  await dialog.getByLabel("Slutdato").fill("2040-01-31");
  const saved = await submitAndRemember(page, api, "periods", "Opret periode");
  await page.reload();
  await expect(
    page.getByRole("row").filter({ hasText: "E2E Z periode" }),
  ).toBeVisible();
  expect(
    (await api.get("periods")).find((item) => item.id === saved.id)?.name,
  ).toBe("E2E Z periode");
  await page
    .getByRole("button", { name: "Rediger E2E Z periode", exact: true })
    .click();
  await dialog.getByLabel("Periodens navn").fill("E2E B periode");
  await dialog.getByLabel("Slutdato").fill("2040-02-01");
  await dialog.getByRole("button", { name: "Gem ændringer" }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("searchbox").fill("E2E");
  await page.getByRole("button", { name: /^Periode/ }).click();
  await expect(page.locator("tbody tr strong")).toHaveText([
    "E2E A periode",
    "E2E B periode",
  ]);
  await page.getByRole("button", { name: /^Periode/ }).click();
  await expect(page.locator("tbody tr strong")).toHaveText([
    "E2E B periode",
    "E2E A periode",
  ]);
  await page.getByLabel("Status", { exact: true }).selectOption("past");
  await expect(
    page.getByText("Ingen perioder matcher", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Status", { exact: true }).selectOption("upcoming");
  await page.getByRole("searchbox").fill("E2E B");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await deleteRow(page, "E2E B periode");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Rediger E2E B periode", exact: true }),
  ).toHaveCount(0);
});

test("overlappende perioder afvises i backend og formularen bevarer indtastningen", async ({
  page,
}) => {
  await page.goto("/perioder");
  const opener = page.getByRole("button", {
    name: "Opret periode",
    exact: true,
  });
  await opener.click();
  const dialog = page.locator("form.editor");
  await dialog.getByLabel("Periodens navn").fill("E2E overlap");
  await dialog.getByLabel("Startdato").fill("2026-10-10");
  await dialog.getByLabel("Slutdato").fill("2026-10-09");
  await dialog
    .getByRole("button", { name: "Opret periode", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "Slutdato skal være efter startdato.",
  );
  await dialog.getByLabel("Slutdato").fill("2026-10-20");
  const rejection = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/periods") && response.status() === 409,
  );
  await dialog
    .getByRole("button", { name: "Opret periode", exact: true })
    .click();
  await rejection;
  await expect(dialog.getByRole("alert")).toContainText("overlapper");
  await expect(dialog.getByLabel("Periodens navn")).toHaveValue("E2E overlap");
  await expect(dialog.getByLabel("Startdato")).toHaveValue("2026-10-10");
  await expect(dialog.getByLabel("Slutdato")).toHaveValue("2026-10-20");
  await dialog.getByRole("button", { name: "Annuller" }).click();
  await expect(dialog).toHaveCount(0);
});

test("organisering: begge faner kan oprette, rette, finde, filtrere og slette", async ({
  page,
  api,
}) => {
  await page.goto("/organisering");
  for (const item of [
    {
      tab: "Afsnit",
      resource: "sections",
      singular: "afsnit",
      filter: "Filtrér afsnit efter ansættelser",
    },
    {
      tab: "Personalegrupper",
      resource: "staff-groups",
      singular: "personalegruppe",
      filter: "Filtrér personalegrupper efter ansættelser",
    },
  ]) {
    await page
      .getByRole("navigation", { name: "Organisering", exact: true })
      .getByRole("button", { name: item.tab, exact: true })
      .click();
    const name = `E2E ${item.singular}`;
    await page
      .getByRole("button", { name: `Opret ${item.singular}`, exact: true })
      .click();
    const dialog = page.locator("form.editor");
    await dialog.getByLabel("Navn", { exact: true }).fill(name);
    if (item.resource === "sections") {
      await dialog.getByLabel("HEX-farve").fill("#XYZ");
      await dialog
        .getByRole("button", { name: "Opret afsnit", exact: true })
        .click();
      expect(
        await dialog
          .getByLabel("HEX-farve")
          .evaluate((input: HTMLInputElement) => input.validity.valid),
      ).toBe(false);
      await dialog.getByLabel("HEX-farve").fill("#abc");
    }
    await submitAndRemember(page, api, item.resource, `Opret ${item.singular}`);
    await page.getByRole("searchbox").fill(name);
    await expect(page.locator("tbody tr")).toHaveCount(1);
    if (item.resource === "sections")
      await expect(page.locator("tbody")).toContainText("#AABBCC");
    await page.getByLabel(item.filter).selectOption("used");
    await expect(page.locator("tbody tr")).toHaveCount(0);
    await page.getByLabel(item.filter).selectOption("unused");
    await page
      .getByRole("button", { name: `Rediger ${name}`, exact: true })
      .click();
    await dialog.getByLabel("Navn", { exact: true }).fill(`${name} rettet`);
    await dialog.getByRole("button", { name: "Gem ændringer" }).click();
    await expect(dialog).toHaveCount(0);
    await page.getByRole("button", { name: /^Navn/ }).click();
    await expect(
      page.getByRole("button", {
        name: "Navn ↕",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.locator("tbody")).toContainText(`${name} rettet`);
    await deleteRow(page, `${name} rettet`);
    await expect(page.locator("tbody tr")).toHaveCount(0);
  }
});

test("tilknyttede afsnit, grupper og brugere er beskyttet mod sletning", async ({
  page,
  api,
}) => {
  const section = await api.create("sections", {
    name: "E2E beskyttet afsnit",
    color: "#123456",
  });
  const group = await api.create("staff-groups", {
    name: "E2E beskyttet gruppe",
  });
  const user = await api.create("users", {
    name: "E2E beskyttet person",
    email: "protected@example.com",
    is_admin: true,
    is_staff: true,
  });
  await api.create("employments", {
    user_id: user.id,
    section_id: section.id,
    staff_group_id: group.id,
    hours_per_week: 20,
    start_date: "2040-01-01",
    end_date: "2040-02-01",
  });
  for (const target of [
    { url: "/organisering", name: section.name as string, tab: "Afsnit" },
    {
      url: "/organisering",
      name: group.name as string,
      tab: "Personalegrupper",
    },
    { url: "/adgangsstyring", name: user.name as string, tab: "Adgange" },
  ]) {
    await page.goto(target.url);
    await page
      .locator("nav.tabs")
      .getByRole("button", { name: target.tab, exact: true })
      .click();
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: `Slet ${target.name}`, exact: true })
      .click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "ansættelser",
    );
    await expect(
      page.getByRole("button", { name: `Rediger ${target.name}`, exact: true }),
    ).toBeVisible();
  }
  await page
    .getByRole("button", { name: `Rediger ${user.name}`, exact: true })
    .click();
  await page
    .locator("form.editor")
    .getByLabel("Personale", { exact: true })
    .uncheck();
  await page
    .locator("form.editor")
    .getByRole("button", { name: "Gem ændringer" })
    .click();
  await expect(page.locator("form.editor").getByRole("alert")).toContainText(
    "Personale-rollen kan ikke fjernes",
  );
});

test("brugere: obligatoriske roller, unik e-mail og redigering", async ({
  page,
  api,
}) => {
  await page.goto("/adgangsstyring");
  await page.getByRole("button", { name: "Opret bruger", exact: true }).click();
  const dialog = page.locator("form.editor");
  await dialog.getByLabel("Navn", { exact: true }).fill("E2E bruger");
  await dialog.getByLabel("Adgangskode", { exact: true }).fill("Testkode2026!");
  await dialog
    .getByLabel("E-mail", { exact: true })
    .fill("Anna.Moller@example.com");
  await dialog.getByLabel("Personale", { exact: true }).uncheck();
  await dialog
    .getByRole("button", { name: "Opret bruger", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("mindst én rolle");
  await dialog.getByLabel("Admin", { exact: true }).check();
  await dialog
    .getByRole("button", { name: "Opret bruger", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "E-mailadressen bruges allerede",
  );
  await expect(dialog.getByLabel("Navn", { exact: true })).toHaveValue(
    "E2E bruger",
  );
  await dialog
    .getByLabel("E-mail", { exact: true })
    .fill("E2E.USER@example.com");
  await submitAndRemember(page, api, "users", "Opret bruger");
  await page.getByRole("searchbox").fill("e2e.user@example.com");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByLabel("Filtrér efter rolle").selectOption("staff");
  await expect(page.locator("tbody tr")).toHaveCount(0);
  await page.getByLabel("Filtrér efter rolle").selectOption("admin");
  await page
    .getByRole("button", { name: "Rediger E2E bruger", exact: true })
    .click();
  await dialog.getByLabel("Personale", { exact: true }).check();
  await dialog.getByLabel("Navn", { exact: true }).fill("E2E bruger rettet");
  await dialog.getByRole("button", { name: "Gem ændringer" }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByLabel("Filtrér efter rolle").selectOption("both");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: "Rediger E2E bruger rettet",
      exact: true,
    }),
  ).toBeVisible();
  await deleteRow(page, "E2E bruger rettet");
});

test("ansættelser: database-dropdowns, timer, overlap, redigering og sletning", async ({
  page,
  api,
  request,
}) => {
  const section = await api.create("sections", {
    name: "E2E arbejdende afsnit",
    color: "#237A57",
  });
  const group = await api.create("staff-groups", {
    name: "E2E arbejdende gruppe",
  });
  const user = await api.create("users", {
    name: "E2E medarbejder",
    email: "employee@example.com",
    is_admin: false,
    is_staff: true,
  });
  const admin = await api.create("users", {
    name: "E2E kun administrator",
    email: "admin-only@example.com",
    is_admin: true,
    is_staff: false,
  });
  await page.goto("/adgangsstyring");
  await page
    .locator("nav.tabs")
    .getByRole("button", { name: "Ansættelser", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Opret ansættelse", exact: true })
    .click();
  const dialog = page.locator("form.editor");
  await expect(
    dialog
      .getByRole("combobox", { name: "Person", exact: true })
      .locator(`option[value="${admin.id}"]`),
  ).toHaveCount(0);
  await dialog
    .getByRole("combobox", { name: "Person", exact: true })
    .selectOption(String(user.id));
  await dialog
    .getByRole("combobox", { name: "Afsnit", exact: true })
    .selectOption(String(section.id));
  await dialog
    .getByRole("combobox", { name: "Personalegruppe", exact: true })
    .selectOption(String(group.id));
  await dialog.getByLabel("Startdato", { exact: true }).fill("2042-01-01");
  await dialog.getByLabel("Slutdato", { exact: true }).fill("2042-01-31");
  await dialog.getByLabel("Timer pr. uge", { exact: false }).fill("38");
  await dialog
    .getByRole("button", { name: "Opret ansættelse", exact: true })
    .click();
  expect(
    await dialog
      .getByLabel("Timer pr. uge", { exact: false })
      .evaluate((input: HTMLInputElement) => input.validity.rangeOverflow),
  ).toBe(true);
  const data = {
    user_id: user.id,
    section_id: section.id,
    staff_group_id: group.id,
    hours_per_week: 38,
    start_date: "2042-01-01",
    end_date: "2042-01-31",
  };
  await checkApiRejected(request, "employments", data, 400, /Timer/);
  await checkApiRejected(
    request,
    "employments",
    { ...data, hours_per_week: 1.5 },
    400,
    /heltal/,
  );
  await dialog.getByLabel("Timer pr. uge", { exact: false }).fill("32");
  await submitAndRemember(page, api, "employments", "Opret ansættelse");
  await page.getByRole("searchbox").fill("E2E medarbejder");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page
    .getByLabel("Filtrér efter afsnit", { exact: true })
    .selectOption(String(section.id));
  await page
    .getByLabel("Filtrér efter personalegruppe", { exact: true })
    .selectOption(String(group.id));
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Opret ansættelse", exact: true })
    .click();
  await dialog
    .getByRole("combobox", { name: "Person", exact: true })
    .selectOption(String(user.id));
  await dialog
    .getByRole("combobox", { name: "Afsnit", exact: true })
    .selectOption(String(section.id));
  await dialog
    .getByRole("combobox", { name: "Personalegruppe", exact: true })
    .selectOption(String(group.id));
  await dialog.getByLabel("Startdato", { exact: true }).fill("2042-01-31");
  await dialog.getByLabel("Slutdato", { exact: true }).fill("2042-02-28");
  await dialog
    .getByRole("button", { name: "Opret ansættelse", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("overlapper");
  await expect(
    dialog.getByRole("combobox", { name: "Person", exact: true }),
  ).toHaveValue(String(user.id));
  await dialog.getByLabel("Startdato", { exact: true }).fill("2042-02-01");
  await dialog.getByLabel("Timer pr. uge", { exact: false }).fill("0");
  await submitAndRemember(page, api, "employments", "Opret ansættelse");
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await page
    .locator("tbody tr")
    .first()
    .getByRole("button", { name: /^Rediger/ })
    .click();
  await dialog.getByLabel("Timer pr. uge", { exact: false }).fill("30");
  await dialog.getByRole("button", { name: "Gem ændringer" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("tbody")).toContainText("30");
  for (let index = 0; index < 2; index++) {
    page.once("dialog", (confirmation) => confirmation.accept());
    await page
      .locator("tbody tr")
      .first()
      .getByRole("button", { name: /^Slet/ })
      .click();
    await expect(page.locator("tbody tr")).toHaveCount(1 - index);
  }
  await expect(
    page.getByText("Ingen ansættelser matcher", { exact: true }),
  ).toBeVisible();
});

test("personale følger periodeoverlap og er skrivebeskyttet med søgning og filtre", async ({
  page,
  api,
}) => {
  const first = await api.create("periods", {
    name: "E2E personalets januar",
    start_date: "2041-01-01",
    end_date: "2041-01-31",
  });
  const second = await api.create("periods", {
    name: "E2E personalets februar",
    start_date: "2041-02-01",
    end_date: "2041-02-28",
  });
  const section = await api.create("sections", {
    name: "E2E personalets afsnit",
    color: "#123456",
  });
  const group = await api.create("staff-groups", {
    name: "E2E personalets gruppe",
  });
  const user = await api.create("users", {
    name: "E2E periodeskift",
    email: "period-switch@example.com",
    is_admin: false,
    is_staff: true,
  });
  const data = {
    user_id: user.id,
    section_id: section.id,
    staff_group_id: group.id,
    hours_per_week: 20,
  };
  await api.create("employments", {
    ...data,
    start_date: "2040-12-15",
    end_date: "2041-01-01",
  });
  await api.create("employments", {
    ...data,
    hours_per_week: 25,
    start_date: "2041-01-31",
    end_date: "2041-02-15",
  });
  await page.goto("/personale");
  await page.getByLabel("Vælg planperiode").selectOption(String(first.id));
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await expect(page.locator("tbody")).toContainText("E2E periodeskift");
  await expect(
    page.getByRole("button", { name: /^(Opret|Rediger|Slet)/ }),
  ).toHaveCount(0);
  await page
    .getByLabel("Filtrer efter afsnit", { exact: true })
    .selectOption(String(section.id));
  await page
    .getByLabel("Filtrer efter personalegruppe", { exact: true })
    .selectOption(String(group.id));
  await page
    .getByRole("button", { name: /^Timer pr. uge/ })
    .click();
  await expect(page.locator("tbody td:nth-child(4)")).toHaveText(["20", "25"]);
  await page
    .getByRole("button", { name: /^Timer pr. uge/ })
    .click();
  await expect(page.locator("tbody td:nth-child(4)")).toHaveText(["25", "20"]);
  await page.getByRole("searchbox").fill("ingen passer");
  await expect(
    page.getByText("Ingen medarbejdere matcher", { exact: true }),
  ).toBeVisible();
  await page.getByRole("searchbox").fill("");
  await page.getByLabel("Vælg planperiode").selectOption(String(second.id));
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody td:nth-child(4)")).toHaveText(["25"]);
  await expect(
    page.getByLabel("Filtrer efter afsnit", { exact: true }),
  ).toHaveValue("");
});

test("netværksfejl vises, og genindlæsning henter data igen", async ({
  page,
}) => {
  await page.route("**/api/sections", (route) =>
    route.abort("connectionrefused"),
  );
  await page.goto("/organisering");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Failed to fetch",
  );
  await page.unroute("**/api/sections");
  await page.reload();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
});

test("alle fire sider og begge underfaner er brugbare på desktop og mobil", async ({
  page,
}, testInfo) => {
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    const size = viewport.width === 390 ? "mobile" : "desktop";
    await page.setViewportSize(viewport);
    for (const route of [
      "perioder",
      "organisering",
      "adgangsstyring",
      "personale",
    ]) {
      await page.goto(`/${route}`);
      await expect(page.getByRole("table")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        `${route} overflows ${size}`,
      ).toBe(true);
      await expect(page.locator("tbody tr").first()).toBeVisible();
      const screenshot = testInfo.outputPath(`${route}-${size}.png`);
      await page.screenshot({ path: screenshot, fullPage: true });
      await testInfo.attach(`${route}-${size}`, {
        path: screenshot,
        contentType: "image/png",
      });
      if (route === "organisering" || route === "adgangsstyring") {
        await page.locator("nav.tabs").getByRole("button").last().click();
        await expect(page.getByRole("table")).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true);
        await expect(page.locator("tbody tr").first()).toBeVisible();
        await page.screenshot({
          path: testInfo.outputPath(`${route}-second-tab-${size}.png`),
          fullPage: true,
        });
      }
    }
    if (size === "mobile") {
      await expect(
        page.getByRole("navigation", { name: "Hovednavigation" }),
      ).toBeVisible();
      await page
        .getByRole("navigation", { name: "Hovednavigation" })
        .getByRole("link", { name: /Perioder/ })
        .click();
      await expect(page).toHaveURL(/\/perioder$/);
    }
  }
});
