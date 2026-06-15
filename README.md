# htmx-ext-layers

[Repository](https://github.com/bgurmendi/htmx-ext-layers) · [Online demo](https://bgurmendi.github.io/htmx-ext-layers/htmx-layers-showcase.html) . [Online CRUD App](https://bgurmendi.github.io/htmx-ext-layers/htmx-layers-crud-demo.html)

[![Tests](https://github.com/bgurmendi/htmx-ext-layers/actions/workflows/test.yml/badge.svg)](https://github.com/bgurmendi/htmx-ext-layers/actions/workflows/test.yml)
[![Coverage](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/bgurmendi/htmx-ext-layers/develop/badges/coverage.json)](#code-coverage)

An [htmx](https://htmx.org) extension that adds **stacked dialog layers** to your application. Open content in a modal `<dialog>` "layer", stack layers on top of each other, update the current layer in place, or return a result from a layer back to the page that opened it — all driven declaratively from your HTML and/or server response headers.

## Features

- **`hx-layer="new"`** — opens the response content in a new modal `<dialog>` layer, stacked on top of any existing layers.
- **`hx-layer="current"`** — swaps content into the layer the triggering element belongs to (or the topmost open layer).
- **`hx-layer="step"`** — opens the response content in a new layer, hiding the current one and chaining it as the previous step — ideal for multi-step wizards.
- **`hx-layer-back`** — on any button or link inside a layer, discards the current step and reveals the previous one in the chain, with its state intact.
- **`hx-layer="replace"`** — closes the current layer (and any steps chained to it) and opens the response content in a brand new layer — no "back" navigation, useful for ending a wizard into a follow-up dialog (e.g. a background process/log) or swapping one standalone dialog for another.
- **`hx-layer="return"`** — swaps the response into the element that originally opened the layer chain, then closes the layer and removes any previous steps chained to it.
- **`HX-Layer` response header** — lets the server decide the layer behavior (`new`, `current`, `return`, `step`, `replace`, or `none`) instead of (or in addition to) the `hx-layer` attribute.
- **`HX-Retarget` response header** — lets the server choose where inside the layer (or page) the response content is swapped.
- **Nested layers** — layers can open further layers on top of themselves, forming a stack.

## Installation

The extension is a single, dependency-free JavaScript file (besides htmx itself).

### Via `<script>` tag

Include htmx, then include the extension script after it, and enable it on the page (or a parent element) with `hx-ext="layers"`:

```html
<script src="https://unpkg.com/htmx.org@1.9.10"></script>
<script src="https://unpkg.com/htmx-ext-layers/src/htmx-ext-layers.js"></script>

<body hx-ext="layers">
  ...
</body>
```

### Local copy

Copy [`src/htmx-ext-layers.js`](src/htmx-ext-layers.js) into your project and reference it locally:

```html
<script src="/assets/js/htmx-ext-layers.js"></script>
```

## Usage

Enable the extension on `<body>` (or any ancestor element) using `hx-ext="layers"`. Then control layer behavior per-element via the `hx-layer` attribute, or per-response via the `HX-Layer` HTTP header.

### Open content in a new layer

```html
<button hx-get="/api/profile" hx-layer="new">
  Open Profile
</button>
```

The response is swapped into a freshly created `<dialog>` element, which is shown using `dialog.show()`.

### Update the current layer

Use `hx-layer="current"` from inside a layer to update its content in place:

```html
<button hx-get="/api/edit-profile" hx-layer="current">
  Edit
</button>
```

If no `hx-layer` attribute or `HX-Layer` header is present but the triggering element is inside an open layer, the extension defaults to `current` mode.

### Return content to the opener and close the layer

```html
<button hx-post="/api/save-profile" hx-layer="return">
  Save
</button>
```

The response is swapped into the element that originally triggered `hx-layer="new"`, and the dialog is closed once the swap settles.

### Nested layers

Any `hx-layer="new"` request triggered from inside a layer opens a new dialog stacked on top of the current one — useful for multi-step forms or wizards.

### Multi-step wizards with `hx-layer="step"` and `hx-layer-back`

Use `hx-layer="step"` instead of `hx-layer="new"` to build a wizard where each step replaces the previous one:

```html
<!-- Step 1 -->
<button hx-get="/wizard/step-2" hx-layer="step">
  Next →
</button>
```

When the response arrives, the new step opens in its own `<dialog>` and the current one is hidden (not destroyed) and chained as its "previous step". From the new step, a plain client-side button can go back without any request:

```html
<!-- Step 2 -->
<button type="button" hx-layer-back>← Back</button>
```

`hx-layer-back` discards the current step's dialog and re-shows the previous one, with all its form state preserved. On the final step, `hx-layer="return"` swaps its response into the element that opened step 1 and removes the entire chain of steps from the DOM:

```html
<!-- Step 3 (final) -->
<button hx-post="/wizard/finish" hx-layer="return">
  Finish
</button>
```

Closing a step at any point — via `hx-layer="return"`, `onclick="this.closest('dialog').close()"`, or the Escape key — cleans up the whole chain of previous steps, not just the current dialog.

### Replacing a layer with `hx-layer="replace"`

Use `hx-layer="replace"` to close the current layer (and any steps chained to it, with no way back) and open the response content in a fresh layer. This is useful for:

- Ending a wizard into a follow-up dialog, e.g. one that shows the progress/log of a background process kicked off by the final step.
- Swapping one standalone dialog for another unrelated one, without involving a wizard chain at all.

```html
<!-- Last step of a wizard, or any standalone dialog -->
<button hx-post="/process/start" hx-layer="replace">
  Start process
</button>
```

The current dialog (and its chain of previous steps, if any) is closed and removed, and the response opens in a new dialog. The new dialog inherits the original opener as its return target, so a later `hx-layer="return"` from it still swaps its result back into the element that started the chain.

### Server-driven behavior

Instead of (or in addition to) `hx-layer`, the server can respond with the `HX-Layer` header to control the swap behavior (`new`, `current`, `return`, or `none`), and with `HX-Retarget` to choose a CSS selector for where the content should be swapped within the layer or page.

## Demos

Two self-contained demos are included. Both use [demo.htmx.org](https://demo.htmx.org) (loaded from [`vendor/demo.htmx.org.js`](vendor/demo.htmx.org.js)) to simulate server responses based on the `<template url="...">` blocks defined at the bottom of each page — no backend required.

To run either locally:

1. Serve the repository root with any static file server, for example:
   ```bash
   npx serve .
   # or
   python3 -m http.server
   ```
2. Open `http://localhost:<port>/<file>.html` in your browser (see below for each demo's file name).

### Feature showcase

[`htmx-layers-showcase.html`](htmx-layers-showcase.html) — try it online: https://bgurmendi.github.io/htmx-ext-layers/htmx-layers-showcase.html

This demo showcases:

- Opening dialogs in new layers (`hx-layer="new"`)
- Updating content within the currently open layer (`hx-layer="current"`)
- Returning a result to the opener and closing the layer (`hx-layer="return"`)
- Nested layers (a dialog opening another dialog on top of it)
- A multi-step wizard with `hx-layer="step"` and `hx-layer-back`
- Replacing a confirmation dialog with a follow-up one (`hx-layer="replace"`)

### CRUD demo

[`htmx-layers-crud-demo.html`](htmx-layers-crud-demo.html) — try it online: https://bgurmendi.github.io/htmx-ext-layers/htmx-layers-crud-demo.html

A more applied example: a customers table where rows are edited in a dialog (`hx-layer="new"` + `hx-layer="return"`, targeting the row itself), and per-row actions open multi-step wizards built with `hx-layer="step"`, `hx-layer-back`, and `hx-layer="replace"`. This demo shows:

- Editing a table row in a dialog and updating it in place on save
- A "Send email" wizard (pick a template → edit the message → send, with a progress/confirmation step)
- A "New customer" wizard (pick Person/Company → fill in details → insert the new row into the table)

## Browser support

The extension relies on the native HTML [`<dialog>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog) element and its `show()` / `close()` APIs, which are supported by all current major browsers.

## Tests

End-to-end tests use [Playwright](https://playwright.dev) (via Node's built-in test runner) to drive the demos in a real browser and check that layers, nesting, the step wizard, the Escape key and the CRUD flow all behave as documented above.

1. Install dependencies (only needed once):
   ```bash
   npm install
   npx playwright install chromium
   ```
2. Run the tests:
   ```bash
   npm test
   ```

The tests spin up a local static server for the repository and open the demo pages in headless Chromium — no manual server setup needed.

To watch the tests run in a visible browser window (useful while debugging), set `HEADED=1`. Each action is slowed down by 1 second by default; override with `SLOWMO` (milliseconds):

```bash
HEADED=1 npm test
HEADED=1 SLOWMO=300 npm test
```

Each run writes screenshots taken at key points (dialog opened, nested layer stacked, after Escape, wizard steps, CRUD save, ...) plus the page's console output to `test/artifacts/<test-name>/`. These are git-ignored, regenerated on every run, and are the quickest way to check what a test actually saw on screen.

### Code coverage

Each run also collects V8 coverage of [`src/htmx-ext-layers.js`](src/htmx-ext-layers.js) and writes a report to `coverage/` (git-ignored):

- `coverage/index.html` — open in a browser for an annotated, line-by-line view.
- `coverage/lcov.info` — for tooling/CI integrations that consume LCOV.

A summary table is also printed at the end of `npm test`.

## License

[GPL-3.0](LICENSE). htmx itself is distributed under the BSD 2-Clause license, which is compatible with the GPL, so this extension can be used alongside htmx without licensing conflicts.
