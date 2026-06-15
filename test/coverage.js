const fs = require("node:fs");
const path = require("node:path");
const MCR = require("monocart-coverage-reports");

function badgeColor(pct) {
  if (pct >= 90) return "brightgreen";
  if (pct >= 75) return "green";
  if (pct >= 60) return "yellow";
  if (pct >= 40) return "orange";
  return "red";
}

function createCoverageReport() {
  return MCR({
    name: "htmx-ext-layers coverage",
    outputDir: "coverage",
    reports: ["v8", "console-summary", "lcovonly"],
    // Only the extension itself matters for coverage, not htmx, the demo
    // mock server, or the browser's own scripts.
    entryFilter: (entry) => entry.url.includes("/src/htmx-ext-layers.js"),
    // Writes a shields.io endpoint badge so the README coverage badge
    // stays up to date without an external coverage service.
    onEnd: (coverageResults) => {
      const pct = coverageResults.summary.statements.pct;
      const badge = {
        schemaVersion: 1,
        label: "coverage",
        message: `${pct.toFixed(1)}%`,
        color: badgeColor(pct),
      };
      fs.mkdirSync("badges", { recursive: true });
      fs.writeFileSync(path.join("badges", "coverage.json"), JSON.stringify(badge));
    },
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
