#!/usr/bin/env node
/**
 * Acoustics P0/P1 UI server — static assets + drawing + floormap APIs.
 * Bind 127.0.0.1 by default; put Apache/nginx TLS in front for public www.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  handleDrawingApiOptions,
  handleDrawingDownload,
  handleDrawingList,
  handleDrawingSectionsDelete,
  handleDrawingUpload,
} from "./lib/drawing-upload.mjs";
import {
  handleFloormapApiOptions,
  handleFloormapMaterialCategoriesGet,
  handleFloormapMaterialCreate,
  handleFloormapMaterialsList,
  handleFloormapScaleSave,
  handleFloormapSectionGet,
  handleFloormapSectionsList,
  handleFloormapSubsectionDelete,
  handleFloormapSubsectionSave,
  handleFloormapSubsectionsList,
  handleFloormapVrComponentsList,
} from "./lib/floormap-api.mjs";
import {
  handleSessionApiOptions,
  handleSessionClear,
  handleSessionSave,
  handleSessionStatus,
} from "./lib/session-api.mjs";
import { closePool } from "./lib/pg-config.mjs";
import { securityHeaders } from "./lib/http-security.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const port = Number(process.env.GEVELWERING_UI_PORT || 4173);
const host = process.env.GEVELWERING_UI_HOST || "127.0.0.1";

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

const server = http.createServer(async (req, res) => {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (urlPath === "/api/session") {
    if (req.method === "OPTIONS") {
      handleSessionApiOptions(req, res);
      return;
    }
    try {
      if (req.method === "POST") {
        await handleSessionSave(req, res);
        return;
      }
      if (req.method === "DELETE") {
        handleSessionClear(req, res);
        return;
      }
      if (req.method === "GET") {
        handleSessionStatus(req, res);
        return;
      }
    } catch (err) {
      console.error("session API error:", err);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: false, error: "internal server error" }));
      }
      return;
    }
    res.writeHead(405, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: false, error: "method not allowed" }));
    return;
  }

  if (
    urlPath === "/api/drawings/upload" ||
    urlPath === "/api/drawings/list" ||
    urlPath === "/api/drawings/download" ||
    urlPath === "/api/drawings/sections"
  ) {
    if (req.method === "OPTIONS") {
      handleDrawingApiOptions(req, res);
      return;
    }
    try {
      if (urlPath === "/api/drawings/upload" && req.method === "POST") {
        await handleDrawingUpload(req, res, url);
        return;
      }
      if (urlPath === "/api/drawings/list" && req.method === "GET") {
        await handleDrawingList(req, res, url);
        return;
      }
      if (urlPath === "/api/drawings/download" && req.method === "GET") {
        await handleDrawingDownload(req, res, url);
        return;
      }
      if (urlPath === "/api/drawings/sections" && req.method === "DELETE") {
        await handleDrawingSectionsDelete(req, res, url);
        return;
      }
    } catch (err) {
      console.error("drawing API error:", err);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: false, error: "internal server error" }));
      }
      return;
    }
    res.writeHead(405, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: false, error: "method not allowed" }));
    return;
  }

  if (
    urlPath === "/api/floormap/section" ||
    urlPath === "/api/floormap/sections" ||
    urlPath === "/api/floormap/subsections" ||
    urlPath === "/api/floormap/vr-components" ||
    urlPath === "/api/floormap/scale" ||
    urlPath === "/api/floormap/material-categories" ||
    urlPath === "/api/floormap/materials"
  ) {
    if (req.method === "OPTIONS") {
      handleFloormapApiOptions(req, res);
      return;
    }
    try {
      if (urlPath === "/api/floormap/section" && req.method === "GET") {
        await handleFloormapSectionGet(req, res, url);
        return;
      }
      if (urlPath === "/api/floormap/sections" && req.method === "GET") {
        await handleFloormapSectionsList(req, res, url);
        return;
      }
      if (urlPath === "/api/floormap/vr-components" && req.method === "GET") {
        await handleFloormapVrComponentsList(req, res, url);
        return;
      }
      if (urlPath === "/api/floormap/subsections" && req.method === "GET") {
        await handleFloormapSubsectionsList(req, res, url);
        return;
      }
      if (urlPath === "/api/floormap/subsections" && req.method === "POST") {
        await handleFloormapSubsectionSave(req, res);
        return;
      }
      if (urlPath === "/api/floormap/subsections" && req.method === "DELETE") {
        await handleFloormapSubsectionDelete(req, res, url);
        return;
      }
      if (urlPath === "/api/floormap/scale" && req.method === "POST") {
        await handleFloormapScaleSave(req, res);
        return;
      }
      if (urlPath === "/api/floormap/material-categories" && req.method === "GET") {
        await handleFloormapMaterialCategoriesGet(req, res, url);
        return;
      }
      if (urlPath === "/api/floormap/materials" && req.method === "GET") {
        await handleFloormapMaterialsList(req, res, url);
        return;
      }
      if (urlPath === "/api/floormap/materials" && req.method === "POST") {
        await handleFloormapMaterialCreate(req, res);
        return;
      }
    } catch (err) {
      console.error("floormap API error:", err);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: false, error: "internal server error" }));
      }
      return;
    }
    res.writeHead(405, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: false, error: "method not allowed" }));
    return;
  }

  const rel = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.normalize(path.join(publicDir, rel));
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, {
        ...securityHeaders(req),
        "Content-Type": "text/plain; charset=utf-8",
      });
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    const headers = {
      ...securityHeaders(req),
      "Content-Type": types[ext] || "application/octet-stream",
      "Cache-Control":
        ext === ".html" || ext === ".js" || ext === ".css" ? "no-store" : "public, max-age=60",
    };
    res.writeHead(200, headers);
    res.end(data);
  });
});

server.listen(port, host, () => {
  const url = `http://${host}:${port}/`;
  console.log(`Gevelwering UI: ${url} (loopback — use Apache HTTPS in production)`);
  console.log(`Session API: POST/DELETE ${url}api/session`);
  console.log(`Drawing API: POST ${url}api/drawings/upload  GET ${url}api/drawings/list`);
  console.log(`Floormap API: GET ${url}api/floormap/sections  GET ${url}api/floormap/vr-components  POST ${url}api/floormap/subsections`);
  console.log(`bppServer WebSocket (dev): ws://127.0.0.1:18080/ws — prod: wss://<host>/ws`);
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, async () => {
    server.close();
    await closePool();
    process.exit(0);
  });
}
