#!/usr/bin/env node
/**
 * Acoustics UI server — static assets + session/reports/drawing binary + optional HTTP CRUD fallback.
 * Bind 127.0.0.1 by default; put Apache/nginx TLS in front for public www.
 *
 * GEVELWERING_BPP_ONLY=1 (recommended): migrated /api/floormap/* and drawing list/sections → 410.
 * Unset/0: lazy-loads lib/deprecated/* for HTTP rollback.
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
  handleSessionApiOptions,
  handleSessionClear,
  handleSessionSave,
  handleSessionStatus,
} from "./lib/session-api.mjs";
import {
  handleProjectFolderCleanup,
  handleReportApiOptions,
  handleReportDownload,
  handleReportGenerate,
  handleReportInboxEmailRequest,
  handleReportInboxDelete,
  handleReportInboxList,
  handleReportInboxRead,
  handleReportList,
  handleReportPublish,
} from "./lib/report-api.mjs";
import {
  handleFacadeDiscoverOpenings,
  handleFacadeDiscoverOptions,
} from "./lib/facade-discover-api.mjs";
import {
  handleMaterialsStudioApiOptions,
  handleMaterialsStudioApprovePublish,
  handleMaterialsStudioComposePreview,
  handleMaterialsStudioComposeSave,
  handleMaterialsStudioMaterialSearch,
  handleMaterialsStudioPublish,
  handleMaterialsStudioQcReport,
  handleMaterialsStudioRefineKalkzandsteen,
  handleMaterialsStudioSummary,
} from "./lib/materials-studio-api.mjs";
import { closePool } from "./lib/pg-config.mjs";
import { corsHeaders, jsonWithSecurity, securityHeaders } from "./lib/http-security.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const port = Number(process.env.GEVELWERING_UI_PORT || 4173);
const host = process.env.GEVELWERING_UI_HOST || "127.0.0.1";

/** When set, migrated floormap/drawing CRUD returns 410 — use bppServer WSS instead. */
const BPP_ONLY =
  process.env.GEVELWERING_BPP_ONLY === "1" ||
  /^true$/i.test(process.env.GEVELWERING_BPP_ONLY || "");

/** Paths migrated to bppServer (phase 1–4). Kept as HTTP fallback unless BPP_ONLY. */
const MIGRATED_TO_BPP = new Set([
  "/api/floormap/section",
  "/api/floormap/sections",
  "/api/floormap/subsections",
  "/api/floormap/subsections/reorder",
  "/api/floormap/vr-components",
  "/api/floormap/scale",
  "/api/floormap/material-categories",
  "/api/floormap/materials",
  "/api/floormap/material-alternatives",
  "/api/floormap/subsection-material",
  "/api/floormap/material-favorites",
  "/api/floormap/material-favorite-presets",
  "/api/drawings/list",
  "/api/drawings/sections",
]);

function respondBppGone(req, res) {
  jsonWithSecurity(req, res, 410, {
    ok: false,
    error:
      "endpoint migrated to bppServer WSS — set GEVELWERING_BPP_ONLY=0 for HTTP rollback, or use API_* via WebSocket",
    bpp_only: true,
  });
}

function handleMigratedApiOptions(req, res) {
  res.writeHead(204, {
    ...corsHeaders(req),
    ...securityHeaders(req),
  });
  res.end();
}

/** @type {Promise<typeof import("./lib/deprecated/floormap-api.mjs")> | null} */
let floormapApiPromise = null;
/** @type {Promise<typeof import("./lib/deprecated/material-favorites-api.mjs")> | null} */
let favoritesApiPromise = null;

function loadFloormapApi() {
  if (!floormapApiPromise) {
    floormapApiPromise = import("./lib/deprecated/floormap-api.mjs");
  }
  return floormapApiPromise;
}

function loadFavoritesApi() {
  if (!favoritesApiPromise) {
    favoritesApiPromise = import("./lib/deprecated/material-favorites-api.mjs");
  }
  return favoritesApiPromise;
}

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

