htmx.defineExtension("layers", {
  onEvent(name, event) {
    if (name === "htmx:beforeSwap") {
      beforeSwap(event);
    }

    if (name === "htmx:afterSettle") {
      afterSettle(event);
    }
  },
});

function beforeSwap(event) {
  const { elt, xhr } = event.detail;

  const currentLayer = getCurrentLayer(elt);

  let mode = xhr.getResponseHeader("HX-Layer") || elt.getAttribute("hx-layer");

  if (!mode && currentLayer) {
    mode = "current";
  }

  if (!mode || mode === "none") return;

  if (mode === "new") {
    const parentLayer = currentLayer;
    const returnTarget = event.detail.target;

    const dialog = createLayer({ returnTarget, parentLayer });

    event.detail.target = getLayerContent(dialog);
    dialog._hxCloseAfterSettle = false;

    dialog.showModal();
    return;
  }

  if (mode === "current") {
    const layer = currentLayer || getTopLayer();
    if (!layer) return;

    event.detail.target = resolveLayerTarget(event, layer);
    return;
  }

  if (mode === "close") {
    const layer = currentLayer || getTopLayer();
    if (!layer) return;

    const returnTarget = layer._hxReturnTarget;
    if (!returnTarget) {
      event.detail.shouldSwap = false;
      layer.close();
      return;
    }

    event.detail.target = returnTarget;
    layer._hxCloseAfterSettle = true;
    return;
  }
}

function afterSettle(event) {
  const { elt, xhr } = event.detail;

  const mode =
    xhr?.getResponseHeader("HX-Layer") || elt?.getAttribute("hx-layer");

  if (mode !== "close") return;

  const layer = getCurrentLayer(elt) || getTopLayer();
  if (!layer?._hxCloseAfterSettle) return;

  layer.close();
}

function createLayer({ returnTarget, parentLayer }) {
  const dialog = document.createElement("dialog");

  dialog.dataset.hxLayer = "";
  dialog.innerHTML = `<div data-hx-layer-content></div>`;

  dialog._hxReturnTarget = returnTarget;
  dialog._hxParentLayer = parentLayer || null;

  dialog.addEventListener("close", () => dialog.remove());

  document.body.appendChild(dialog);

  return dialog;
}

function resolveLayerTarget(event, layer) {
  const { elt, xhr, target } = event.detail;

  const retarget = xhr.getResponseHeader("HX-Retarget");
  if (retarget) {
    return (
      layer.querySelector(retarget) ||
      document.querySelector(retarget) ||
      target
    );
  }

  const hxTarget = elt.getAttribute("hx-target");
  if (hxTarget) {
    return (
      layer.querySelector(hxTarget) ||
      document.querySelector(hxTarget) ||
      target
    );
  }

  return getLayerContent(layer);
}

function getLayerContent(layer) {
  return layer.querySelector("[data-hx-layer-content]");
}

function getCurrentLayer(elt) {
  return elt.closest("dialog[data-hx-layer]");
}

function getTopLayer() {
  return (
    [...document.querySelectorAll("dialog[data-hx-layer][open]")].at(-1) || null
  );
}
