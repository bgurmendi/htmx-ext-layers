# htmx-ext-layers

[Repository](https://github.com/bgurmendi/htmx-ext-layers) · [Online demo](https://htmlpreview.github.io/?https://github.com/bgurmendi/htmx-ext-layers/blob/main/htmx-layers-demo.html)

An [htmx](https://htmx.org) extension that adds **stacked dialog layers** to your application. Open content in a modal `<dialog>` "layer", stack layers on top of each other, update the current layer in place, or close a layer and swap its result back into the page that opened it — all driven declaratively from your HTML and/or server response headers.

## Features

- **`hx-layer="new"`** — opens the response content in a new modal `<dialog>` layer, stacked on top of any existing layers.
- **`hx-layer="current"`** — swaps content into the layer the triggering element belongs to (or the topmost open layer).
- **`hx-layer="close"`** — swaps the response into the element that originally opened the layer, then closes the layer.
- **`HX-Layer` response header** — lets the server decide the layer behavior (`new`, `current`, `close`, or `none`) instead of (or in addition to) the `hx-layer` attribute.
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

The response is swapped into a freshly created `<dialog>` element, which is shown using `dialog.showModal()`.

### Update the current layer

Use `hx-layer="current"` from inside a layer to update its content in place:

```html
<button hx-get="/api/edit-profile" hx-layer="current">
  Edit
</button>
```

If no `hx-layer` attribute or `HX-Layer` header is present but the triggering element is inside an open layer, the extension defaults to `current` mode.

### Close the layer and return content to the opener

```html
<button hx-post="/api/save-profile" hx-layer="close">
  Save
</button>
```

The response is swapped into the element that originally triggered `hx-layer="new"`, and the dialog is closed once the swap settles.

### Nested layers

Any `hx-layer="new"` request triggered from inside a layer opens a new dialog stacked on top of the current one — useful for multi-step forms or wizards.

### Server-driven behavior

Instead of (or in addition to) `hx-layer`, the server can respond with the `HX-Layer` header to control the swap behavior (`new`, `current`, `close`, or `none`), and with `HX-Retarget` to choose a CSS selector for where the content should be swapped within the layer or page.

## Demo

A self-contained demo is included at [`htmx-layers-demo.html`](htmx-layers-demo.html). It uses [demo.htmx.org](https://demo.htmx.org) (loaded from [`vendor/demo.htmx.org.js`](vendor/demo.htmx.org.js)) to simulate server responses based on the `<template url="...">` blocks defined at the bottom of the page — no backend required.

You can try it online directly from GitHub: https://htmlpreview.github.io/?https://github.com/bgurmendi/htmx-ext-layers/blob/main/htmx-layers-demo.html

To run it locally:

1. Serve the repository root with any static file server, for example:
   ```bash
   npx serve .
   # or
   python3 -m http.server
   ```
2. Open `http://localhost:<port>/htmx-layers-demo.html` in your browser.

The demo showcases:

- Opening dialogs in new layers (`hx-layer="new"`)
- Updating content within the currently open layer (`hx-layer="current"`)
- Closing a layer and returning a result to the opener (`hx-layer="close"`)
- Nested layers (a dialog opening another dialog on top of it)

## Browser support

The extension relies on the native HTML [`<dialog>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog) element and its `showModal()` / `close()` APIs, which are supported by all current major browsers.

## License

[GPL-3.0](LICENSE). htmx itself is distributed under the BSD 2-Clause license, which is compatible with the GPL, so this extension can be used alongside htmx without licensing conflicts.
