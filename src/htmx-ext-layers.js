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
    slideOut(layer, "hx-layer-offset-right", () => {
      layer.remove();
      cleanupSharedBackdrop();
    });
    slideIn(previousStep, "hx-layer-offset-left");
    console.debug("[layers] went back to previous step", previousStep);
    return;
  }

  layer.close();
}

// Slides a dialog that is already open towards `offsetClass`, then calls
// `onDone` once the transition finishes (used to remove/hide it afterwards).
function slideOut(dialog, offsetClass, onDone) {
  dialog.classList.add("hx-layer-no-default-anim", offsetClass);

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    onDone();
  };

  dialog.addEventListener("transitionend", finish, { once: true });
  setTimeout(finish, 300);
}

// Shows (or reveals) a dialog by transitioning it in from `offsetClass`
// towards its resting, centered position.
function slideIn(dialog, offsetClass) {
  dialog.classList.add("hx-layer-no-default-anim", offsetClass);

  if (!dialog.open) {
    dialog.showModal();
  }

  // Force a layout pass so the offset position is applied before we
  // transition away from it.
  dialog.getBoundingClientRect();

  requestAnimationFrame(() => {
    dialog.classList.remove(offsetClass);
  });
}

const SHARED_BACKDROP_ID = "hx-layers-backdrop";

// Creates the shared backdrop div (if not already present) and fades it in.
// Idempotent: if it's already there, leave it alone so stacking/chaining
// more layers doesn't restart its animation.
function ensureSharedBackdrop() {
  let backdrop = document.getElementById(SHARED_BACKDROP_ID);
  if (backdrop) return backdrop;

  backdrop = document.createElement("div");
  backdrop.id = SHARED_BACKDROP_ID;
  backdrop.className = "hx-layers-backdrop";
  document.body.appendChild(backdrop);

  // Force a layout pass so the fade-in transition runs.
  backdrop.getBoundingClientRect();

  requestAnimationFrame(() => {
    backdrop.classList.add("hx-layer-backdrop-visible");
  });

  return backdrop;
}

// Fades out and removes the shared backdrop, but only once no
// layer dialogs remain open.
function cleanupSharedBackdrop() {
  if (document.querySelector("dialog[data-hx-layer][open]")) return;

  const backdrop = document.getElementById(SHARED_BACKDROP_ID);
  if (!backdrop) return;

  backdrop.classList.remove("hx-layer-backdrop-visible");

  let done = false;
  const remove = () => {
    if (done) return;
    done = true;
    backdrop.remove();
  };

  backdrop.addEventListener("transitionend", remove, { once: true });
  setTimeout(remove, 300);
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

    if (parentLayer) {
      parentLayer.classList.add("hx-layer-stacked");
      dialog.classList.add("hx-layer-nested");
    }

    ensureSharedBackdrop();
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

    ensureSharedBackdrop();

    if (previousStep) {
      slideOut(previousStep, "hx-layer-offset-left", () => {
        previousStep._hxStepHidden = true;
        previousStep.close();
        console.debug("[layers] hid previous step", previousStep);
      });

      slideIn(dialog, "hx-layer-offset-right");
    } else {
      dialog.showModal();
    }

    console.debug("[layers] dialog.showModal() called, open =", dialog.open);
    return;
  }

  if (mode === "replace") {
    const previousLayer = currentLayer;
    const returnTarget = previousLayer?._hxReturnTarget ?? event.detail.target;

    const dialog = createLayer({ returnTarget });

    console.debug("[layers] created replacement layer", dialog, {
      previousLayer,
    });

    event.detail.target = getLayerContent(dialog);

    console.debug("[layers] replace swap target:", event.detail.target);

    dialog._hxCloseAfterSettle = false;

    ensureSharedBackdrop();

    if (previousLayer) {
      previousLayer.close();
      console.debug("[layers] closed previous layer", previousLayer);
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
  const parentLayer = dialog._hxParentLayer;

  dialog.remove();

  if (parentLayer) {
    unstackParent(parentLayer);
  }

  if (previousStep) {
    removeLayerChain(previousStep);
  }

  cleanupSharedBackdrop();
}

function unstackParent(parentLayer) {
  const stillHasChild = [
    ...document.querySelectorAll("dialog[data-hx-layer][open]"),
  ].some((d) => d._hxParentLayer === parentLayer);

  if (!stillHasChild) {
    parentLayer.classList.remove("hx-layer-stacked");
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
