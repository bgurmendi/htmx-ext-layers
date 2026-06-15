const MCR = require("monocart-coverage-reports");

function createCoverageReport() {
  return MCR({
    name: "htmx-ext-layers coverage",
    outputDir: "coverage",
    reports: ["v8", "console-summary", "lcovonly"],
    // Only the extension itself matters for coverage, not htmx, the demo
    // mock server, or the browser's own scripts.
    entryFilter: (entry) => entry.url.includes("/src/htmx-ext-layers.js"),
  });
}

function startCoverage(page) {
  return page.coverage.startJSCoverage({ resetOnNavigation: false });
}

async function stopCoverage(page, mcr) {
  const jsCoverage = await page.coverage.stopJSCoverage();
  await mcr.add(jsCoverage);
}

module.exports = { createCoverageReport, startCoverage, stopCoverage };
