import {
  test as base,
  expect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

const apiBase = "http://127.0.0.1:5003/api";
type RecordData = Record<string, unknown> & { id: number };
type Api = {
  create: (
    resource: string,
    data: Record<string, unknown>,
  ) => Promise<RecordData>;
  get: (resource: string) => Promise<RecordData[]>;
  remember: (resource: string, id: number) => void;
};

// API-oprettede forudsætninger og browseroprettede rækker slettes i omvendt rækkefølge.
// Selve databasen er en særskilt midlertidig fil for hele testkørslen.
export const test = base.extend<{
  api: Api;
  browserDiagnostics: void;
  authenticated: void;
}>({
  authenticated: [
    async ({ request, context }, use) => {
      const response = await request.post(`${apiBase}/auth/login`, {
        data: {
          email: "sofie.andersen@example.com",
          password: "Fairplan2026!",
        },
      });
      expect(response.status()).toBe(200);
      const session = await response.json();
      apiTokens.set(request, session.token);
      await context.addInitScript((token) => {
        window.localStorage.setItem("fairplan_token", token);
      }, session.token);
      await use();
    },
    { auto: true },
  ],
  api: async ({ request }, use) => {
    const cleanup: { resource: string; id: number }[] = [];
    const remember = (resource: string, id: number) =>
      cleanup.push({ resource, id });
    await use({
      remember,
      create: async (resource, data) => {
        const response = await request.post(`${apiBase}/${resource}`, {
          data:
            resource === "users"
              ? { password: "Testkode2026!", ...data }
              : data,
          headers: { Authorization: `Bearer ${apiTokens.get(request)}` },
        });
        expect(response.status(), await response.text()).toBe(201);
        const item = (await response.json()) as RecordData;
        remember(resource, item.id);
        return item;
      },
      get: async (resource) => {
        const response = await request.get(`${apiBase}/${resource}`, {
          headers: { Authorization: `Bearer ${apiTokens.get(request)}` },
        });
        expect(response.ok()).toBeTruthy();
        return await response.json();
      },
    });
    for (const item of cleanup.reverse()) {
      const response = await request.delete(
        `${apiBase}/${item.resource}/${item.id}`,
        { headers: { Authorization: `Bearer ${apiTokens.get(request)}` } },
      );
      expect([200, 404], await response.text()).toContain(response.status());
    }
  },
  browserDiagnostics: [
    async ({ page }, use, testInfo) => {
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];
      const failedResponses: Promise<unknown>[] = [];
      const serverErrors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.on("response", (response) => {
        if (response.status() >= 400 && response.url().includes("/api/")) {
          failedResponses.push(
            response
              .text()
              .catch(() => "<response unavailable>")
              .then((body) => ({
                url: response.url(),
                status: response.status(),
                body,
              })),
          );
          if (response.status() >= 500)
            serverErrors.push(`${response.status()} ${response.url()}`);
        }
      });
      await use();
      await testInfo.attach("browser-diagnostics", {
        body: JSON.stringify(
          {
            consoleErrors,
            pageErrors,
            failedResponses: await Promise.all(failedResponses),
          },
          null,
          2,
        ),
        contentType: "application/json",
      });
      expect(pageErrors, "Uncaught browser errors").toEqual([]);
      expect(serverErrors, "Unexpected backend failures").toEqual([]);
      expect(
        consoleErrors.filter((message) =>
          /hydrat|cannot be a descendant|cannot contain/i.test(message),
        ),
        "Invalid markup/hydration",
      ).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
const apiTokens = new WeakMap<APIRequestContext, string>();

export async function submitAndRemember(
  page: Page,
  api: Api,
  resource: string,
  button: string,
) {
  const result = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/${resource}`) &&
      response.request().method() === "POST",
  );
  await page
    .locator("form.editor")
    .getByRole("button", { name: button, exact: true })
    .click();
  const response = await result;
  expect(response.status(), await response.text()).toBe(201);
  const record = await response.json();
  api.remember(resource, record.id);
  await expect(page.locator("form.editor")).toHaveCount(0);
  return record as RecordData;
}

export async function deleteRow(page: Page, name: string) {
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: `Slet ${name}`, exact: true }).click();
  await expect(
    page.getByRole("button", { name: `Slet ${name}`, exact: true }),
  ).toHaveCount(0);
}

export async function checkApiRejected(
  request: APIRequestContext,
  resource: string,
  data: Record<string, unknown>,
  status: number,
  message: RegExp,
) {
  const response = await request.post(`${apiBase}/${resource}`, {
    data,
    headers: { Authorization: `Bearer ${apiTokens.get(request)}` },
  });
  expect(response.status()).toBe(status);
  expect((await response.json()).error).toMatch(message);
}
