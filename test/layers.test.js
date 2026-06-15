const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { chromium } = require("playwright");
const { startServer } = require("./server");
const { captureConsole, disableAnimations, shoot } = require("./artifacts");
const { createCoverageReport, startCoverage, stopCoverage } = require("./coverage");

let server;
let baseURL;
let browser;
let mcr;

before(async () => {
  server = await startServer();
  baseURL = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    headless: process.env.HEADED !== "1",
    slowMo: process.env.HEADED === "1" ? Number(process.env.SLOWMO ?? 1000) : undefined,
  });
  mcr = createCoverageReport();
});

after(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  await mcr.generate();
});

async function newPage(testName) {
  const page = await browser.newPage();
  captureConsole(page, testName);
  page.on("pageerror", (err) => {
    throw err;
  });
  await startCoverage(page);
  return page;
}

async function closePage(page) {
  await stopCoverage(page, mcr);
  await page.close();
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
    await button.locator("h3").count(),
    0,
    "response must not be swapped into the triggering button",
  );
  assert.strictEqual(
    await dialog.locator("h3").count(),
    1,
    "response content must be inside the dialog",
  );

  await closePage(page);
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

  await closePage(page);
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

  await closePage(page);
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

  await closePage(page);
});

test("hx-layer=\"current\" swaps the response into the currently open layer instead of opening a new one", async (t) => {
  const page = await newPage(t.name);
  await page.goto(`${baseURL}/htmx-layers-showcase.html`);

  await disableAnimations(page);
  await page.locator('button:has-text("Open Profile")').click();
  const dialog = page.locator("dialog[data-hx-layer][open]");
  await dialog.waitFor();
  await shoot(page, t.name, "profile-open");

  await dialog.locator('button:has-text("Edit")').click();

  await assert.doesNotReject(
    dialog.getByText("Edit Profile").waitFor({ timeout: 2000 }),
  );
  await shoot(page, t.name, "current-updated");

  assert.strictEqual(
    await page.locator("dialog[data-hx-layer][open]").count(),
    1,
    "no new layer must be opened",
  );

  await closePage(page);
});

test("hx-layer=\"replace\" closes the current layer and opens the response in a new one", async (t) => {
  const page = await newPage(t.name);
  await page.goto(`${baseURL}/htmx-layers-showcase.html`);

  await disableAnimations(page);
  await page.locator('button:has-text("Delete project")').click();
  const confirmDialog = page.locator("dialog[data-hx-layer][open]:has-text('Confirm deletion')");
  await confirmDialog.waitFor();
  await shoot(page, t.name, "confirm-open");

  await confirmDialog.locator('button:has-text("Delete")').click();

  const processDialog = page.locator("dialog[data-hx-layer][open]:has-text('Deleting project')");
  await assert.doesNotReject(processDialog.waitFor({ timeout: 2000 }));
  await shoot(page, t.name, "replaced-open");

  await assert.doesNotReject(
    confirmDialog.waitFor({ state: "detached", timeout: 2000 }),
  );
  assert.strictEqual(
    await page.locator("dialog[data-hx-layer][open]").count(),
    1,
    "the confirmation dialog must be replaced, not stacked",
  );

  await closePage(page);
});

test("Escape key with no layer open is a no-op", async (t) => {
  const page = await newPage(t.name);
  await page.goto(`${baseURL}/htmx-layers-showcase.html`);
  await disableAnimations(page);

  await page.keyboard.press("Escape");

  assert.strictEqual(await page.locator("dialog[data-hx-layer]").count(), 0);
  assert.strictEqual(await page.locator(".hx-layers-backdrop").count(), 0);

  await closePage(page);
});

test("pressing a non-Escape key does not close an open layer", async (t) => {
  const page = await newPage(t.name);
  await page.goto(`${baseURL}/htmx-layers-showcase.html`);
  await disableAnimations(page);

  await page.locator('button:has-text("Open Profile")').click();
  const dialog = page.locator("dialog[data-hx-layer][open]");
  await dialog.waitFor();

  await page.keyboard.press("a");

  assert.strictEqual(await dialog.count(), 1, "layer must stay open");

  await closePage(page);
});

test("hx-layer=\"current\" with no open layer leaves the page without a new dialog", async (t) => {
  const page = await newPage(t.name);
  await page.goto(`${baseURL}/htmx-layers-showcase.html`);
  await disableAnimations(page);

  await page.locator('button:has-text("Update current layer")').click();

  await assert.doesNotReject(
    page.locator('button:has-text("Layer updated")').waitFor({ timeout: 2000 }),
  );

  assert.strictEqual(await page.locator("dialog[data-hx-layer]").count(), 0);

  await closePage(page);
});

test("hx-layer-back on an element outside any layer is a no-op", async (t) => {
  const page = await newPage(t.name);
  await page.goto(`${baseURL}/htmx-layers-showcase.html`);
  await disableAnimations(page);

  await page.evaluate(() => {
    const btn = document.createElement("button");
    btn.setAttribute("hx-layer-back", "");
    btn.id = "stray-back";
    btn.textContent = "Back";
    document.body.appendChild(btn);
  });

  await page.locator("#stray-back").click();

  assert.strictEqual(await page.locator("dialog[data-hx-layer]").count(), 0);

  await closePage(page);
});

test("hx-layer-back on an <a> inside a layer with no previous step closes the layer", async (t) => {
  const page = await newPage(t.name);
  await page.goto(`${baseURL}/htmx-layers-showcase.html`);
  await disableAnimations(page);

  await page.locator('button:has-text("Open Profile")').click();
  const dialog = page.locator("dialog[data-hx-layer][open]");
  await dialog.waitFor();

  await dialog.evaluate((el) => {
    const a = document.createElement("a");
    a.setAttribute("hx-layer-back", "");
    a.href = "#";
    a.id = "back-link";
    a.textContent = "Back";
    el.appendChild(a);
  });

  await dialog.locator("#back-link").click();

  await assert.doesNotReject(
    page.locator("dialog[data-hx-layer]").waitFor({ state: "detached", timeout: 2000 }),
  );

  await closePage(page);
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
    await page.locator("dialog[data-hx-layer]").count(),
    0,
    "dialog must be removed after returning",
  );

  await closePage(page);
});
