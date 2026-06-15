const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
};

// Minimal static file server for the repo root, used so the demos can be
// loaded over http:// (the <dialog> and fetch-based demo mocks don't behave
// the same when opened via file://).
function startServer() {
  const server = http.createServer((req, res) => {
    const reqPath = decodeURIComponent(req.url.split("?")[0]);
    const filePath = path.join(ROOT, reqPath === "/" ? "/index.html" : reqPath);

    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403);
      res.end();
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const ext = path.extname(filePath);
      res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
      res.end(data);
    });
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

module.exports = { startServer };