const server = http.createServer(async (req, res) => {
  // PDF hi-res discover can take tens of seconds on large drawings.
  req.setTimeout(180_000);
  res.setTimeout(180_000);
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (BPP_ONLY && MIGRATED_TO_BPP.has(urlPath)) {
    if (req.method === "OPTIONS") {
      handleMigratedApiOptions(req, res);
      return;
    }
    respondBppGone(req, res);
    return;
  }

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
    urlPath === "/api/materials-studio/summary" ||
    urlPath === "/api/materials-studio/qc-report" ||
    urlPath === "/api/materials-studio/publish" ||
    urlPath === "/api/materials-studio/approve-publish" ||
    urlPath === "/api/materials-studio/refine-kalkzandsteen" ||
    urlPath === "/api/materials-studio/material-search" ||
    urlPath === "/api/materials-studio/compose-preview" ||
    urlPath === "/api/materials-studio/compose-save"
  ) {
    if (req.method === "OPTIONS") {
      handleMaterialsStudioApiOptions(req, res);
      return;
    }
    try {
      if (urlPath === "/api/materials-studio/summary" && req.method === "GET") {
        await handleMaterialsStudioSummary(req, res);
        return;
      }
      if (urlPath === "/api/materials-studio/qc-report" && req.method === "GET") {
        await handleMaterialsStudioQcReport(req, res);
        return;
      }
      if (urlPath === "/api/materials-studio/material-search" && req.method === "GET") {
        await handleMaterialsStudioMaterialSearch(req, res, url);
        return;
      }
      if (urlPath === "/api/materials-studio/publish" && req.method === "POST") {
        await handleMaterialsStudioPublish(req, res);
        return;
      }
      if (urlPath === "/api/materials-studio/approve-publish" && req.method === "POST") {
        await handleMaterialsStudioApprovePublish(req, res);
        return;
      }
      if (urlPath === "/api/materials-studio/refine-kalkzandsteen" && req.method === "POST") {
        await handleMaterialsStudioRefineKalkzandsteen(req, res);
        return;
      }
      if (urlPath === "/api/materials-studio/compose-preview" && req.method === "POST") {
        await handleMaterialsStudioComposePreview(req, res);
        return;
      }
      if (urlPath === "/api/materials-studio/compose-save" && req.method === "POST") {
        await handleMaterialsStudioComposeSave(req, res);
        return;
      }
    } catch (err) {
      console.error("materials-studio API error:", err);
      if (!res.headersSent) {
        jsonWithSecurity(req, res, 500, { ok: false, error: "internal server error" });
      }
      return;
    }
    jsonWithSecurity(req, res, 405, { ok: false, error: "method not allowed" });
    return;
  }

  if (urlPath === "/api/floormap/discover-openings") {
    if (req.method === "OPTIONS") {
      handleFacadeDiscoverOptions(req, res);
      return;
    }
    if (req.method === "POST") {
      try {
        await handleFacadeDiscoverOpenings(req, res);
      } catch (err) {
        console.error("discover-openings API error:", err);
        if (!res.headersSent) {
          jsonWithSecurity(req, res, 500, { ok: false, error: "internal server error" });
        }
      }
      return;
    }
    jsonWithSecurity(req, res, 405, { ok: false, error: "method not allowed" });
    return;
  }

  if (
    urlPath === "/api/reports/generate" ||
    urlPath === "/api/reports/list" ||
    urlPath === "/api/reports/download" ||
    urlPath === "/api/reports/publish" ||
    urlPath === "/api/reports/inbox" ||
    urlPath === "/api/reports/inbox/read" ||
    urlPath === "/api/reports/inbox/delete" ||
    urlPath === "/api/reports/inbox/email-request" ||
    urlPath === "/api/reports/cleanup-project-folder"
  ) {
    if (req.method === "OPTIONS") {
      handleReportApiOptions(req, res);
      return;
    }
    try {
      if (urlPath === "/api/reports/generate" && req.method === "POST") {
        await handleReportGenerate(req, res);
        return;
      }
      if (urlPath === "/api/reports/publish" && req.method === "POST") {
        await handleReportPublish(req, res);
        return;
      }
      if (urlPath === "/api/reports/list" && req.method === "GET") {
        await handleReportList(req, res, url);
        return;
      }
      if (urlPath === "/api/reports/download" && req.method === "GET") {
        await handleReportDownload(req, res, url);
        return;
      }
      if (urlPath === "/api/reports/inbox" && req.method === "GET") {
        await handleReportInboxList(req, res, url);
        return;
      }
      if (urlPath === "/api/reports/inbox/read" && req.method === "POST") {
        await handleReportInboxRead(req, res);
        return;
      }
      if (urlPath === "/api/reports/inbox/delete" && req.method === "POST") {
        await handleReportInboxDelete(req, res);
        return;
      }
      if (urlPath === "/api/reports/inbox/email-request" && req.method === "POST") {
        await handleReportInboxEmailRequest(req, res);
        return;
      }
      if (urlPath === "/api/reports/cleanup-project-folder" && req.method === "POST") {
        await handleProjectFolderCleanup(req, res);
        return;
      }
    } catch (err) {
      console.error("report API error:", err);
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
    urlPath === "/api/floormap/subsections/reorder" ||
    urlPath === "/api/floormap/vr-components" ||
    urlPath === "/api/floormap/scale" ||
    urlPath === "/api/floormap/material-categories" ||
    urlPath === "/api/floormap/materials" ||
    urlPath === "/api/floormap/material-alternatives" ||
    urlPath === "/api/floormap/subsection-material" ||
    urlPath === "/api/floormap/material-favorites" ||
    urlPath === "/api/floormap/material-favorite-presets"
  ) {
    if (req.method === "OPTIONS") {
      handleMigratedApiOptions(req, res);
      return;
    }
    try {
      const fm = await loadFloormapApi();
      if (urlPath === "/api/floormap/section" && req.method === "GET") {
        await fm.handleFloormapSectionGet(req, res, url);
        return;
      }
      if (urlPath === "/api/floormap/sections" && req.method === "GET") {
        await fm.handleFloormapSectionsList(req, res, url);
        return;
      }
      if (urlPath === "/api/floormap/vr-components" && req.method === "GET") {
        await fm.handleFloormapVrComponentsList(req, res, url);
        return;
      }
      if (urlPath === "/api/floormap/subsections/reorder" && req.method === "POST") {
        await fm.handleFloormapSubsectionsReorder(req, res);
        return;
      }
      if (urlPath === "/api/floormap/subsections" && req.method === "GET") {
        await fm.handleFloormapSubsectionsList(req, res, url);
        return;
      }
      if (urlPath === "/api/floormap/subsections" && req.method === "POST") {
        await fm.handleFloormapSubsectionSave(req, res);
        return;
      }
      if (urlPath === "/api/floormap/subsections" && req.method === "DELETE") {
        await fm.handleFloormapSubsectionDelete(req, res, url);
        return;
      }
      if (urlPath === "/api/floormap/material-favorites") {
        const fav = await loadFavoritesApi();
        await fav.handleMaterialFavorites(req, res, url);
        return;
      }
      if (urlPath === "/api/floormap/material-favorite-presets") {
        const fav = await loadFavoritesApi();
        await fav.handleMaterialFavoritePresets(req, res, url);
        return;
      }
      if (urlPath === "/api/floormap/scale" && req.method === "POST") {
        await fm.handleFloormapScaleSave(req, res);
        return;
      }
      if (urlPath === "/api/floormap/material-categories" && req.method === "GET") {
        await fm.handleFloormapMaterialCategoriesGet(req, res, url);
        return;
      }
      if (urlPath === "/api/floormap/materials" && req.method === "GET") {
        await fm.handleFloormapMaterialsList(req, res, url);
        return;
      }
      if (urlPath === "/api/floormap/materials" && req.method === "POST") {
        await fm.handleFloormapMaterialCreate(req, res);
        return;
      }
      if (urlPath === "/api/floormap/material-alternatives" && req.method === "GET") {
        await fm.handleFloormapMaterialAlternatives(req, res, url);
        return;
      }
      if (urlPath === "/api/floormap/subsection-material" && req.method === "POST") {
        await fm.handleFloormapSubsectionMaterial(req, res);
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
  server.requestTimeout = 180_000;
  server.headersTimeout = 185_000;
  const url = `http://${host}:${port}/`;
  console.log(`Gevelwering UI: ${url} (loopback — use Apache HTTPS in production)`);
  console.log(`Session API: POST/DELETE ${url}api/session`);
  console.log(`Drawing API: POST ${url}api/drawings/upload  GET ${url}api/drawings/download`);
  console.log(`Discover API: POST ${url}api/floormap/discover-openings (server PDF hi-res)`);
  if (BPP_ONLY) {
    console.log(
      `Floormap/drawing CRUD: 410 Gone (GEVELWERING_BPP_ONLY=1) — use bppServer WSS API_*`,
    );
  } else {
    console.log(
      `Floormap API (HTTP fallback via lib/deprecated/): ${url}api/floormap/* — set GEVELWERING_BPP_ONLY=1 to disable`,
    );
  }
  console.log(`bppServer WebSocket (dev): ws://127.0.0.1:18080/ws — prod: wss://<host>/ws`);
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, async () => {
    server.close();
    await closePool();
    process.exit(0);
  });
}
