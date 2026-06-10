console.debug("[layers] extension script loaded, registering with htmx");

htmx.defineExtension("layers", {
  init() {
    document.addEventListener("click", onBackClick);
  },

  onEvent(name, event) {
    console.debug("[layers] onEvent:", name, event);

    if (name === "htmx:beforeSwap") {
      beforeSwap(event);
    }

    if (name === "htmx:afterSettle") {
      afterSettle(event);
    }
  },
});

function onBackClick(event) {
  const elt = event.target.closest("[hx-layer-back]");
  if (!elt) return;

  const layer = getCurrentLayer(elt);
  if (!layer) return;

  if (elt.tagName === "A") {
    event.preventDefault();
  }

  console.debug("[layers] hx-layer-back clicked", { elt, layer });

  const previousStep = layer._hxPreviousStep;
  if (previousStep) {
    layer._hxPreviousStep = null;
    layer.remove();
    previousStep.showModal();
    console.debug("[layers] went back to previous step", previousStep);
    return;
  }

  layer.close();
}

function beforeSwap(event) {
  const { elt, xhr } = event.detail;

  if (xhr._hxLayersHandled) {
    console.debug("[layers] xhr already handled, ignoring re-dispatched beforeSwap", {
      elt,
    });
    return;
  }
  xhr._hxLayersHandled = true;

  const currentLayer = getCurrentLayer(elt);

  let mode = xhr.getResponseHeader("HX-Layer") || elt.getAttribute("hx-layer");

  console.debug("[layers] beforeSwap", {
    elt,
    headerMode: xhr.getResponseHeader("HX-Layer"),
    attrMode: elt.getAttribute("hx-layer"),
    currentLayer,
  });

  if (!mode && currentLayer) {
    mode = "current";
  }

  if (!mode || mode === "none") {
    console.debug("[layers] mode is empty or 'none', nothing to do");
    return;
  }

  console.debug("[layers] resolved mode:", mode);

  if (mode === "new") {
    const parentLayer = currentLayer;
    const returnTarget = event.detail.target;

    const dialog = createLayer({ returnTarget, parentLayer });

    console.debug("[layers] created dialog layer", dialog);

    event.detail.target = getLayerContent(dialog);

    console.debug("[layers] new swap target:", event.detail.target);

    dialog._hxCloseAfterSettle = false;

    dialog.showModal();

    console.debug("[layers] dialog.showModal() called, open =", dialog.open);
    return;
  }

  if (mode === "step") {
    const previousStep = currentLayer;
    const returnTarget = previousStep?._hxReturnTarget ?? event.detail.target;

    const dialog = createLayer({ returnTarget, previousStep });

    console.debug("[layers] created step layer", dialog, { previousStep });

    event.detail.target = getLayerContent(dialog);

    console.debug("[layers] step swap target:", event.detail.target);

    dialog._hxCloseAfterSettle = false;

    if (previousStep) {
      previousStep._hxStepHidden = true;
      previousStep.close();
      console.debug("[layers] hid previous step", previousStep);
    }

    dialog.showModal();

    console.debug("[layers] dialog.showModal() called, open =", dialog.open);
    return;
  }

  if (mode === "current") {
    const layer = currentLayer || getTopLayer();
    if (!layer) {
      console.debug("[layers] mode 'current' but no layer found");
      return;
    }

    event.detail.target = resolveLayerTarget(event, layer);

    console.debug("[layers] current swap target:", event.detail.target);
    return;
  }

  if (mode === "close") {
    const layer = currentLayer || getTopLayer();
    if (!layer) {
      console.debug("[layers] mode 'close' but no layer found");
      return;
    }

    const returnTarget = layer._hxReturnTarget;
    if (!returnTarget) {
      console.debug("[layers] no returnTarget, closing layer without swap");
      event.detail.shouldSwap = false;
      layer.close();
      return;
    }

    event.detail.target = returnTarget;
    layer._hxCloseAfterSettle = true;

    console.debug("[layers] close swap target:", returnTarget);
    return;
  }
}

function afterSettle(event) {
  const { xhr } = event.detail;
  const elt = event.detail.requestConfig?.elt ?? event.detail.elt;

  const mode =
    xhr?.getResponseHeader("HX-Layer") || elt?.getAttribute("hx-layer");

  console.debug("[layers] afterSettle", { elt, mode });

  if (mode !== "close") return;

  const layer = getCurrentLayer(elt) || getTopLayer();
  if (!layer?._hxCloseAfterSettle) return;

  console.debug("[layers] closing layer after settle", layer);

  layer.close();
}

function createLayer({ returnTarget, parentLayer, previousStep }) {
  const dialog = document.createElement("dialog");

  dialog.dataset.hxLayer = "";
  dialog.innerHTML = `<div data-hx-layer-content></div>`;

  dialog._hxReturnTarget = returnTarget;
  dialog._hxParentLayer = parentLayer || null;
  dialog._hxPreviousStep = previousStep || null;

  dialog.addEventListener("close", () => {
    if (dialog._hxStepHidden) {
      dialog._hxStepHidden = false;
      console.debug("[layers] dialog hidden for step transition", dialog);
      return;
    }

    console.debug("[layers] dialog closed, removing layer chain", dialog);
    removeLayerChain(dialog);
  });

  document.body.appendChild(dialog);

  console.debug("[layers] dialog appended to body", dialog);

  return dialog;
}

function removeLayerChain(dialog) {
  const previousStep = dialog._hxPreviousStep;

  dialog.remove();

  if (previousStep) {
    removeLayerChain(previousStep);
  }
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
