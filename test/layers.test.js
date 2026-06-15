const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { chromium } = require("playwright");
const { startServer } = require("./server");
const { captureConsole, disableAnimations, shoot } = require("./artifacts");

let server;
let baseURL;
let browser;

before(async () => {
  server = await startServer();
  baseURL = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    headless: process.env.HEADED !== "1",
    slowMo: process.env.HEADED === "1" ? Number(process.env.SLOWMO ?? 1000) : undefined,
  });
});

after(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});

async function newPage(testName) {
  const page = await browser.newPage();
  captureConsole(page, testName);
  page.on("pageerror", (err) => {
    throw err;
  });
  return page;
}

test("hx-layer=\"new\" opens a <dialog> and swaps the response into it (not into the button)", async (t) => {
  const page = await newPage(t.name);
  await page.goto(`${baseURL}/htmx-layers-showcase.html`);
  await disableAnimations(page);
  await shoot(page, t.name, "before");

  const button = page.locator('button:has-text("Open Profile")');
  await button.click();

  const dialog = page.locator("dialog[data-hx-layer][open]");
  await assert.doesNotReject(dialog.waitFor({ state: "attached", timeout: 2000 }));
  await shoot(page, t.name, "dialog-open");

  assert.strictEqual(await dialog.count(), 1, "exactly one open layer dialog");
  assert.strictEqual(
    await button.locator("[data-hx-layer-content]").count(),
    0,
    "response must not be swapped into the triggering button",
  );
  assert.strictEqual(
    await dialog.locator("[data-hx-layer-content] h3").count(),
    1,
    "response content must be inside the dialog's layer-content element",
  );

  await page.close();
});

test("Escape key closes the topmost layer and removes the shared backdrop", async (t) => {
  const page = await newPage(t.name);
  await page.goto(`${baseURL}/htmx-layers-showcase.html`);

  await disableAnimations(page);
  await page.locator('button:has-text("Open Profile")').click();
  await page.locator("dialog[data-hx-layer][open]").waitFor();
  await shoot(page, t.name, "dialog-open");

  await page.keyboard.press("Escape");

  await assert.doesNotReject(
    page.locator("dialog[data-hx-layer]").waitFor({ state: "detached", timeout: 2000 }),
  );
  await assert.doesNotReject(
    page.locator(".hx-layers-backdrop").waitFor({ state: "detached", timeout: 2000 }),
  );
  await shoot(page, t.name, "after-escape");

  await page.close();
});

test("nested layers: opening a layer from within a layer stacks it and marks the parent inert", async (t) => {
  const page = await newPage(t.name);
  await page.goto(`${baseURL}/htmx-layers-showcase.html`);

  await disableAnimations(page);
  await page.locator('button:has-text("Main Form")').click();
  const parent = page.locator("dialog[data-hx-layer][open]").first();
  await parent.waitFor();
  await shoot(page, t.name, "parent-open");

  await page.locator('dialog[data-hx-layer] button:has-text("Next Step")').click();

  const openDialogs = page.locator("dialog[data-hx-layer][open]");
  await assert.doesNotReject(async () => {
    await page.waitForFunction(() => document.querySelectorAll("dialog[data-hx-layer][open]").length === 2);
  });
  await shoot(page, t.name, "nested-open");
  assert.strictEqual(await openDialogs.count(), 2);

  const first = openDialogs.nth(0);
  const second = openDialogs.nth(1);
  assert.strictEqual(await first.evaluate((el) => el.inert), true, "background layer must be inert");
  assert.strictEqual(await second.evaluate((el) => el.inert), false, "top layer must stay interactive");

  // Closing the top layer restores the parent
  await second.locator('[onclick*="close"]').first().click();
  await assert.doesNotReject(async () => {
    await page.waitForFunction(
      () => {
        const open = document.querySelectorAll("dialog[data-hx-layer][open]");
        return open.length === 1 && open[0].inert === false;
      },
      { timeout: 2000 },
    );
  });
  await shoot(page, t.name, "back-to-parent");

  await page.close();
});

test("step wizard: hx-layer=\"step\" chains steps and hx-layer-back returns with state preserved", async (t) => {
  const page = await newPage(t.name);
  await page.goto(`${baseURL}/htmx-layers-showcase.html`);

  await disableAnimations(page);
  await page.locator('button:has-text("Start wizard")').click();
  await page.locator("dialog[data-hx-layer][open]").waitFor();
  await shoot(page, t.name, "step1");

  await page.locator("#wizard-name").fill("Ada Lovelace");
  await page.locator('button:has-text("Next")').click();

  const step2 = page.locator('dialog[data-hx-layer][open]:has-text("Step 2 of 3")');
  await assert.doesNotReject(step2.waitFor({ timeout: 2000 }));
  await shoot(page, t.name, "step2");
  assert.match(await step2.innerText(), /Ada Lovelace/);

  await page.locator('button:has-text("← Back")').click();

  await assert.doesNotReject(async () => {
    await page.waitForFunction(() => document.querySelector("#wizard-name") !== null);
  });
  await shoot(page, t.name, "back-to-step1");
  assert.strictEqual(await page.locator("#wizard-name").inputValue(), "Ada Lovelace");

  await page.close();
});

test("CRUD demo: editing a row and saving (hx-layer=\"return\") swaps the result into the row, not the Edit button, and closes the dialog", async (t) => {
  const page = await newPage(t.name);
  await page.goto(`${baseURL}/htmx-layers-crud-demo.html`);

  await disableAnimations(page);
  const row = page.locator('tr[data-id="1"]');
  await row.locator('button:has-text("Edit")').click();

  const dialog = page.locator("dialog[data-hx-layer][open]");
  await dialog.waitFor();
  await shoot(page, t.name, "edit-dialog-open");

  const nameInput = dialog.locator('input[name="nombre"]');
  await nameInput.fill("Ana García Updated");
  await dialog.locator('button:has-text("Save")').click();

  await assert.doesNotReject(
    page.locator("dialog[data-hx-layer]").waitFor({ state: "detached", timeout: 2000 }),
  );
  await shoot(page, t.name, "row-updated");

  assert.match(await row.innerText(), /Ana García Updated/);
  assert.strictEqual(
    await row.locator('button:has-text("Edit")').locator("[data-hx-layer-content]").count(),
    0,
  );

  await page.close();
});
