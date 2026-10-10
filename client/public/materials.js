var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// src/auth-store.ts
function loadAuth(storageKey) {
  try {
    const raw = sessionStorage.getItem(storageKey) ?? localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.token) return null;
    if (!sessionStorage.getItem(storageKey) && localStorage.getItem(storageKey)) {
      sessionStorage.setItem(storageKey, raw);
      localStorage.removeItem(storageKey);
    }
    return parsed;
  } catch {
    return null;
  }
}
function storeAuth(storageKey, info) {
  localStorage.removeItem(storageKey);
  if (!info) sessionStorage.removeItem(storageKey);
  else sessionStorage.setItem(storageKey, JSON.stringify(info));
}
async function syncSessionCookie(token) {
  try {
    if (token) {
      await fetch("/api/session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });
    } else {
      await fetch("/api/session", {
        method: "DELETE",
        credentials: "include"
      });
    }
  } catch {
  }
}
function apiAuthHeaders(token, json = false) {
  const h = {
    Authorization: `Bearer ${token}`
  };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

// src/ws-url.ts
function resolveBppWsUrl() {
  if (location.protocol === "https:") {
    return `wss://${location.host}/ws`;
  }
  const q = new URLSearchParams(location.search).get("ws");
  const override = window.BPP_WS_URL;
  return q || override || `ws://${location.hostname}:18080/ws`;
}

// src/password-toggle.ts
var EYE_CLOSED = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75C21.27 9.11 17 5 12 5c-1.4 0-2.73.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78 3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/></svg>`;
var EYE_OPEN = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 5c-5 0-9.27 3.11-11 7.5C2.73 16.89 7 20 12 20s9.27-3.11 11-7.5C21.27 8.11 17 5 12 5zm0 12.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`;
function enhancePasswordInput(input) {
  if (input.dataset.pwToggle === "1") return;
  if (input.closest(".pw-field")) return;
  input.dataset.pwToggle = "1";
  const wrap = document.createElement("div");
  wrap.className = "pw-field";
  input.parentNode?.insertBefore(wrap, input);
  wrap.appendChild(input);
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "pw-toggle";
  btn.setAttribute("aria-label", "Wachtwoord tonen");
  btn.setAttribute("aria-pressed", "false");
  btn.innerHTML = EYE_CLOSED;
  wrap.appendChild(btn);
  btn.addEventListener("click", () => {
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    btn.innerHTML = show ? EYE_OPEN : EYE_CLOSED;
    btn.setAttribute("aria-pressed", show ? "true" : "false");
    btn.setAttribute("aria-label", show ? "Wachtwoord verbergen" : "Wachtwoord tonen");
  });
}
function initPasswordToggles(root = document) {
  root.querySelectorAll('input[type="password"]').forEach(enhancePasswordInput);
}

// lib/material-taxonomy.mjs
var MATERIAL_RUBRIEKEN = [
  { nr: 1, name: "Steenachtigen/beton/blokken" },
  { nr: 2, name: "Glas" },
  { nr: 3, name: "Dak-, vloer-, plafondconstructies" },
  { nr: 4, name: "Lichte paneelconstr./borstweringen/deuren" },
  { nr: 5, name: "Enkelvoudige plaatmaterialen/panelen" },
  { nr: 6, name: "Ventilatievoorzieningen" },
  { nr: 7, name: "Ventilatievoorzieningen oud (voor 1-1-2012)" },
  { nr: 8, name: "Lichte scheidingsconstructies" },
  { nr: 9, name: "Kier- en naaddichtingsprofielen" },
  { nr: 10, name: "Losse materialen" },
  { nr: 11, name: "Interieur" }
];
var MATERIAL_SUBRUBRIEKEN = {
  1: [
    { nr: 1, name: "Baksteen licht/zwaar" },
    { nr: 2, name: "Kalkzandsteen" },
    { nr: 3, name: "Grindbeton/natuursteen" },
    { nr: 4, name: "Lichtbeton/cellenbeton" },
    { nr: 5, name: "(hout-)vezelbeton" },
    { nr: 6, name: "Lichte blokken/gipsblokken" },
    { nr: 7, name: "Voorzetwanden" },
    { nr: 8, name: "Enkelsteensmuur, rekenmethode" },
    { nr: 9, name: "Spouwmuur, rekenmethode" },
    { nr: 10, name: "Diversen" }
  ],
  2: [
    { nr: 1, name: "Enkel glas" },
    { nr: 2, name: "Dubbel glas" },
    { nr: 3, name: "Enkel glas gelamineerd" },
    { nr: 4, name: "Dubbel glas 1-zijdig gelamineerd" },
    { nr: 5, name: "Dubbel glas 2-zijdig gelamineerd" },
    { nr: 6, name: "Schuiframen" },
    { nr: 7, name: "Enkel glas, rekenmethode T" },
    { nr: 8, name: "Dubbel glas, rekenmethode T" },
    { nr: 9, name: "Diversen" },
    { nr: 10, name: "Drievoudig glas" }
  ],
  3: [
    { nr: 1, name: "Plat dak houtachtig" },
    { nr: 2, name: "Plat dak (gas)beton" },
    { nr: 3, name: "Plat dak metaalplaat" },
    { nr: 4, name: "Hellend dak houtachtig" },
    { nr: 5, name: "Hellend dak gas(beton)" },
    { nr: 6, name: "Dakramen" },
    { nr: 7, name: "Dakkapellen" },
    { nr: 8, name: "Vloeren" },
    { nr: 9, name: "Diversen" }
  ],
  4: [
    { nr: 1, name: "Sandwich panelen" },
    { nr: 2, name: "Samengestelde panelen" },
    { nr: 3, name: "Deuren" },
    { nr: 4, name: "Samengestelde vloeren" },
    { nr: 5, name: "Kozijnen" },
    { nr: 6, name: "Diversen" }
  ],
  5: [
    { nr: 1, name: "Spaanplaat/board" },
    { nr: 2, name: "Triplex/multiplex/meubelplaat" },
    { nr: 3, name: "Hout/vloerdelen" },
    { nr: 4, name: "Gipsplaat/asbestcement" },
    { nr: 5, name: "Mineraalvezels/mineraalwol" },
    { nr: 6, name: "Kunststof (massief)" },
    { nr: 7, name: "Metaalplaat" },
    { nr: 8, name: "Diversen" }
  ],
  6: [
    { nr: 1, name: "Openingen/roosters" },
    { nr: 2, name: "Suskasten" },
    { nr: 3, name: "Muurdempers" },
    { nr: 4, name: "Dakdempers" },
    { nr: 5, name: "Mechanische ventilatie unit" },
    { nr: 6, name: "Diversen" },
    { nr: 7, name: "Ventilatie rekenmethode RM" }
  ],
  7: [
    { nr: 1, name: "Openingen/roosters" },
    { nr: 2, name: "Suskasten" },
    { nr: 3, name: "Muurdempers" },
    { nr: 4, name: "Diversen" }
  ],
  8: [
    { nr: 1, name: "Gipskarton wanden. U-profielen" },
    { nr: 2, name: "Gipskarton wanden. Stijlen" },
    { nr: 3, name: "Spaanplaatachtige wanden" },
    { nr: 4, name: "Metalen wanden" },
    { nr: 5, name: "Houtwolcement wanden" },
    { nr: 6, name: "Schuifbare wanden" },
    { nr: 7, name: "Diversen" }
  ],
  9: [
    { nr: 1, name: "Kierdichtingsprofielen" },
    { nr: 2, name: "Naaddichtingsprofielen" },
    { nr: 3, name: "Beglazingsranden" }
  ],
  /** Building blocks for composite / template layers (Materials Studio). */
  10: [
    { nr: 1, name: "Bekleding / buitenblad" },
    { nr: 2, name: "Ventilerende spouw" },
    { nr: 3, name: "Folie / membraan" },
    { nr: 4, name: "Beplating" },
    { nr: 5, name: "Skelet / stijlen" },
    { nr: 6, name: "Isolatie" },
    { nr: 7, name: "Damprem" },
    { nr: 8, name: "Binnenafwerking" },
    { nr: 9, name: "Constructie" },
    { nr: 10, name: "Overig" }
  ],
  /** Isolatie / overdracht tussen ruimten (exposure INTERIOR). */
  11: [
    { nr: 1, name: "Scheidingswanden" },
    { nr: 2, name: "Binnenwanden" },
    { nr: 3, name: "Vloeren / plafonds" },
    { nr: 4, name: "Vloerafwerking (\u0394L)" },
    { nr: 5, name: "Diversen" }
  ]
};
function rubriekByName(name) {
  const n = String(name || "").trim().toLowerCase();
  if (!n) return null;
  return MATERIAL_RUBRIEKEN.find((r) => r.name.toLowerCase() === n) || MATERIAL_RUBRIEKEN.find((r) => n.startsWith(r.name.toLowerCase().slice(0, 24))) || null;
}
function subrubriekenFor(rubriekNr) {
  return MATERIAL_SUBRUBRIEKEN[Number(rubriekNr)] || [];
}
function formatRubriekLabel(r) {
  return `${r.nr}. ${r.name}`;
}
function formatSubrubriekLabel(s) {
  return `${s.nr} - ${s.name}`;
}

// lib/material-kind-labels.mjs
var MATERIAL_KIND_HOMOGENEOUS = "homogeneous";
var MATERIAL_KIND_COMPOSITE = "composite_stack";
function normalizeMaterialKind(kind) {
  return kind === MATERIAL_KIND_COMPOSITE ? MATERIAL_KIND_COMPOSITE : MATERIAL_KIND_HOMOGENEOUS;
}
function materialKindLabel(kind) {
  return normalizeMaterialKind(kind) === MATERIAL_KIND_COMPOSITE ? "Samengesteld" : "Enkellaags";
}
function materialKindTitle(kind) {
  return normalizeMaterialKind(kind) === MATERIAL_KIND_COMPOSITE ? "Samengesteld \u2014 meerdere materiaallagen (buiten naar binnen)" : "Enkellaags \u2014 \xE9\xE9n materiaallaag (massief, plaat, glas, \u2026)";
}
function materialKindBadgeClass(kind) {
  return normalizeMaterialKind(kind) === MATERIAL_KIND_COMPOSITE ? "mat-kind-badge mat-kind-composite" : "mat-kind-badge mat-kind-single";
}
function materialKindBadgeHtml(kind, escFn) {
  const k = normalizeMaterialKind(kind);
  return `<span class="${materialKindBadgeClass(k)}" title="${escFn(materialKindTitle(k))}">${escFn(materialKindLabel(k))}</span>`;
}

// src/bpp-api.ts
function parseBppJson(ret) {
  if (ret.startsWith("ERROR")) throw new Error(ret);
  try {
    return JSON.parse(ret);
  } catch {
    throw new Error(`Ongeldig JSON-antwoord van bppServer: ${ret.slice(0, 240)}`);
  }
}
function bppPhase1Enabled() {
  try {
    return localStorage.getItem("GEVELWERING_BPP_HTTP") !== "1";
  } catch {
    return true;
  }
}
async function bppListMaterialFavorites(invoke, token, buildingId) {
  const ret = await invoke("API_ListMaterialFavorites", [token, buildingId]);
  const data = parseBppJson(ret);
  return { materials: data.materials || [] };
}
async function bppAddMaterialFavorite(invoke, token, buildingId, materialId) {
  const ret = await invoke("API_AddMaterialFavorite", [token, buildingId, materialId]);
  parseBppJson(ret);
}
async function bppRemoveMaterialFavorite(invoke, token, buildingId, materialId) {
  const ret = await invoke("API_RemoveMaterialFavorite", [token, buildingId, materialId]);
  parseBppJson(ret);
}
async function bppListMaterialFavoritePresets(invoke, token) {
  const ret = await invoke("API_ListMaterialFavoritePresets", [token]);
  const data = parseBppJson(ret);
  return { presets: data.presets || [] };
}
async function bppMaterialFavoritePresetAction(invoke, token, body) {
  const ret = await invoke("API_MaterialFavoritePresetAction", [token, JSON.stringify(body)]);
  return parseBppJson(ret);
}

// src/shared/bpp-session.ts
var MfaChallengeError = class extends Error {
  constructor(challenge) {
    super(
      challenge.needs_totp_setup ? "Authenticator koppelen vereist (Microsoft Authenticator)" : "Authenticator-code vereist"
    );
    __publicField(this, "challenge");
    this.name = "MfaChallengeError";
    this.challenge = challenge;
  }
};
var BppSession = class {
  constructor(opts) {
    __publicField(this, "ws", null);
    __publicField(this, "sessionId", null);
    __publicField(this, "auth", null);
    __publicField(this, "reqCounter", 0);
    __publicField(this, "pending", /* @__PURE__ */ new Map());
    __publicField(this, "wsUrl");
    __publicField(this, "authKey");
    __publicField(this, "clientName");
    __publicField(this, "cb");
    /** Bumps on each connect() so stale open/close handlers are ignored. */
    __publicField(this, "connectGen", 0);
    __publicField(this, "reconnectTimer", null);
    /** Resolvers waiting for WebSocket OPEN (login while still connecting). */
    __publicField(this, "openWaiters", []);
    this.wsUrl = opts.wsUrl;
    this.authKey = opts.authKey;
    this.clientName = opts.clientName;
    this.cb = opts.callbacks;
  }
  nextRequestId(prefix) {
    this.reqCounter += 1;
    return `${prefix}_${this.reqCounter}_${Date.now()}`;
  }
  rejectAllPending(err) {
    for (const [id, waiter] of this.pending) {
      this.pending.delete(id);
      waiter.reject(err);
    }
  }
  rejectOpenWaiters(err) {
    const waiters = this.openWaiters.splice(0);
    for (const w of waiters) {
      clearTimeout(w.timer);
      w.reject(err);
    }
  }
  resolveOpenWaiters() {
    const waiters = this.openWaiters.splice(0);
    for (const w of waiters) {
      clearTimeout(w.timer);
      w.resolve();
    }
  }
  /** Wait until WS is OPEN (or fail). Used when user acts while still connecting. */
  async whenOpen(timeoutMs = 12e3) {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING) {
      throw new Error(`WebSocket niet verbonden (${this.wsUrl}). Herlaad of start ./start.sh.`);
    }
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.openWaiters.findIndex((w) => w.timer === timer);
        if (idx >= 0) this.openWaiters.splice(idx, 1);
        reject(new Error(`WebSocket timeout \u2014 geen verbinding met ${this.wsUrl}`));
      }, timeoutMs);
      this.openWaiters.push({ resolve, reject, timer });
    });
  }
  async send(type, payload, wantType) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      if (this.ws?.readyState === WebSocket.CONNECTING) {
        await this.whenOpen();
      } else {
        throw new Error(`WebSocket niet open (${this.wsUrl}). Herlaad of start ./start.sh.`);
      }
    }
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error(`WebSocket niet open (${this.wsUrl}). Herlaad of start ./start.sh.`);
    }
    const request_id = this.nextRequestId(type.replace(".", "_"));
    const env = { v: 1, type, request_id, payload };
    if (this.sessionId && type !== "session.open") env.session_id = this.sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(request_id, { resolve, reject, want: wantType });
      this.ws.send(JSON.stringify(env));
    });
  }
  onMessage(raw) {
    let env;
    try {
      env = JSON.parse(raw);
    } catch {
      return;
    }
    if (env.type === "session.opened") {
      const sid = typeof env.session_id === "string" && env.session_id || (typeof env.payload?.session_id === "string" ? env.payload.session_id : null);
      if (sid) this.sessionId = sid;
    }
    if (env.type === "error") {
      const waiter2 = this.pending.get(env.request_id);
      if (waiter2) {
        this.pending.delete(env.request_id);
        waiter2.reject(new Error(JSON.stringify(env.payload ?? env)));
      }
      return;
    }
    const waiter = this.pending.get(env.request_id);
    if (!waiter) return;
    if (env.type === waiter.want || env.type.endsWith(".completed") || env.type === "exec.completed") {
      if (env.type === "invoke.accepted" || env.type === "exec.accepted") return;
      this.pending.delete(env.request_id);
      waiter.resolve(env);
    }
  }
  async invokeString(target, args) {
    const inv = await this.send("invoke.request", { target_kind: "procedure", target, args }, "invoke.completed");
    const ret = inv.payload?.return;
    if (typeof ret !== "string") throw new Error(`Onverwacht antwoord van ${target}`);
    return ret;
  }
  async loadSharedApi() {
    await this.send(
      "exec.request",
      { code: 'INCLUDE "fixtures/app-gevelwering/shared_building_api.basicpp"\n' },
      "exec.completed"
    );
    const bootRet = await this.invokeString("API_Bootstrap", []);
    if (!bootRet.startsWith("OK")) throw new Error(`API_Bootstrap mislukt: ${bootRet}`);
  }
  applyAuth(info) {
    this.auth = info;
    this.storeAuth(info);
    this.cb.onLogin(info);
    return info;
  }
  async bootstrapAndLogin(username, password) {
    await this.whenOpen();
    await this.loadSharedApi();
    const ret = await this.invokeString("API_Login", [username, password]);
    if (ret.startsWith("ERROR")) throw new Error(ret);
    const parsed = JSON.parse(ret);
    if (parsed.needs_totp || parsed.needs_totp_setup) {
      if (!parsed.challenge) throw new Error("MFA challenge ontbreekt");
      throw new MfaChallengeError({
        needs_totp: parsed.needs_totp,
        needs_totp_setup: parsed.needs_totp_setup,
        challenge: parsed.challenge,
        username: parsed.username || username,
        totp_secret: parsed.totp_secret,
        otpauth_uri: parsed.otpauth_uri,
        authenticator_app: parsed.authenticator_app,
        authenticator_hint: parsed.authenticator_hint
      });
    }
    if (!parsed.ok || !parsed.token) throw new Error("Inloggen mislukt");
    return this.applyAuth({
      token: parsed.token,
      username: parsed.username || username,
      display_name: parsed.display_name || username
    });
  }
  async verifyTotp(challenge, code) {
    const ret = await this.invokeString("API_VerifyTotp", [challenge, code]);
    if (ret.startsWith("ERROR")) throw new Error(ret.replace(/^ERROR:\s*/, ""));
    const parsed = JSON.parse(ret);
    if (!parsed.ok || !parsed.token) throw new Error("Authenticator-bevestiging mislukt");
    return this.applyAuth({
      token: parsed.token,
      username: parsed.username || "admin",
      display_name: parsed.display_name || parsed.username || "admin"
    });
  }
  storeAuth(info) {
    storeAuth(this.authKey, info);
    void syncSessionCookie(info?.token ?? null);
  }
  loadStoredAuth() {
    return loadAuth(this.authKey);
  }
  logout() {
    this.auth = null;
    this.storeAuth(null);
    this.cb.onLogout();
  }
  /**
   * Open WS, session.open, loadSharedApi, validate stored token.
   * Page-specific `onReady` callback fires after successful restore or login prompt.
   */
  connect(opts) {
    const reconnectMs = opts?.reconnectMs ?? 1500;
    if (this.reconnectTimer != null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const gen = ++this.connectGen;
    this.sessionId = null;
    this.rejectAllPending(new Error("WebSocket herverbindt"));
    this.rejectOpenWaiters(new Error("WebSocket herverbindt"));
    const prev = this.ws;
    this.ws = null;
    if (prev && (prev.readyState === WebSocket.OPEN || prev.readyState === WebSocket.CONNECTING)) {
      try {
        prev.close();
      } catch {
      }
    }
    this.cb.onStatus(`Verbinden met ${this.wsUrl}\u2026`, "busy");
    this.cb.onConnLed(false);
    const ws = new WebSocket(this.wsUrl);
    this.ws = ws;
    ws.addEventListener("open", () => {
      if (gen !== this.connectGen || this.ws !== ws) return;
      this.cb.onConnLed(true);
      this.resolveOpenWaiters();
      void (async () => {
        try {
          await this.send("session.open", { client: this.clientName }, "session.opened");
          if (gen !== this.connectGen) return;
          await this.loadSharedApi();
          if (gen !== this.connectGen) return;
          const stored = this.loadStoredAuth();
          if (stored?.token) {
            const ret = await this.invokeString("API_ValidateSession", [stored.token]);
            if (gen !== this.connectGen) return;
            if (ret.startsWith("ERROR")) {
              this.auth = null;
              this.storeAuth(null);
              this.cb.onLogout();
              this.cb.onStatus("Sessie verlopen \u2014 log in", "err");
            } else {
              this.auth = stored;
              this.cb.onLogin(stored);
              this.cb.onStatus("Gereed", "ok");
            }
          } else {
            this.cb.onLogout();
            this.cb.onStatus("Verbonden \u2014 log in", "ok");
          }
        } catch (err) {
          if (gen !== this.connectGen) return;
          this.cb.onStatus(err instanceof Error ? err.message : String(err), "err");
          if (!this.auth) this.cb.onLogout();
          return;
        }
        if (gen !== this.connectGen) return;
        try {
          await this.cb.onReady?.();
        } catch (err) {
          if (gen !== this.connectGen) return;
          this.cb.onStatus(err instanceof Error ? err.message : String(err), "err");
        }
      })();
    });
    ws.addEventListener("message", (ev) => {
      if (this.ws !== ws) return;
      this.onMessage(String(ev.data));
    });
    ws.addEventListener("close", () => {
      if (gen !== this.connectGen) return;
      if (this.ws === ws) this.ws = null;
      this.sessionId = null;
      this.rejectAllPending(new Error("WebSocket verbroken"));
      this.rejectOpenWaiters(new Error("WebSocket verbroken"));
      this.cb.onConnLed(false);
      this.cb.onStatus(
        reconnectMs > 0 ? `Verbinding verbroken \u2014 opnieuw verbinden\u2026 (${this.wsUrl})` : `Verbinding verbroken (${this.wsUrl})`,
        "err"
      );
      if (reconnectMs > 0) {
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null;
          if (gen === this.connectGen) this.connect(opts);
        }, reconnectMs);
      }
    });
    ws.addEventListener("error", () => {
      if (gen !== this.connectGen || this.ws !== ws) return;
      this.cb.onStatus(`WebSocket-fout (${this.wsUrl})`, "err");
    });
  }
};

// src/shared/dom-helpers.ts
function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// lib/acoustic-physics.mjs
function woodCoverageFraction(widthMm, spacingMm) {
  const b = Number(widthMm);
  const a = Number(spacingMm);
  if (!(b > 0) || !(a > 0) || b > a) return null;
  return b / a;
}
function woodEquivalentSurfaceMass(phi, densityKgM3, thicknessMm) {
  const p = Number(phi);
  const d = Number(densityKgM3);
  const h = Number(thicknessMm);
  if (!(p > 0) || !(d > 0) || !(h > 0)) return null;
  return p * d * (h / 1e3);
}
function woodGridMetrics(layer) {
  const width = Number(layer.stud_width_mm);
  const spacing = Number(layer.stud_spacing_mm);
  const depth = Number(layer.stud_depth_mm) > 0 ? Number(layer.stud_depth_mm) : Number(layer.thickness_mm);
  const density = Number(layer.density_kg_m3);
  const phi = woodCoverageFraction(width, spacing);
  if (phi == null) return null;
  const mEq = woodEquivalentSurfaceMass(phi, density, depth);
  return {
    phi,
    phi_pct: round1(phi * 100),
    m_eq_kg_m2: mEq != null ? round1(mEq) : null,
    stud_width_mm: width,
    stud_spacing_mm: spacing,
    stud_depth_mm: depth,
    density_kg_m3: density
  };
}
function round1(x) {
  return Math.round(x * 10) / 10;
}

// src/materials-studio-panel.ts
var FAMILY_LABEL = {
  buitengevel: "Buitengevel",
  dak: "Dakopbouw",
  overig: "Overig"
};
var KIND_LABEL = {
  homogeneous: "Enkellaags",
  composite_stack: "Samengesteld"
};
var LAYER_KINDS = [
  { value: "cladding", label: "Bekleding / buitenblad", role: "structural" },
  { value: "cavity_ventilated", label: "Ventilerende spouw", role: "cavity" },
  { value: "membrane", label: "Folie / membraan", role: "negligible" },
  { value: "sheathing", label: "Beplating", role: "structural" },
  { value: "framing", label: "Skelet / stijlen", role: "structural" },
  { value: "insulation", label: "Isolatie", role: "absorptive" },
  { value: "vapor_barrier", label: "Damprem", role: "negligible" },
  { value: "lining", label: "Binnenafwerking", role: "structural" },
  { value: "structure", label: "Constructie", role: "structural" },
  { value: "other", label: "Overig", role: "structural" }
];
function initMaterialsStudioPanel(opts) {
  const summaryHintEl = document.getElementById("ms-summary-hint");
  const statsEl = document.getElementById("ms-stats");
  const kindStatsEl = document.getElementById("ms-kind-stats");
  const recentListEl = document.getElementById("ms-recent-list");
  const recentEmptyEl = document.getElementById("ms-recent-empty");
  const templatesEl = document.getElementById("ms-templates");
  const refreshBtn = document.getElementById("ms-refresh-btn");
  const qcMetaEl = document.getElementById("ms-qc-meta");
  const qcIssuesEl = document.getElementById("ms-qc-issues");
  const publishBtn = document.getElementById("ms-publish-btn");
  const refineKzBtn = document.getElementById("ms-refine-kz-btn");
  const actionOutEl = document.getElementById("ms-action-out");
  const composeModeEl = document.getElementById("ms-compose-mode");
  const composeTplWrap = document.getElementById("ms-compose-tpl-wrap");
  const composeTplEl = document.getElementById("ms-compose-template");
  const composeFamilyEl = document.getElementById("ms-compose-family");
  const composeNameEl = document.getElementById("ms-compose-name");
  const composeLayersEl = document.getElementById("ms-compose-layers");
  const composeAddBtn = document.getElementById("ms-compose-add-layer");
  const composePreviewBtn = document.getElementById("ms-compose-preview-btn");
  const composeResultEl = document.getElementById("ms-compose-result");
  const composeLayerTbody = document.getElementById("ms-compose-layer-tbody");
  const composeStackNote = document.getElementById("ms-compose-stack-note");
  const composeStackStats = document.getElementById("ms-compose-stack-stats");
  const composeSaveTplEl = document.getElementById("ms-compose-save-tpl");
  const composeSaveConceptEl = document.getElementById(
    "ms-compose-save-concept"
  );
  const composePublishCatalogEl = document.getElementById(
    "ms-compose-publish-catalog"
  );
  const composeSaveBtn = document.getElementById("ms-compose-save-btn");
  const composeSaveOut = document.getElementById("ms-compose-save-out");
  const proposedListEl = document.getElementById("ms-proposed-list");
  const proposedEmptyEl = document.getElementById("ms-proposed-empty");
  let templatesCache = [];
  let composeLayers = [];
  let lastPreview = null;
  async function apiGet(path) {
    const token = opts.getToken();
    if (!token) throw new Error("niet ingelogd");
    const res = await fetch(path, {
      credentials: "include",
      headers: apiAuthHeaders(token)
    });
    const data = await res.json();
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    return data;
  }
  async function apiPost(path, body) {
    const token = opts.getToken();
    if (!token) throw new Error("niet ingelogd");
    const res = await fetch(path, {
      method: "POST",
      credentials: "include",
      headers: apiAuthHeaders(token, true),
      body: JSON.stringify(body ?? {})
    });
    const data = await res.json();
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    return data;
  }
  function fmtWhen(iso) {
    if (!iso) return "\u2014";
    try {
      return new Date(iso).toLocaleString("nl-NL");
    } catch {
      return String(iso);
    }
  }
  function kindBadge(kind) {
    const label = KIND_LABEL[kind] || kind;
    const cls = kind === "composite_stack" ? "mat-kind-badge mat-kind-composite" : "mat-kind-badge mat-kind-single";
    return `<span class="${cls}" title="${esc(materialKindTitle(kind))}">${esc(label)}</span>`;
  }
  function fmtNum(v) {
    if (v == null || !Number.isFinite(Number(v))) return "\u2014";
    return String(v);
  }
  function specBand(spec, hz) {
    if (!spec) return null;
    const v = spec[String(hz)] ?? spec[hz];
    return v != null && Number.isFinite(Number(v)) ? Number(v) : null;
  }
  function renderStats(s) {
    const sv = s.spectrum_versions;
    summaryHintEl.textContent = "acoustic_catalog bevat concepten, versies en patronen; GA/engineer leest alleen gepubliceerde material-rijen.";
    const rows = [
      ["Runtime material (GA/engineer)", s.material_rows],
      ["Gekoppeld aan catalogus-trace", s.material_linked],
      ["Material concepts", s.concepts],
      ["Laatste goedgekeurde spectra", sv.latest_approved ?? 0],
      ["Voorgestelde spectra", sv.proposed ?? 0],
      ["Afgewezen spectra", sv.rejected ?? 0],
      ["Spectrum patronen", s.patterns],
      ["Opbouwtemplates", s.assemblies]
    ];
    statsEl.innerHTML = rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(String(v))}</dd>`).join("");
  }
  function renderKinds(s) {
    const k = s.concept_kinds ?? { homogeneous: 0, composite_stack: 0 };
    kindStatsEl.innerHTML = [
      ["Enkellaags", k.homogeneous],
      ["Samengesteld", k.composite_stack]
    ].map(([label, n]) => `<dt>${esc(String(label))}</dt><dd>${esc(String(n))}</dd>`).join("");
  }
  function renderRecent(s) {
    const rows = s.recently_added ?? [];
    if (!rows.length) {
      recentListEl.innerHTML = "";
      recentEmptyEl.classList.remove("hidden");
      return;
    }
    recentEmptyEl.classList.add("hidden");
    recentListEl.innerHTML = rows.map((r) => {
      const title = `${r.catalog_id || "\u2014"} \xB7 ${r.name || "(zonder naam)"}`;
      return `<li>
          ${kindBadge(r.material_kind)}
          <a href="/materials.html?q=${encodeURIComponent(r.catalog_id || r.name || "")}">${esc(title)}</a>
          <span class="ms-recent-meta">${esc(fmtWhen(r.created_at))}</span>
        </li>`;
    }).join("");
  }
  function renderTemplates(s) {
    const templates = s.assembly_templates ?? [];
    templatesCache = templates;
    fillTemplateSelect(templates);
    if (!templates.length) {
      templatesEl.innerHTML = '<p class="hint">Geen opbouwtemplates \u2014 pas DDL 0.2.42 toe.</p>';
      return;
    }
    const order = ["buitengevel", "dak", "overig"];
    const byFamily = /* @__PURE__ */ new Map();
    for (const t of templates) {
      const fam = t.assembly_family || "overig";
      if (!byFamily.has(fam)) byFamily.set(fam, []);
      byFamily.get(fam).push(t);
    }
    const parts = [];
    for (const fam of order) {
      const list = byFamily.get(fam);
      if (!list?.length) continue;
      parts.push(`<h3 class="ms-family-title">${esc(FAMILY_LABEL[fam] || fam)}</h3>`);
      for (const t of list) {
        const layers = (t.layers || []).map((l) => {
          let extra = "";
          if (l.layer_kind === "framing" && l.stud_width_mm && l.stud_spacing_mm) {
            const g = woodGridMetrics({
              stud_width_mm: l.stud_width_mm,
              stud_spacing_mm: l.stud_spacing_mm,
              stud_depth_mm: l.stud_depth_mm ?? l.thickness_mm,
              density_kg_m3: l.density_kg_m3 ?? 450,
              thickness_mm: l.thickness_mm
            });
            if (g) {
              extra = ` <span class="ms-layer-mm">\u03C6 ${esc(String(g.phi_pct))}% \xB7 m\u2033eq ${esc(String(g.m_eq_kg_m2))} kg/m\xB2</span>`;
            } else if (l.thickness_mm != null) {
              extra = ` <span class="ms-layer-mm">${esc(String(l.thickness_mm))}&nbsp;mm</span>`;
            }
          } else if (l.thickness_mm != null) {
            extra = ` <span class="ms-layer-mm">${esc(String(l.thickness_mm))}&nbsp;mm</span>`;
          }
          return `<li><span class="ms-layer-ord">${esc(String(l.layer_order))}</span> ${esc(l.label)}${extra}</li>`;
        }).join("");
        parts.push(`<article class="ms-template">
          <header>
            <strong>${esc(t.name)}</strong>
            <code class="ms-template-code">${esc(t.code)}</code>
            <button type="button" class="secondary ms-use-tpl" data-code="${esc(t.code)}">Gebruik in assistent</button>
          </header>
          <p class="hint">${esc(t.description || "")}</p>
          <ol class="ms-layer-list">${layers}</ol>
        </article>`);
      }
    }
    templatesEl.innerHTML = parts.join("");
    templatesEl.querySelectorAll(".ms-use-tpl").forEach((btn) => {
      btn.addEventListener("click", () => {
        const code = btn.dataset.code || "";
        composeModeEl.value = "existing";
        syncComposeModeUi();
        composeTplEl.value = code;
        applyTemplate(code);
        document.getElementById("ms-compose-panel")?.scrollIntoView({ behavior: "smooth" });
      });
    });
  }
  function fillTemplateSelect(templates) {
    const keep = composeTplEl.value;
    composeTplEl.replaceChildren();
    const ph = document.createElement("option");
    ph.value = "";
    ph.textContent = "\u2014 kies template \u2014";
    composeTplEl.appendChild(ph);
    for (const t of templates) {
      const opt = document.createElement("option");
      opt.value = t.code;
      opt.textContent = `${FAMILY_LABEL[t.assembly_family] || t.assembly_family}: ${t.name}`;
      composeTplEl.appendChild(opt);
    }
    if (keep && [...composeTplEl.options].some((o) => o.value === keep)) {
      composeTplEl.value = keep;
    }
  }
  function renderQc(s) {
    const qc = s.qc;
    if (!qc) {
      qcMetaEl.textContent = "Geen QC-rapport gevonden \u2014 voer materials-qc-audit.py uit.";
      qcIssuesEl.innerHTML = "";
      return;
    }
    const when = qc.generated_at ? new Date(qc.generated_at).toLocaleString("nl-NL") : "\u2014";
    qcMetaEl.textContent = `Gegenereerd: ${when} \xB7 ${qc.stats.total ?? "\u2014"} rijen geaudit.`;
    const issues = Object.entries(qc.issue_counts || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
    if (!issues.length) {
      qcIssuesEl.innerHTML = '<p class="hint">Geen open QC-issues in rapport.</p>';
      return;
    }
    qcIssuesEl.innerHTML = `<ul class="ms-issue-list">${issues.map(([k, n]) => `<li><strong>${esc(k)}</strong>: ${esc(String(n))}</li>`).join("")}</ul>`;
  }
  async function approvePublishConcept(conceptId) {
    return apiPost("/api/materials-studio/approve-publish", { concept_id: conceptId });
  }
  function renderProposed(s) {
    if (!proposedListEl || !proposedEmptyEl) return;
    const rows = [...s.proposed_composites || []].sort(
      (a, b) => String(b.created_at).localeCompare(String(a.created_at))
    );
    if (!rows.length) {
      proposedListEl.innerHTML = "";
      proposedEmptyEl.classList.remove("hidden");
      return;
    }
    proposedEmptyEl.classList.add("hidden");
    proposedListEl.innerHTML = rows.map((r) => {
      const fam = FAMILY_LABEL[r.assembly_family] || r.assembly_family;
      const rw = r.rw_db != null ? `Rw ${r.rw_db}` : "\u2014";
      const ra = r.ra_dba != null ? `RA ${r.ra_dba}` : "\u2014";
      return `<article class="ms-template ms-proposed">
          <header>
            <strong>${esc(r.name)}</strong>
            <code class="ms-template-code">${esc(r.template_code || r.concept_catalog_id || "\u2014")}</code>
            <button type="button" class="ms-approve-pub" data-concept="${esc(r.concept_id)}">
              Goedkeuren &amp; naar catalogus
            </button>
          </header>
          <p class="hint">${esc(fam)} \xB7 ${esc(ra)} \xB7 ${esc(rw)} \xB7 ${esc(fmtWhen(r.created_at))}</p>
        </article>`;
    }).join("");
    proposedListEl.querySelectorAll(".ms-approve-pub").forEach((btn) => {
      btn.addEventListener("click", () => {
        void (async () => {
          const id = btn.dataset.concept || "";
          if (!id) return;
          if (!confirm(
            "Dit voorstel goedkeuren en als A#####-materiaal in de catalogus zetten?\nHet wordt dan zoekbaar op gevel/GA."
          )) {
            return;
          }
          try {
            btn.disabled = true;
            actionOutEl.textContent = "Goedkeuren & publiceren\u2026";
            const out = await approvePublishConcept(id);
            actionOutEl.textContent = `Catalogus: ${out.catalog_id} \xB7 ${out.name}${out.created ? " (nieuw)" : " (bijgewerkt)"}.`;
            await load();
          } catch (err) {
            actionOutEl.textContent = err instanceof Error ? err.message : "publiceren mislukt";
            btn.disabled = false;
          }
        })();
      });
    });
  }
  function defaultLayer(order) {
    return {
      layer_order: order,
      layer_kind: "cladding",
      label: order === 1 ? "Buitenlaag" : `Laag ${order}`,
      acoustic_role: "structural",
      thickness_mm: "",
      density_kg_m3: "",
      cavity_depth_mm: "",
      stud_width_mm: "",
      stud_depth_mm: "",
      stud_spacing_mm: "",
      material_id: "",
      material_label: ""
    };
  }
  function applyTemplate(code) {
    const t = templatesCache.find((x) => x.code === code);
    if (!t) return;
    composeFamilyEl.value = t.assembly_family || "overig";
    composeNameEl.value = t.name;
    composeLayers = (t.layers || []).map((l) => {
      const p = l.params || {};
      const catalogId = typeof p.catalog_id === "string" ? p.catalog_id : "";
      const materialId = typeof p.material_id === "string" ? p.material_id : "";
      const isCavity = l.layer_kind === "cavity_ventilated";
      return {
        layer_order: l.layer_order,
        layer_kind: l.layer_kind,
        label: l.label,
        acoustic_role: isCavity ? "cavity" : l.acoustic_role || "structural",
        thickness_mm: isCavity ? "" : l.thickness_mm != null ? String(l.thickness_mm) : "",
        density_kg_m3: isCavity ? "" : l.density_kg_m3 != null ? String(l.density_kg_m3) : "",
        cavity_depth_mm: l.cavity_depth_mm != null ? String(l.cavity_depth_mm) : isCavity && l.thickness_mm != null ? String(l.thickness_mm) : "",
        stud_width_mm: l.stud_width_mm != null ? String(l.stud_width_mm) : "",
        stud_depth_mm: l.stud_depth_mm != null ? String(l.stud_depth_mm) : "",
        stud_spacing_mm: l.stud_spacing_mm != null ? String(l.stud_spacing_mm) : "",
        material_id: isCavity ? "" : materialId,
        material_label: isCavity ? "" : catalogId ? `${catalogId}${l.label ? ` \xB7 ${l.label}` : ""}` : ""
      };
    });
    if (!composeLayers.length) composeLayers = [defaultLayer(1)];
    lastPreview = null;
    composeResultEl.classList.add("hidden");
    renderComposeLayers();
  }
  function syncComposeModeUi() {
    const existing = composeModeEl.value === "existing";
    composeTplWrap.classList.toggle("hidden", !existing);
    if (!existing && !composeLayers.length) {
      composeLayers = [defaultLayer(1), defaultLayer(2)];
      renderComposeLayers();
    }
  }
  function renumberLayers() {
    composeLayers.forEach((L, i) => {
      L.layer_order = i + 1;
    });
  }
  function framingMetricsHtml(L) {
    if (L.layer_kind !== "framing") return "";
    const g = woodGridMetrics({
      stud_width_mm: L.stud_width_mm,
      stud_spacing_mm: L.stud_spacing_mm,
      stud_depth_mm: L.stud_depth_mm || L.thickness_mm,
      density_kg_m3: L.density_kg_m3 || "450",
      thickness_mm: L.thickness_mm
    });
    if (!g) {
      return `<p class="hint ms-wood-calc">Rekenwaarde \u03C6 / m\u2033eq: vul breedte, h.o.h. en \u03C1 in.</p>`;
    }
    return `<p class="hint ms-wood-calc">Rekenwaarde (read-only): \u03C6 = <strong>${esc(String(g.phi_pct))}%</strong>
      (b/a) \xB7 m\u2033eq = <strong>${esc(String(g.m_eq_kg_m2))} kg/m\xB2</strong>
      \xB7 A<sub>hout</sub> = \u03C6 \xB7 A<sub>dak</sub></p>`;
  }
  function renderComposeLayers() {
    renumberLayers();
    composeLayersEl.innerHTML = "";
    composeLayers.forEach((L, idx) => {
      const row = document.createElement("div");
      row.className = "ms-compose-layer";
      row.dataset.idx = String(idx);
      const kindOpts = LAYER_KINDS.map(
        (k) => `<option value="${esc(k.value)}" ${k.value === L.layer_kind ? "selected" : ""}>${esc(k.label)}</option>`
      ).join("");
      const isCavity = L.layer_kind === "cavity_ventilated";
      const isFraming = L.layer_kind === "framing";
      const framingBlock = isFraming ? `<label class="mat-field">Breedte mm
              <input data-field="stud_width_mm" inputmode="decimal" value="${esc(L.stud_width_mm)}" />
            </label>
            <label class="mat-field">Hoogte mm
              <input data-field="stud_depth_mm" inputmode="decimal" value="${esc(L.stud_depth_mm)}" />
            </label>
            <label class="mat-field">h.o.h. mm
              <input data-field="stud_spacing_mm" inputmode="decimal" value="${esc(L.stud_spacing_mm)}" title="Hart-op-hart afstand (rekenwaarde default: tengel 600, panlat 320)" />
            </label>
            ${framingMetricsHtml(L)}` : "";
      const cavityDepth = L.cavity_depth_mm || L.thickness_mm || "";
      const bodyFields = isCavity ? `<p class="hint ms-mat-picked">Spouw = lucht \u2014 geen materiaal. Alleen hoogte/dikte van de spouw.</p>
          <label class="mat-field">Hoogte / dikte mm
            <input data-field="cavity_depth_mm" inputmode="decimal" value="${esc(cavityDepth)}"
              title="Diepte van de luchtspouw" />
          </label>` : `<label class="mat-field mat-field-grow">Enkellaags materiaal
            <input data-field="mat_q" type="search" placeholder="zoek catalogus-id of naam\u2026"
              value="${esc(L.material_label || "")}"
              aria-autocomplete="list"
              aria-controls="ms-mat-hits-${esc(String(L.layer_order))}" />
          </label>
          <div class="ms-mat-hits" id="ms-mat-hits-${esc(String(L.layer_order))}" data-hits hidden role="listbox" aria-label="Zoekresultaten materiaal"></div>
          <p class="hint ms-mat-picked">${L.material_id ? `Gekozen: <strong>${esc(L.material_label || L.material_id)}</strong>` : isFraming ? "Regelwerk: geometrie hieronder; \u03C6 en m\u2033eq zijn rekenwaarden." : "Nog geen materiaal \u2014 typ minstens 2 tekens om te zoeken, klik een treffer."}</p>
          <label class="mat-field">Dikte mm
            <input data-field="thickness_mm" inputmode="decimal" value="${esc(L.thickness_mm)}" />
          </label>
          <label class="mat-field">\u03C1 kg/m\xB3
            <input data-field="density_kg_m3" inputmode="decimal" value="${esc(L.density_kg_m3)}" />
          </label>
          ${framingBlock}`;
      row.innerHTML = `
        <div class="ms-compose-layer-head">
          <span class="ms-layer-ord">${esc(String(L.layer_order))}</span>
          <label class="mat-field">Soort
            <select data-field="layer_kind">${kindOpts}</select>
          </label>
          <label class="mat-field mat-field-grow">Label
            <input data-field="label" value="${esc(L.label)}" maxlength="120" />
          </label>
          <button type="button" class="secondary danger ms-compose-remove" title="Verwijder laag">\xD7</button>
        </div>
        <div class="ms-compose-layer-body">
          ${bodyFields}
        </div>`;
      const kindSel = row.querySelector('[data-field="layer_kind"]');
      kindSel.addEventListener("change", () => {
        L.layer_kind = kindSel.value;
        const meta = LAYER_KINDS.find((k) => k.value === L.layer_kind);
        if (meta) L.acoustic_role = meta.role;
        if (L.layer_kind === "cavity_ventilated") {
          L.material_id = "";
          L.material_label = "";
          L.density_kg_m3 = "";
          if (!L.cavity_depth_mm && L.thickness_mm) L.cavity_depth_mm = L.thickness_mm;
          L.thickness_mm = "";
          L.acoustic_role = "cavity";
        }
        if (L.layer_kind === "framing") {
          if (!L.stud_width_mm) L.stud_width_mm = "38";
          if (!L.stud_depth_mm) L.stud_depth_mm = L.thickness_mm || "30";
          if (!L.stud_spacing_mm) L.stud_spacing_mm = "600";
          if (!L.density_kg_m3) L.density_kg_m3 = "450";
          if (!L.thickness_mm) L.thickness_mm = L.stud_depth_mm;
        }
        renderComposeLayers();
      });
      const labelInp = row.querySelector('[data-field="label"]');
      labelInp.addEventListener("input", () => {
        L.label = labelInp.value;
      });
      for (const field of [
        "thickness_mm",
        "density_kg_m3",
        "cavity_depth_mm",
        "stud_width_mm",
        "stud_depth_mm",
        "stud_spacing_mm"
      ]) {
        const inp = row.querySelector(`[data-field="${field}"]`);
        if (!inp) continue;
        inp.addEventListener("input", () => {
          L[field] = inp.value;
          if (field === "cavity_depth_mm" && L.layer_kind === "cavity_ventilated") {
            L.thickness_mm = inp.value;
          }
          if (field === "stud_depth_mm" && L.layer_kind === "framing") {
            L.thickness_mm = inp.value;
            const th = row.querySelector('[data-field="thickness_mm"]');
            if (th) th.value = inp.value;
          }
          const calcEl = row.querySelector(".ms-wood-calc");
          if (calcEl && L.layer_kind === "framing") {
            calcEl.outerHTML = framingMetricsHtml(L);
          }
        });
      }
      const removeBtn = row.querySelector(".ms-compose-remove");
      removeBtn.addEventListener("click", () => {
        if (composeLayers.length <= 1) return;
        composeLayers.splice(idx, 1);
        renderComposeLayers();
      });
      if (!isCavity) {
        const qInp = row.querySelector('[data-field="mat_q"]');
        const hitsEl = row.querySelector("[data-hits]");
        const pickedEl = row.querySelector(".ms-mat-picked");
        if (qInp && hitsEl && pickedEl) {
          let searchTimer = null;
          qInp.addEventListener("input", () => {
            if (searchTimer) clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
              void searchMaterials(qInp.value.trim(), hitsEl, L, pickedEl, qInp);
            }, 280);
          });
          qInp.addEventListener("focus", () => {
            const q = qInp.value.trim();
            if (q.length >= 2 && hitsEl.hidden) {
              void searchMaterials(q, hitsEl, L, pickedEl, qInp);
            }
          });
        }
      }
      composeLayersEl.appendChild(row);
    });
  }
  async function searchMaterials(q, hitsEl, layer, pickedEl, qInp) {
    if (q.length < 2) {
      hitsEl.hidden = true;
      hitsEl.innerHTML = "";
      return;
    }
    try {
      const data = await apiGet(
        `/api/materials-studio/material-search?q=${encodeURIComponent(q)}&limit=12`
      );
      const mats = data.materials || [];
      if (!mats.length) {
        hitsEl.hidden = false;
        hitsEl.innerHTML = `<p class="ms-mat-hits-meta">Geen treffers voor \xAB${esc(q)}\xBB (enkellaags).</p>`;
        return;
      }
      hitsEl.hidden = false;
      const n = mats.length;
      hitsEl.innerHTML = `<p class="ms-mat-hits-meta">${esc(String(n))} treffer${n === 1 ? "" : "s"} voor \xAB${esc(q)}\xBB \u2014 klik om te kiezen</p>` + mats.map((m) => {
        const bits = [];
        if (m.thickness_mm != null) bits.push(`${m.thickness_mm} mm`);
        if (m.rw_db != null) bits.push(`Rw ${m.rw_db}`);
        if (m.ra_dba != null) bits.push(`RA ${m.ra_dba}`);
        const meta = bits.length ? ` <span class="ms-mat-hit-meta">${esc(bits.join(" \xB7 "))}</span>` : "";
        return `<button type="button" class="ms-mat-hit" role="option" data-id="${esc(m.material_id)}" title="${esc(m.catalog_id)} \xB7 ${esc(m.name)}">
            <span class="ms-mat-hit-id">${esc(m.catalog_id || "\u2014")}</span>${esc(m.name || "(zonder naam)")}${meta}
          </button>`;
      }).join("");
      hitsEl.querySelectorAll(".ms-mat-hit").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.dataset.id || "";
          const m = mats.find((x) => x.material_id === id);
          if (!m) return;
          layer.material_id = m.material_id;
          layer.material_label = `${m.catalog_id} \xB7 ${m.name}`;
          if (m.thickness_mm != null && !layer.thickness_mm) {
            layer.thickness_mm = String(m.thickness_mm);
          }
          if (m.density_kg_m3 != null && !layer.density_kg_m3) {
            layer.density_kg_m3 = String(Math.round(Number(m.density_kg_m3)));
          }
          qInp.value = layer.material_label;
          pickedEl.innerHTML = `Gekozen: <strong>${esc(layer.material_label)}</strong>
            <button type="button" class="secondary ms-mat-clear">Wissen</button>`;
          pickedEl.querySelector(".ms-mat-clear")?.addEventListener("click", () => {
            layer.material_id = "";
            layer.material_label = "";
            qInp.value = "";
            pickedEl.textContent = "Nog geen materiaal \u2014 typ minstens 2 tekens om te zoeken, klik een treffer.";
            hitsEl.hidden = true;
            hitsEl.innerHTML = "";
          });
          hitsEl.hidden = true;
          hitsEl.innerHTML = "";
          const row = qInp.closest(".ms-compose-layer");
          const th = row?.querySelector('[data-field="thickness_mm"]');
          const dens = row?.querySelector('[data-field="density_kg_m3"]');
          if (th && layer.thickness_mm) th.value = layer.thickness_mm;
          if (dens && layer.density_kg_m3) dens.value = layer.density_kg_m3;
        });
      });
    } catch (err) {
      hitsEl.hidden = false;
      hitsEl.innerHTML = `<p class="hint">${esc(err instanceof Error ? err.message : "zoeken mislukt")}</p>`;
    }
  }
  function layersPayload() {
    return composeLayers.map((L) => {
      const isCavity = L.layer_kind === "cavity_ventilated";
      const cavityMm = (L.cavity_depth_mm || L.thickness_mm).trim() || null;
      return {
        layer_order: L.layer_order,
        layer_kind: L.layer_kind,
        label: L.label,
        acoustic_role: isCavity ? "cavity" : LAYER_KINDS.find((k) => k.value === L.layer_kind)?.role || L.acoustic_role || "structural",
        thickness_mm: isCavity ? cavityMm : L.thickness_mm.trim() || null,
        density_kg_m3: isCavity ? null : L.density_kg_m3.trim() || null,
        cavity_depth_mm: isCavity ? cavityMm : L.cavity_depth_mm.trim() || null,
        stud_width_mm: L.stud_width_mm.trim() || null,
        stud_depth_mm: L.stud_depth_mm.trim() || null,
        stud_spacing_mm: L.stud_spacing_mm.trim() || null,
        material_id: isCavity ? null : L.material_id || null
      };
    });
  }
  function renderPreview(preview) {
    lastPreview = preview;
    composeResultEl.classList.remove("hidden");
    composeLayerTbody.innerHTML = preview.layers.map((L) => {
      const spec = L.spectrum;
      const mat = L.catalog_id ? `${L.catalog_id}${L.material_name ? ` \xB7 ${L.material_name}` : ""}` : "\u2014";
      const methodLabel = L.method === "catalog" ? "catalogus" : L.method === "mass_law" ? "massawet" : L.method === "wood_grid" ? "regelwerk \u03C6" : "\u2014";
      return `<tr>
          <td>${esc(String(L.layer_order))}</td>
          <td>${esc(L.label)}</td>
          <td>${esc(mat)}</td>
          <td>${esc(methodLabel)}</td>
          <td class="num">${esc(fmtNum(specBand(spec, 125)))}</td>
          <td class="num">${esc(fmtNum(specBand(spec, 250)))}</td>
          <td class="num">${esc(fmtNum(specBand(spec, 500)))}</td>
          <td class="num">${esc(fmtNum(specBand(spec, 1e3)))}</td>
          <td class="num">${esc(fmtNum(specBand(spec, 2e3)))}</td>
          <td class="num"><strong>${esc(fmtNum(L.rw_db))}</strong></td>
          <td class="num">${esc(fmtNum(L.c_db))}</td>
          <td class="num">${esc(fmtNum(L.ctr_db))}</td>
        </tr>`;
    }).join("");
    const st = preview.stack;
    composeStackNote.textContent = st.note || "";
    const s = st.spectrum || {};
    composeStackStats.innerHTML = [
      ["R125", s["125"]],
      ["R250", s["250"]],
      ["R500", s["500"]],
      ["R1000", s["1000"]],
      ["R2000", s["2000"]],
      ["Rw", st.rw_db],
      ["C", st.c_db],
      ["Ctr", st.ctr_db],
      ["RA\u2248", st.ra_dba_approx]
    ].map(([k, v]) => `<dt>${esc(String(k))}</dt><dd>${esc(fmtNum(v))}</dd>`).join("");
  }
  async function load() {
    const data = await apiGet("/api/materials-studio/summary");
    renderStats(data);
    renderKinds(data);
    renderRecent(data);
    renderTemplates(data);
    renderProposed(data);
    renderQc(data);
    if (!composeLayers.length && templatesCache.length) {
    }
    syncComposeModeUi();
    if (!composeLayers.length) {
      composeLayers = [defaultLayer(1)];
      renderComposeLayers();
    }
  }
  refreshBtn.addEventListener("click", () => {
    void load().catch((err) => {
      actionOutEl.textContent = err instanceof Error ? err.message : "laden mislukt";
    });
  });
  publishBtn.addEventListener("click", async () => {
    if (!confirm("Laatste goedgekeurde spectra publiceren naar app_gevelwering.material?")) return;
    try {
      publishBtn.disabled = true;
      actionOutEl.textContent = "Publiceren\u2026";
      const out = await apiPost("/api/materials-studio/publish", {});
      actionOutEl.textContent = `Gepubliceerd: ${out.published_rows} rijen (${out.linked_concepts} concept-koppelingen).`;
      await load();
    } catch (err) {
      actionOutEl.textContent = err instanceof Error ? err.message : "publiceren mislukt";
    } finally {
      publishBtn.disabled = false;
    }
  });
  refineKzBtn.addEventListener("click", async () => {
    try {
      refineKzBtn.disabled = true;
      actionOutEl.textContent = "Kalkzandsteen-patroon verfijnen\u2026";
      const out = await apiPost(
        "/api/materials-studio/refine-kalkzandsteen",
        {}
      );
      actionOutEl.textContent = `Patroon ${out.pattern?.code ?? "SP-R1-S2-KALKZANDSTEEN"} bijgewerkt (n=${out.sample_count}).`;
    } catch (err) {
      actionOutEl.textContent = err instanceof Error ? err.message : "verfijnen mislukt";
    } finally {
      refineKzBtn.disabled = false;
    }
  });
  composeModeEl.addEventListener("change", () => {
    syncComposeModeUi();
    if (composeModeEl.value === "new") {
      composeTplEl.value = "";
      composeNameEl.value = "";
      composeLayers = [defaultLayer(1), defaultLayer(2)];
      renderComposeLayers();
    }
  });
  composeTplEl.addEventListener("change", () => {
    if (composeTplEl.value) applyTemplate(composeTplEl.value);
  });
  composeAddBtn.addEventListener("click", () => {
    composeLayers.push(defaultLayer(composeLayers.length + 1));
    renderComposeLayers();
  });
  composePreviewBtn.addEventListener("click", async () => {
    try {
      composePreviewBtn.disabled = true;
      composeSaveOut.textContent = "Berekenen\u2026";
      const preview = await apiPost("/api/materials-studio/compose-preview", {
        template_code: composeModeEl.value === "existing" ? composeTplEl.value || null : null,
        name: composeNameEl.value.trim() || null,
        assembly_family: composeFamilyEl.value,
        layers: layersPayload()
      });
      renderPreview(preview);
      composeSaveOut.textContent = "Preview klaar \u2014 controleer Rw per laag en totaal.";
    } catch (err) {
      composeSaveOut.textContent = err instanceof Error ? err.message : "preview mislukt";
    } finally {
      composePreviewBtn.disabled = false;
    }
  });
  composeSaveBtn.addEventListener("click", async () => {
    if (!lastPreview) {
      composeSaveOut.textContent = "Eerst spectrum / Rw berekenen.";
      return;
    }
    if (!composeSaveTplEl.checked && !composeSaveConceptEl.checked) {
      composeSaveOut.textContent = "Vink template en/of concept aan.";
      return;
    }
    try {
      composeSaveBtn.disabled = true;
      composeSaveOut.textContent = "Opslaan\u2026";
      const code = composeModeEl.value === "existing" && composeTplEl.value ? composeTplEl.value : composeModeEl.value === "new" ? `ASM-${composeFamilyEl.value.toUpperCase()}-${Date.now().toString(36).toUpperCase()}` : composeTplEl.value || null;
      const out = await apiPost("/api/materials-studio/compose-save", {
        save_template: composeSaveTplEl.checked,
        save_concept: composeSaveConceptEl.checked,
        template_code: code,
        name: composeNameEl.value.trim() || lastPreview.layers.map((l) => l.label).join(" + "),
        concept_name: composeNameEl.value.trim() || null,
        assembly_family: composeFamilyEl.value,
        layers: lastPreview.layers,
        stack_spectrum: lastPreview.stack.spectrum,
        stack_ra: lastPreview.stack.ra_dba_approx
      });
      let msg = `Opgeslagen: template ${out.template_code || "\u2014"} \xB7 concept ${out.concept_id ? "proposed" : "\u2014"}.`;
      if (composePublishCatalogEl?.checked && out.concept_id) {
        composeSaveOut.textContent = "Goedkeuren & publiceren naar catalogus\u2026";
        const pub = await approvePublishConcept(out.concept_id);
        msg += ` Catalogus ${pub.catalog_id}${pub.created ? " (nieuw)" : ""}.`;
        composeSaveOut.textContent = msg;
        await load();
        window.location.href = `/materials.html?q=${encodeURIComponent(pub.catalog_id)}`;
        return;
      }
      composeSaveOut.textContent = msg;
      await load();
    } catch (err) {
      composeSaveOut.textContent = err instanceof Error ? err.message : "opslaan mislukt";
    } finally {
      composeSaveBtn.disabled = false;
    }
  });
  return { load };
}

// src/materials.ts
var AUTH_KEY = "app_gevelwering_admin_auth";
var bootParams = new URLSearchParams(location.search);
var deepMaterialId = (bootParams.get("material_id") || bootParams.get("id") || "").trim();
var deepQ = (bootParams.get("q") || "").trim();
var deepNew = bootParams.get("new") === "1" || bootParams.get("new") === "true" || bootParams.get("mode") === "new";
var returnHref = safeReturnHref(bootParams.get("return"));
var returnLabel = (bootParams.get("return_label") || "Terug naar toekennen vlak (gevel)").trim();
var pickTarget = (bootParams.get("pick_target") || "").trim().toLowerCase();
var deepExposure = (bootParams.get("exposure") || "").trim().toUpperCase();
var deepRubriek = (bootParams.get("rubriek") || "").trim();
var deepSubrubriek = (bootParams.get("subrubriek") || "").trim();
var returnLinkEl = document.getElementById("mat-return-link");
var returnWrapEl = document.getElementById("mat-return-wrap");
var pickBarEl = document.getElementById("mat-pick-bar");
var pickBtnEl = document.getElementById("mat-pick-btn");
var pickBtnEditorEl = document.getElementById("mat-pick-btn-editor");
var pickHintEl = document.getElementById("mat-pick-hint");
var PICK_STORAGE_KEY = "app-gevelwering-material-pick";
function buildingIdFromContext() {
  const direct = (bootParams.get("building_id") || "").trim();
  if (direct) return direct;
  if (!returnHref) return "";
  try {
    return new URL(returnHref, location.href).searchParams.get("building_id")?.trim() || "";
  } catch {
    return "";
  }
}
var contextBuildingId = buildingIdFromContext();
function isLoopbackHost(host) {
  const h = host.toLowerCase();
  return h === "127.0.0.1" || h === "localhost" || h === "[::1]" || h === "::1";
}
function safeReturnHref(raw) {
  if (!raw) return null;
  try {
    const u = new URL(raw, location.origin);
    if (!u.pathname.startsWith("/")) return null;
    if (u.origin === location.origin) {
      return `${u.pathname}${u.search}${u.hash}`;
    }
    if (isLoopbackHost(u.hostname) && isLoopbackHost(location.hostname)) {
      return u.toString();
    }
    return null;
  } catch {
    return null;
  }
}
function isCrossOriginReturn(href) {
  try {
    return new URL(href, location.href).origin !== location.origin;
  } catch {
    return false;
  }
}
function setupReturnNav() {
  const wrap = returnWrapEl ?? returnLinkEl;
  if (!wrap) return;
  if (!returnHref) {
    wrap.classList.add("hidden");
    return;
  }
  if (returnLinkEl) {
    returnLinkEl.href = returnHref;
    returnLinkEl.textContent = `\u2190 ${returnLabel}`;
  }
  wrap.classList.remove("hidden");
}
var initialTab = bootParams.get("tab") === "studio" ? "studio" : "catalog";
var tabCatalogBtn = document.getElementById("mat-tab-catalog-btn");
var tabStudioBtn = document.getElementById("mat-tab-studio-btn");
var tabCatalogPane = document.getElementById("mat-tab-catalog");
var tabStudioPane = document.getElementById("mat-tab-studio");
var studioPanel = null;
var activeTab = initialTab;
function setTab(tab, opts) {
  activeTab = tab;
  tabCatalogBtn.classList.toggle("active", tab === "catalog");
  tabStudioBtn.classList.toggle("active", tab === "studio");
  tabCatalogBtn.setAttribute("aria-selected", tab === "catalog" ? "true" : "false");
  tabStudioBtn.setAttribute("aria-selected", tab === "studio" ? "true" : "false");
  tabCatalogPane.classList.toggle("hidden", tab !== "catalog");
  tabStudioPane.classList.toggle("hidden", tab !== "studio");
  tabStudioPane.hidden = tab !== "studio";
  if (tab === "studio") {
    void studioPanel?.load().catch((err) => {
      setStatus(err instanceof Error ? err.message : "Studio laden mislukt", "err");
    });
  }
  if (opts?.replaceUrl !== false) {
    const url = new URL(location.href);
    if (tab === "studio") url.searchParams.set("tab", "studio");
    else url.searchParams.delete("tab");
    history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }
}
function pickButtonLabel() {
  if (pickTarget === "dl") return "Neem over in \u0394L vloerafwerking (isolatie)";
  if (pickTarget === "rs") return "Neem over in R\u209B scheidingswand (isolatie)";
  return "Neem dit materiaal over in component";
}
function syncPickUi() {
  const canPick = Boolean(returnHref && selectedId);
  if (pickBarEl) pickBarEl.classList.toggle("hidden", !returnHref);
  if (pickBtnEl) {
    pickBtnEl.disabled = !canPick;
    pickBtnEl.textContent = pickButtonLabel();
  }
  if (pickBtnEditorEl) {
    pickBtnEditorEl.classList.toggle("hidden", !returnHref);
    pickBtnEditorEl.disabled = !canPick;
    pickBtnEditorEl.textContent = pickButtonLabel();
  }
  if (pickHintEl && returnHref) {
    pickHintEl.textContent = canPick ? pickTarget === "dl" || pickTarget === "rs" ? "Geselecteerd materiaal (spectrum) wordt teruggezet in de isolatieberekening." : "Geselecteerd materiaal wordt in het componentformulier gezet (ook als dat nog niet is opgeslagen)." : "Zoek en selecteer een materiaal, daarna overnemen om terug te gaan.";
  }
}
function pickMaterialForCaller() {
  if (!returnHref || !selectedId) return;
  const row = listRows.find((m) => m.material_id === selectedId) || {
    material_id: selectedId,
    catalog_id: catalogIdEl.value.trim(),
    master_category: masterEl.value.trim(),
    category: catEl.value.trim(),
    name: nameEl.value.trim(),
    r_125_hz: r125El.value.trim(),
    r_250_hz: r250El.value.trim(),
    r_500_hz: r500El.value.trim(),
    r_1000_hz: r1000El.value.trim(),
    r_2000_hz: r2000El.value.trim(),
    exposure: exposureEl?.value || ""
  };
  const payload = {
    material_id: String(row.material_id || selectedId).trim(),
    catalog_id: String(row.catalog_id || catalogIdEl.value.trim()).trim(),
    master_category: String(row.master_category || masterEl.value.trim()).trim(),
    category: String(row.category || catEl.value.trim()).trim(),
    name: String(row.name || nameEl.value.trim()).trim(),
    exposure: String(row.exposure || exposureEl?.value || "").trim(),
    pick_target: pickTarget || "",
    r: [
      Number(row.r_125_hz ?? r125El.value),
      Number(row.r_250_hz ?? r250El.value),
      Number(row.r_500_hz ?? r500El.value),
      Number(row.r_1000_hz ?? r1000El.value),
      Number(row.r_2000_hz ?? r2000El.value)
    ]
  };
  if (!payload.material_id || !payload.master_category) {
    setStatus("Selecteer een materiaal met rubriek om over te nemen", "err");
    return;
  }
  if (isCrossOriginReturn(returnHref)) {
    try {
      const u = new URL(returnHref, location.href);
      u.searchParams.set("mat_pick", "1");
      u.searchParams.set("material_id", String(payload.material_id));
      u.searchParams.set("catalog_id", String(payload.catalog_id || ""));
      u.searchParams.set("name", String(payload.name || ""));
      u.searchParams.set("pick_target", pickTarget || "rs");
      u.searchParams.set("r", payload.r.map((n) => Number.isFinite(n) ? String(n) : "").join(","));
      location.assign(u.toString());
      return;
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Terugkeer-URL ongeldig", "err");
      return;
    }
  }
  try {
    const draftRaw = sessionStorage.getItem("app-gevelwering-fm-component-draft");
    if (draftRaw) payload.draft = JSON.parse(draftRaw);
  } catch {
  }
  try {
    sessionStorage.setItem(PICK_STORAGE_KEY, JSON.stringify(payload));
  } catch {
  }
  location.assign(returnHref);
}
async function httpJson(url, init) {
  if (!auth()?.token) throw new Error("Niet ingelogd");
  const res = await fetch(url, {
    credentials: "include",
    ...init,
    headers: {
      ...apiAuthHeaders(auth().token, Boolean(init?.body)),
      ...init?.headers || {}
    }
  });
  const body = await res.json();
  if (!res.ok || body.ok === false) {
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return body;
}
async function syncFavoriteCheckbox() {
  if (!favoriteWrapEl || !favoriteEl) return;
  if (!contextBuildingId) {
    favoriteWrapEl.classList.add("hidden");
    favoriteEl.checked = false;
    return;
  }
  favoriteWrapEl.classList.remove("hidden");
  const mid = (selectedId || idEl.value || "").trim();
  if (!mid || !auth()?.token) {
    favoriteEl.checked = false;
    return;
  }
  try {
    const data = bppPhase1Enabled() ? await bppListMaterialFavorites(invokeString, auth().token, contextBuildingId) : await httpJson(
      `/api/floormap/material-favorites?building_id=${encodeURIComponent(contextBuildingId)}`
    );
    favoriteEl.checked = (data.materials || []).some((m) => m.material_id === mid);
  } catch {
    favoriteEl.checked = false;
  }
}
async function setFavoriteForSelection(on) {
  if (!auth()?.token) throw new Error("Niet ingelogd \u2014 log opnieuw in");
  if (!contextBuildingId) {
    throw new Error("Geen projectcontext \u2014 open de catalogus via de geveltekening van een project");
  }
  const mid = (selectedId || idEl.value || "").trim();
  if (!mid) throw new Error("Sla het materiaal eerst op voordat je favoriet zet");
  const label = (nameEl.value || catalogIdEl?.value || mid).trim();
  setStatus(
    on ? `Toevoegen aan meest gebruikt: ${label}\u2026` : `Verwijderen uit meest gebruikt: ${label}\u2026`,
    "busy"
  );
  if (on) {
    if (bppPhase1Enabled()) {
      await bppAddMaterialFavorite(invokeString, auth().token, contextBuildingId, mid);
    } else {
      await httpJson("/api/floormap/material-favorites", {
        method: "POST",
        body: JSON.stringify({ building_id: contextBuildingId, material_id: mid })
      });
    }
  } else if (bppPhase1Enabled()) {
    await bppRemoveMaterialFavorite(invokeString, auth().token, contextBuildingId, mid);
  } else {
    await httpJson(
      `/api/floormap/material-favorites?building_id=${encodeURIComponent(contextBuildingId)}&material_id=${encodeURIComponent(mid)}`,
      { method: "DELETE" }
    );
  }
}
var cachedPresets = [];
var expandedPresetId = null;
var selectedMaterialPresetIds = /* @__PURE__ */ new Set();
async function presetAction(body) {
  if (bppPhase1Enabled()) {
    return bppMaterialFavoritePresetAction(invokeString, auth().token, body);
  }
  return httpJson("/api/floormap/material-favorite-presets", {
    method: "POST",
    body: JSON.stringify(body)
  });
}
function fillPresetAddSelect() {
  if (!presetAddSelectEl) return;
  const keep = presetAddSelectEl.value;
  presetAddSelectEl.replaceChildren();
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = cachedPresets.length ? "\u2014 kies preset \u2014" : "\u2014 geen presets \u2014";
  presetAddSelectEl.appendChild(ph);
  for (const p of cachedPresets) {
    const opt = document.createElement("option");
    opt.value = p.preset_id;
    const inIt = selectedMaterialPresetIds.has(p.preset_id);
    opt.textContent = inIt ? `${p.name} (${p.material_count}) \xB7 al erin` : `${p.name} (${p.material_count})`;
    if (inIt) opt.disabled = true;
    presetAddSelectEl.appendChild(opt);
  }
  if (keep && [...presetAddSelectEl.options].some((o) => o.value === keep && !o.disabled)) {
    presetAddSelectEl.value = keep;
  } else {
    presetAddSelectEl.value = "";
  }
}
function syncPresetAddUi() {
  const mid = selectedId || idEl.value.trim();
  const hasMat = Boolean(mid);
  const hasPresets = cachedPresets.length > 0;
  if (presetAddSelectEl) presetAddSelectEl.disabled = !hasMat || !hasPresets;
  if (presetAddBtn) {
    presetAddBtn.disabled = !hasMat || !hasPresets || !presetAddSelectEl?.value;
  }
  if (presetAddNewBtn) presetAddNewBtn.disabled = !hasMat;
  if (presetAddHintEl) {
    if (!hasMat) {
      presetAddHintEl.textContent = "Selecteer of sla eerst een materiaal op.";
    } else if (!hasPresets) {
      presetAddHintEl.textContent = "Nog geen presets \u2014 maak er een met \xABNieuwe preset\u2026\xBB.";
    } else {
      const n = selectedMaterialPresetIds.size;
      presetAddHintEl.textContent = n > 0 ? `Staat al in ${n} preset${n === 1 ? "" : "s"}. Kies een andere of maak een nieuwe.` : "Kies een preset en klik Toevoegen.";
    }
  }
}
async function refreshPresetsForSelectedMaterial() {
  const mid = selectedId || idEl.value.trim();
  selectedMaterialPresetIds = /* @__PURE__ */ new Set();
  if (!mid || !auth()?.token) {
    fillPresetAddSelect();
    syncPresetAddUi();
    return;
  }
  try {
    const data = await presetAction({
      action: "presets_for_material",
      material_id: mid
    });
    selectedMaterialPresetIds = new Set(data.preset_ids || []);
  } catch {
    selectedMaterialPresetIds = /* @__PURE__ */ new Set();
  }
  fillPresetAddSelect();
  syncPresetAddUi();
  presetListEl?.querySelectorAll("[data-preset-id]").forEach((el) => {
    const pid = el.dataset.presetId || "";
    const mark = el.querySelector(".mat-preset-contains");
    if (!mark) return;
    mark.classList.toggle("hidden", !selectedMaterialPresetIds.has(pid));
  });
}
async function addSelectedToPreset(presetId) {
  const mid = selectedId || idEl.value.trim();
  if (!mid) throw new Error("Geen materiaal geselecteerd");
  const out = await presetAction({
    action: "add_item",
    preset_id: presetId,
    material_id: mid
  });
  await loadPresets();
  if (expandedPresetId === presetId) await expandPreset(presetId, true);
  await refreshPresetsForSelectedMaterial();
  const label = out.name || "preset";
  if (out.already_present) {
    setStatus(`Stond al in \xAB${label}\xBB`, "ok");
  } else {
    setStatus(`Toegevoegd aan \xAB${label}\xBB (${out.material_count ?? "?"} materialen)`, "ok");
  }
}
function setPresetFeedback(text, kind = "ok") {
  if (!presetFeedbackEl) return;
  presetFeedbackEl.textContent = text;
  presetFeedbackEl.classList.remove("ok", "err", "busy");
  presetFeedbackEl.classList.add(kind);
}
async function createPreset(name, withSelectedMaterial) {
  setPresetFeedback(`Preset \xAB${name}\xBB aanmaken\u2026`, "busy");
  setStatus(`Preset \xAB${name}\xBB aanmaken\u2026`, "busy");
  const created = await presetAction({
    action: "create",
    name
  });
  if (!created?.preset_id) {
    throw new Error("Preset aanmaken mislukt (geen preset_id in antwoord)");
  }
  if (withSelectedMaterial) {
    const mid = selectedId || idEl.value.trim();
    if (mid) {
      await presetAction({
        action: "add_item",
        preset_id: created.preset_id,
        material_id: mid
      });
    }
  }
  expandedPresetId = created.preset_id;
  await loadPresets();
  await expandPreset(created.preset_id, true);
  const li = presetListEl?.querySelector(
    `[data-preset-id="${CSS.escape(created.preset_id)}"]`
  );
  li?.classList.add("mat-preset-item-new");
  li?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  document.getElementById("mat-presets-panel")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  await refreshPresetsForSelectedMaterial();
  return created.preset_id;
}
async function expandPreset(presetId, force = false) {
  if (!presetListEl) return;
  const li = presetListEl.querySelector(`[data-preset-id="${CSS.escape(presetId)}"]`);
  if (!li) return;
  const detail = li.querySelector(".mat-preset-detail");
  if (!detail) return;
  if (!force && expandedPresetId === presetId && !detail.classList.contains("hidden")) {
    detail.classList.add("hidden");
    expandedPresetId = null;
    li.querySelector(".mat-preset-toggle")?.setAttribute("aria-expanded", "false");
    return;
  }
  presetListEl.querySelectorAll(".mat-preset-detail").forEach((d) => d.classList.add("hidden"));
  presetListEl.querySelectorAll(".mat-preset-toggle").forEach((b) => b.setAttribute("aria-expanded", "false"));
  expandedPresetId = presetId;
  detail.classList.remove("hidden");
  detail.innerHTML = `<p class="hint">Laden\u2026</p>`;
  li.querySelector(".mat-preset-toggle")?.setAttribute("aria-expanded", "true");
  try {
    const data = await presetAction({
      action: "get",
      preset_id: presetId
    });
    const mats = data.materials || [];
    const countEl = li.querySelector(".mat-preset-count");
    if (countEl) countEl.textContent = String(data.material_count ?? mats.length);
    if (!mats.length) {
      detail.innerHTML = `<p class="hint">Nog geen materialen in deze preset.</p>`;
      return;
    }
    const ul = document.createElement("ul");
    ul.className = "mat-preset-materials";
    for (const m of mats) {
      const row = document.createElement("li");
      row.className = "mat-preset-material";
      const link = document.createElement("button");
      link.type = "button";
      link.className = "mat-preset-mat-link";
      const code = (m.catalog_id || "").trim();
      const ra = m.ra_dba != null ? ` \xB7 RA ${m.ra_dba}` : "";
      link.textContent = code ? `${code} \xB7 ${m.name}${ra}` : `${m.name}${ra}`;
      link.title = "Open in catalogus";
      link.addEventListener("click", () => {
        if (listRows.some((r) => r.material_id === m.material_id)) {
          selectFromList(m.material_id);
        } else {
          qEl.value = code || m.name;
          offset = 0;
          void loadList(m.material_id);
        }
      });
      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "secondary danger";
      rm.textContent = "Verwijderen";
      rm.addEventListener("click", () => {
        void (async () => {
          try {
            await presetAction({
              action: "remove_item",
              preset_id: presetId,
              material_id: m.material_id
            });
            setStatus(`Verwijderd uit preset`, "ok");
            await loadPresets();
            await expandPreset(presetId, true);
            await refreshPresetsForSelectedMaterial();
          } catch (err) {
            setStatus(err instanceof Error ? err.message : String(err), "err");
          }
        })();
      });
      row.append(link, rm);
      ul.appendChild(row);
    }
    detail.replaceChildren(ul);
    const addHere = document.createElement("div");
    addHere.className = "actions";
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "secondary";
    const mid = selectedId || idEl.value.trim();
    const already = mid && selectedMaterialPresetIds.has(presetId);
    addBtn.textContent = already ? "Geselecteerd materiaal staat al in deze preset" : "Geselecteerd materiaal hier toevoegen";
    addBtn.disabled = !mid || Boolean(already);
    addBtn.addEventListener("click", () => {
      void addSelectedToPreset(presetId).catch(
        (err) => setStatus(err instanceof Error ? err.message : String(err), "err")
      );
    });
    addHere.appendChild(addBtn);
    detail.appendChild(addHere);
  } catch (err) {
    detail.innerHTML = `<p class="hint">${esc(err instanceof Error ? err.message : "laden mislukt")}</p>`;
  }
}
async function loadPresets() {
  if (!presetListEl || !presetEmptyEl || !auth()?.token) return;
  try {
    const data = bppPhase1Enabled() ? await bppListMaterialFavoritePresets(invokeString, auth().token) : await httpJson("/api/floormap/material-favorite-presets");
    cachedPresets = data.presets || [];
    presetListEl.replaceChildren();
    presetEmptyEl.classList.toggle("hidden", cachedPresets.length > 0);
    fillPresetAddSelect();
    syncPresetAddUi();
    for (const p of cachedPresets) {
      const li = document.createElement("li");
      li.className = "mat-preset-item";
      li.dataset.presetId = p.preset_id;
      const head = document.createElement("div");
      head.className = "mat-preset-head";
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "mat-preset-toggle";
      toggle.setAttribute("aria-expanded", "false");
      toggle.title = "Toon materialen";
      toggle.innerHTML = `<span class="mat-preset-chevron" aria-hidden="true">\u25B8</span>`;
      toggle.addEventListener("click", () => {
        void expandPreset(p.preset_id);
      });
      const title = document.createElement("button");
      title.type = "button";
      title.className = "mat-preset-title";
      title.innerHTML = `${esc(p.name)} <span class="mat-preset-count-wrap">(<span class="mat-preset-count">${esc(String(p.material_count))}</span>)</span>`;
      title.addEventListener("click", () => {
        void expandPreset(p.preset_id);
      });
      const contains = document.createElement("span");
      contains.className = "mat-preset-contains mat-kind-badge mat-kind-single";
      contains.textContent = "bevat selectie";
      contains.title = "Het geselecteerde materiaal staat in deze preset";
      if (!selectedMaterialPresetIds.has(p.preset_id)) contains.classList.add("hidden");
      const actions = document.createElement("div");
      actions.className = "mat-preset-actions";
      const renameBtn = document.createElement("button");
      renameBtn.type = "button";
      renameBtn.className = "secondary";
      renameBtn.textContent = "Hernoemen";
      renameBtn.addEventListener("click", () => {
        const name = window.prompt("Nieuwe preset-naam:", p.name);
        if (!name?.trim() || name.trim() === p.name) return;
        void presetAction({ action: "rename", preset_id: p.preset_id, name: name.trim() }).then(() => loadPresets()).then(() => setStatus(`Preset hernoemd naar \xAB${name.trim()}\xBB`, "ok")).catch((err) => setStatus(err instanceof Error ? err.message : String(err), "err"));
      });
      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "secondary";
      addBtn.textContent = "+ Selectie";
      addBtn.title = "Geselecteerd materiaal aan deze preset toevoegen";
      addBtn.disabled = !(selectedId || idEl.value.trim()) || selectedMaterialPresetIds.has(p.preset_id);
      addBtn.addEventListener("click", () => {
        void addSelectedToPreset(p.preset_id).catch(
          (err) => setStatus(err instanceof Error ? err.message : String(err), "err")
        );
      });
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "danger secondary";
      delBtn.textContent = "Verwijderen";
      delBtn.addEventListener("click", () => {
        if (!window.confirm(`Preset \xAB${p.name}\xBB en alle koppelingen verwijderen?`)) return;
        void presetAction({ action: "delete", preset_id: p.preset_id }).then(() => {
          if (expandedPresetId === p.preset_id) expandedPresetId = null;
          return loadPresets();
        }).then(() => setStatus(`Preset \xAB${p.name}\xBB verwijderd`, "ok")).catch((err) => setStatus(err instanceof Error ? err.message : String(err), "err"));
      });
      actions.append(addBtn, renameBtn, delBtn);
      head.append(toggle, title, contains, actions);
      const detail = document.createElement("div");
      detail.className = "mat-preset-detail hidden";
      li.append(head, detail);
      presetListEl.appendChild(li);
    }
    if (expandedPresetId && cachedPresets.some((p) => p.preset_id === expandedPresetId)) {
      await expandPreset(expandedPresetId, true);
    } else {
      expandedPresetId = null;
    }
    await refreshPresetsForSelectedMaterial();
  } catch (err) {
    cachedPresets = [];
    presetListEl.replaceChildren();
    presetEmptyEl.classList.remove("hidden");
    presetEmptyEl.textContent = err instanceof Error ? `Presets laden mislukt: ${err.message}` : "Presets laden mislukt";
    fillPresetAddSelect();
    syncPresetAddUi();
  }
}
var connBarEl = document.getElementById("mat-conn-bar");
var connLedEl = document.getElementById("mat-conn-led");
var connStatusEl = document.getElementById("mat-conn-status");
var loginPanelEl = document.getElementById("mat-login-panel");
var loginForm = document.getElementById("mat-login-form");
var loginBtn = document.getElementById("mat-login-btn");
var totpForm = document.getElementById("mat-totp-form");
var totpBtn = document.getElementById("mat-totp-btn");
var totpCancelBtn = document.getElementById("mat-totp-cancel-btn");
var totpCodeEl = document.getElementById("mat-totp-code");
var totpHintEl = document.getElementById("mat-totp-hint");
var totpSetupEl = document.getElementById("mat-totp-setup");
var totpSecretEl = document.getElementById("mat-totp-secret");
var pendingMfa = null;
var panelEl = document.getElementById("mat-panel");
var userLabelEl = document.getElementById("mat-user-label");
var logoutBtn = document.getElementById("mat-logout-btn");
var filterForm = document.getElementById("mat-filter-form");
var qEl = document.getElementById("mat-q");
var categoryEl = document.getElementById("mat-category");
var subcategoryFilterEl = document.getElementById("mat-subcategory");
var exposureFilterEl = document.getElementById("mat-exposure-filter");
var exposureEl = document.getElementById("mat-exposure");
var pagerLabelEl = document.getElementById("mat-pager-label");
var prevBtn = document.getElementById("mat-prev-btn");
var nextBtn = document.getElementById("mat-next-btn");
var newBtn = document.getElementById("mat-new-btn");
var listboxEl = document.getElementById("mat-listbox");
var tbodyEl = document.getElementById("mat-tbody");
var editorTitleEl = document.getElementById("mat-editor-title");
var opbouwEl = document.getElementById("mat-opbouw");
var editorForm = document.getElementById("mat-editor-form");
var idEl = document.getElementById("mat-id");
var catalogIdEl = document.getElementById("mat-catalog-id");
var noEl = document.getElementById("mat-no");
var masterEl = document.getElementById("mat-master");
var nameEl = document.getElementById("mat-name");
var catEl = document.getElementById("mat-cat");
var sourceRefEl = document.getElementById("mat-source-ref");
var sourceEl = document.getElementById("mat-source");
var spectrumOkEl = document.getElementById("mat-spectrum-ok");
var favoriteWrapEl = document.getElementById("mat-fav-wrap");
var favoriteEl = document.getElementById("mat-favorite");
var presetListEl = document.getElementById("mat-preset-list");
var presetEmptyEl = document.getElementById("mat-preset-empty");
var presetAddSelectEl = document.getElementById("mat-preset-add-select");
var presetAddBtn = document.getElementById("mat-preset-add-btn");
var presetAddNewBtn = document.getElementById("mat-preset-add-new-btn");
var presetAddHintEl = document.getElementById("mat-preset-add-hint");
var presetCreateBtn = document.getElementById("mat-preset-create-btn");
var presetCreateNameEl = document.getElementById("mat-preset-create-name");
var presetRefreshBtn = document.getElementById("mat-preset-refresh-btn");
var presetFeedbackEl = document.getElementById("mat-preset-feedback");
var thickEl = document.getElementById("mat-thick");
var weightEl = document.getElementById("mat-weight");
var raEl = document.getElementById("mat-ra");
var glassFieldsEl = document.getElementById("mat-glass-fields");
var t1El = document.getElementById("mat-t1");
var cavEl = document.getElementById("mat-cav");
var t2El = document.getElementById("mat-t2");
var dntakEl = document.getElementById("mat-dntak");
var spectrumIntHintEl = document.getElementById("mat-spectrum-int-hint");
function isGlassRubriek(master) {
  const name = (master ?? masterEl.value).trim();
  if (!name) return false;
  if (name === "Glas") return true;
  const rub = rubriekByName(name);
  return rub?.nr === 2;
}
function syncGlassFieldsVisibility() {
  const show = isGlassRubriek();
  glassFieldsEl?.classList.toggle("hidden", !show);
  if (!show) {
    t1El.removeAttribute("required");
    cavEl.removeAttribute("required");
    t2El.removeAttribute("required");
  }
}
function editorIsInterior() {
  if (exposureEl?.value === "INTERIOR") return true;
  if (masterEl.value.trim() === "Interieur") return true;
  return false;
}
function syncInteriorSpectrumUi() {
  const interior = editorIsInterior();
  const filter = (exposureFilterEl?.value || "").trim();
  const spectrumEl = document.getElementById("mat-spectrum");
  spectrumEl?.classList.toggle("is-interior", interior);
  document.querySelectorAll("#mat-editor-panel .mat-col-int").forEach((el) => {
    el.classList.toggle("hidden", !interior);
  });
  document.querySelectorAll("#mat-editor-panel .mat-col-ext").forEach((el) => {
    el.classList.toggle("hidden", interior);
  });
  document.querySelectorAll("#mat-table .mat-col-int").forEach((el) => {
    el.classList.toggle("hidden", filter === "EXTERIOR");
  });
  document.querySelectorAll("#mat-table .mat-col-ext").forEach((el) => {
    el.classList.toggle("hidden", filter === "INTERIOR");
  });
  spectrumIntHintEl?.classList.toggle("hidden", !interior);
}
var r63El = document.getElementById("mat-r63");
var r125El = document.getElementById("mat-r125");
var r250El = document.getElementById("mat-r250");
var r500El = document.getElementById("mat-r500");
var r1000El = document.getElementById("mat-r1000");
var r2000El = document.getElementById("mat-r2000");
var r4000El = document.getElementById("mat-r4000");
var rwEl = document.getElementById("mat-rw");
var cEl = document.getElementById("mat-c");
var ctrEl = document.getElementById("mat-ctr");
var saveBtn = document.getElementById("mat-save-btn");
var deleteBtn = document.getElementById("mat-delete-btn");
var clearBtn = document.getElementById("mat-clear-btn");
var offset = 0;
var total = 0;
var selectedId = null;
var listRows = [];
var PAGE_SIZE = 10;
function setStatus(text, kind = "busy") {
  connStatusEl.textContent = text;
  connBarEl.classList.remove("ok", "err", "busy", "status");
  connBarEl.classList.add("status", kind);
}
function setConnLed(connected) {
  connLedEl.classList.toggle("connected", connected);
  connLedEl.classList.toggle("disconnected", !connected);
}
function resetMatMfaUi() {
  pendingMfa = null;
  totpForm.classList.add("hidden");
  totpSetupEl.classList.add("hidden");
  loginForm.classList.remove("hidden");
  totpCodeEl.value = "";
  totpSecretEl.textContent = "\u2014";
}
function showLogin() {
  resetMatMfaUi();
  loginPanelEl.classList.remove("hidden");
  panelEl.classList.add("hidden");
}
function beginMatMfa(challenge) {
  pendingMfa = challenge;
  loginForm.classList.add("hidden");
  totpForm.classList.remove("hidden");
  totpCodeEl.value = "";
  if (challenge.needs_totp_setup) {
    totpSetupEl.classList.remove("hidden");
    totpSecretEl.textContent = challenge.totp_secret || "\u2014";
    totpHintEl.innerHTML = "Koppel <strong>Microsoft Authenticator</strong> (handmatige sleutel hieronder) en bevestig met de code.";
  } else {
    totpSetupEl.classList.add("hidden");
    totpHintEl.innerHTML = "Open <strong>Microsoft Authenticator</strong> en vul de 6-cijferige code in.";
  }
  totpCodeEl.focus();
}
function showAdmin(info) {
  loginPanelEl.classList.add("hidden");
  panelEl.classList.remove("hidden");
  userLabelEl.textContent = `Ingelogd als ${info.display_name || info.username}`;
  if (favoriteWrapEl) favoriteWrapEl.classList.toggle("hidden", !contextBuildingId);
  if (!studioPanel) {
    studioPanel = initMaterialsStudioPanel({ getToken: () => session.auth?.token });
  }
  setTab(activeTab, { replaceUrl: false });
  void loadPresets();
}
var session = new BppSession({
  wsUrl: resolveBppWsUrl(),
  authKey: AUTH_KEY,
  clientName: "app-gevelwering-materials-web",
  callbacks: {
    onStatus: setStatus,
    onConnLed: setConnLed,
    onLogin: (info) => showAdmin(info),
    onLogout: () => showLogin(),
    onReady: async () => {
      if (session.auth) {
        if (activeTab === "studio") return;
        if (deepMaterialId || deepNew) await applyDeepLink();
        else await loadList();
      }
    }
  }
});
function invokeString(target, args) {
  return session.invokeString(target, args);
}
function auth() {
  return session.auth;
}
function normalizeDecimalInput(raw) {
  let s = raw.trim().replace(/\s/g, "");
  if (!s) return "";
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  if (!/^-?\d+(\.\d+)?$/.test(s)) {
    throw new Error(`Ongeldig getal: \u201C${raw.trim()}\u201D (gebruik bijv. 42,6 of 42.6)`);
  }
  return s;
}
function decimalField(el, label) {
  try {
    return normalizeDecimalInput(el.value);
  } catch (err) {
    throw new Error(`${label}: ${err instanceof Error ? err.message : String(err)}`);
  }
}
function fillFilterRubrieken() {
  const keep = categoryEl.value;
  categoryEl.replaceChildren();
  const all = document.createElement("option");
  all.value = "";
  all.textContent = "Alle rubrieken";
  categoryEl.appendChild(all);
  for (const r of MATERIAL_RUBRIEKEN) {
    const opt = document.createElement("option");
    opt.value = r.name;
    opt.textContent = formatRubriekLabel(r);
    categoryEl.appendChild(opt);
  }
  if (keep && [...categoryEl.options].some((o) => o.value === keep)) {
    categoryEl.value = keep;
  }
  fillFilterSubrubrieken();
}
function fillFilterSubrubrieken() {
  const master = categoryEl.value;
  const rub = rubriekByName(master);
  const keep = subcategoryFilterEl.value;
  subcategoryFilterEl.replaceChildren();
  const all = document.createElement("option");
  all.value = "";
  all.textContent = "0 - Alle subrubrieken";
  subcategoryFilterEl.appendChild(all);
  const subs = rub ? subrubriekenFor(rub.nr) : [];
  for (const s of subs) {
    const opt = document.createElement("option");
    opt.value = s.name;
    opt.textContent = formatSubrubriekLabel(s);
    subcategoryFilterEl.appendChild(opt);
  }
  subcategoryFilterEl.disabled = !rub;
  if (keep && subs.some((s) => s.name === keep)) subcategoryFilterEl.value = keep;
  else subcategoryFilterEl.value = "";
}
function fillEditorRubrieken() {
  const keep = masterEl.value;
  masterEl.replaceChildren();
  for (const r of MATERIAL_RUBRIEKEN) {
    const opt = document.createElement("option");
    opt.value = r.name;
    opt.textContent = formatRubriekLabel(r);
    masterEl.appendChild(opt);
  }
  if (keep && [...masterEl.options].some((o) => o.value === keep)) masterEl.value = keep;
  else masterEl.value = MATERIAL_RUBRIEKEN[0]?.name || "";
  fillEditorSubrubrieken();
}
function fillEditorSubrubrieken() {
  const rub = rubriekByName(masterEl.value);
  const keep = catEl.value;
  catEl.replaceChildren();
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "\u2014 kies subrubriek \u2014";
  catEl.appendChild(empty);
  const subs = rub ? subrubriekenFor(rub.nr) : [];
  for (const s of subs) {
    const opt = document.createElement("option");
    opt.value = s.name;
    opt.textContent = formatSubrubriekLabel(s);
    catEl.appendChild(opt);
  }
  if (keep && subs.some((s) => s.name === keep)) catEl.value = keep;
  else catEl.value = "";
}
function listCategoryFilter() {
  const master = categoryEl.value.trim();
  if (!master) return "";
  const sub = subcategoryFilterEl.value.trim();
  return sub ? `${master}::${sub}` : master;
}
function syncListFilterToEditorTaxonomy() {
  const master = masterEl.value.trim();
  const sub = catEl.value.trim();
  if (master && [...categoryEl.options].some((o) => o.value === master)) {
    categoryEl.value = master;
  }
  fillFilterSubrubrieken();
  if (sub && [...subcategoryFilterEl.options].some((o) => o.value === sub)) {
    subcategoryFilterEl.value = sub;
  } else {
    subcategoryFilterEl.value = "";
  }
}
async function focusSavedMaterial(materialId, hint) {
  offset = 0;
  syncListFilterToEditorTaxonomy();
  const qHint = (hint.catalog_id || hint.name || "").trim();
  if (qHint) qEl.value = qHint;
  await loadList(materialId);
  if (!listRows.some((m) => m.material_id === materialId)) {
    const ret = await invokeString("API_AdminGetMaterial", [auth().token, materialId]);
    if (!ret.startsWith("ERROR")) {
      fillEditor(JSON.parse(ret));
    }
  }
  const label = (catalogIdEl.value || hint.catalog_id || hint.name || materialId).trim();
  setStatus(
    hint.created ? `Materiaal aangemaakt \xB7 ${label}` : `Materiaal bijgewerkt \xB7 ${label}`,
    "ok"
  );
  highlightSelection();
}
function ensureSourceOption(value) {
  const v = (value || "app").trim() || "app";
  const normalized = v === "eigen" ? "app" : v;
  if (sourceEl instanceof HTMLSelectElement) {
    if (![...sourceEl.options].some((o) => o.value === normalized)) {
      const opt = document.createElement("option");
      opt.value = normalized;
      opt.textContent = normalized;
      sourceEl.appendChild(opt);
    }
    sourceEl.value = normalized;
  } else {
    sourceEl.value = normalized;
  }
}
function resolveSaveSource() {
  const cid = catalogIdEl.value.trim().toUpperCase();
  const isNew = !idEl.value.trim();
  let src = (sourceEl.value || "").trim() || "app";
  if (src === "eigen") src = "app";
  if (isNew) src = "app";
  if ((src === "catalogusGG.pdf" || src === "GL.cat") && cid && !cid.startsWith("D")) {
    src = "app";
  }
  ensureSourceOption(src);
  return src;
}
function setIdentityFieldsForMode(mode) {
  const creating = mode === "create";
  catalogIdEl.readOnly = creating;
  noEl.readOnly = creating;
  catalogIdEl.classList.toggle("mat-field-readonly", creating);
  noEl.classList.toggle("mat-field-readonly", creating);
  if (creating) {
    catalogIdEl.value = "";
    noEl.value = "";
    catalogIdEl.placeholder = "wordt toegewezen";
    noEl.placeholder = "auto";
  } else {
    catalogIdEl.placeholder = "";
    noEl.placeholder = "";
  }
  if (sourceEl instanceof HTMLSelectElement) {
    sourceEl.disabled = creating;
  }
}
function applyFilterTaxonomyToEditor() {
  const filterRubriek = categoryEl.value.trim();
  const filterSub = subcategoryFilterEl.value.trim();
  if (filterRubriek && [...masterEl.options].some((o) => o.value === filterRubriek)) {
    masterEl.value = filterRubriek;
  } else if (![...masterEl.options].some((o) => o.value === masterEl.value)) {
    masterEl.value = MATERIAL_RUBRIEKEN[0]?.name || "";
  }
  fillEditorSubrubrieken();
  if (filterSub && [...catEl.options].some((o) => o.value === filterSub)) {
    catEl.value = filterSub;
  }
}
function clearEditor() {
  selectedId = null;
  highlightSelection();
  idEl.value = "";
  setIdentityFieldsForMode("create");
  nameEl.value = "";
  sourceRefEl.value = "";
  ensureSourceOption("app");
  if (exposureEl) {
    const fromFilter = (exposureFilterEl?.value || "").trim();
    exposureEl.value = fromFilter === "INTERIOR" ? "INTERIOR" : "EXTERIOR";
  }
  spectrumOkEl.checked = true;
  thickEl.value = "";
  weightEl.value = "";
  raEl.value = "";
  t1El.value = "";
  cavEl.value = "";
  t2El.value = "";
  r63El.value = "";
  r125El.value = "";
  r250El.value = "";
  r500El.value = "";
  r1000El.value = "";
  r2000El.value = "";
  r4000El.value = "";
  rwEl.value = "";
  cEl.value = "";
  ctrEl.value = "";
  if (dntakEl) dntakEl.value = "";
  applyFilterTaxonomyToEditor();
  syncGlassFieldsVisibility();
  syncInteriorSpectrumUi();
  editorTitleEl.textContent = "Nieuw materiaal";
  opbouwEl.classList.add("hidden");
  opbouwEl.innerHTML = "";
  deleteBtn.disabled = true;
  syncPickUi();
  if (favoriteEl) favoriteEl.checked = false;
  if (favoriteWrapEl) favoriteWrapEl.classList.toggle("hidden", !contextBuildingId);
  selectedMaterialPresetIds = /* @__PURE__ */ new Set();
  fillPresetAddSelect();
  syncPresetAddUi();
}
function fillEditor(m) {
  selectedId = m.material_id || null;
  idEl.value = m.material_id || "";
  setIdentityFieldsForMode(m.material_id ? "edit" : "create");
  catalogIdEl.value = m.catalog_id || "";
  noEl.value = m.material_no === "" || m.material_no == null ? "" : String(m.material_no);
  masterEl.value = m.master_category || MATERIAL_RUBRIEKEN[0]?.name || "";
  if (![...masterEl.options].some((o) => o.value === masterEl.value) && m.master_category) {
    const opt = document.createElement("option");
    opt.value = m.master_category;
    opt.textContent = m.master_category;
    masterEl.appendChild(opt);
    masterEl.value = m.master_category;
  }
  fillEditorSubrubrieken();
  nameEl.value = m.name || "";
  catEl.value = m.category || "";
  if (m.category && ![...catEl.options].some((o) => o.value === m.category)) {
    const opt = document.createElement("option");
    opt.value = m.category;
    opt.textContent = m.category;
    catEl.appendChild(opt);
    catEl.value = m.category;
  }
  sourceRefEl.value = m.source_ref || "";
  ensureSourceOption(m.source || "app");
  if (exposureEl) {
    exposureEl.value = m.exposure === "INTERIOR" ? "INTERIOR" : "EXTERIOR";
  }
  spectrumOkEl.checked = m.spectrum_ok === "true" || m.spectrum_ok === "t";
  thickEl.value = m.thickness_mm || "";
  weightEl.value = m.weight_kg_m2 || "";
  raEl.value = m.ra_dba || "";
  t1El.value = m.glass_t1_mm || "";
  cavEl.value = m.glass_cavity_mm || "";
  t2El.value = m.glass_t2_mm || "";
  syncGlassFieldsVisibility();
  r63El.value = m.r_63_hz || "";
  r125El.value = m.r_125_hz || "";
  r250El.value = m.r_250_hz || "";
  r500El.value = m.r_500_hz || "";
  r1000El.value = m.r_1000_hz || "";
  r2000El.value = m.r_2000_hz || "";
  r4000El.value = m.r_4000_hz || "";
  rwEl.value = m.rw_db || "";
  cEl.value = m.c_db || "";
  ctrEl.value = m.ctr_db || "";
  if (dntakEl) dntakEl.value = m.dnt_a_k_db || "";
  syncInteriorSpectrumUi();
  editorTitleEl.textContent = m.material_id ? `Bewerken \xB7 ${m.catalog_id || ""} \xB7 ${m.name}` : "Nieuw materiaal";
  if (m.material_id) {
    opbouwEl.classList.remove("hidden");
    opbouwEl.innerHTML = `Opbouw: ${materialKindBadgeHtml(m.material_kind, esc)} <span class="hint-inline">${esc(materialKindTitle(m.material_kind))}</span>`;
  } else {
    opbouwEl.classList.add("hidden");
    opbouwEl.innerHTML = "";
  }
  deleteBtn.disabled = !m.material_id;
  highlightSelection();
  syncPickUi();
  void syncFavoriteCheckbox();
  void refreshPresetsForSelectedMaterial();
}
function highlightSelection() {
  for (const tr of tbodyEl.querySelectorAll("tr[data-id]")) {
    const on = !!selectedId && tr.dataset.id === selectedId;
    tr.classList.toggle("selected", on);
    tr.setAttribute("aria-selected", on ? "true" : "false");
    if (on) tr.scrollIntoView({ block: "nearest" });
  }
}
function limit() {
  return PAGE_SIZE;
}
function updatePager() {
  const lim = limit();
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + lim, total);
  const q = qEl.value.trim();
  pagerLabelEl.textContent = total === 0 ? q ? `materiaal '${q}' niet gevonden.` : "Geen materialen gevonden." : `Weergave ${from}\u2013${to} van ${total}`;
  prevBtn.disabled = offset <= 0;
  nextBtn.disabled = offset + lim >= total;
}
function selectFromList(id, opts) {
  const row = listRows.find((m) => m.material_id === id);
  if (!row) return;
  fillEditor(row);
  setStatus(`Geselecteerd: ${row.name}`, "ok");
  const fieldId = opts?.focusFieldId;
  if (fieldId) {
    const el = document.getElementById(fieldId);
    if (el && "focus" in el) {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      window.requestAnimationFrame(() => {
        el.focus({ preventScroll: true });
        if (el instanceof HTMLInputElement && el.type !== "checkbox" && typeof el.select === "function") {
          el.select();
        }
      });
      return;
    }
  }
  listboxEl.focus({ preventScroll: true });
}
function moveSelection(delta) {
  if (listRows.length === 0) return;
  const idx = selectedId ? listRows.findIndex((m) => m.material_id === selectedId) : -1;
  let next = idx + delta;
  if (idx < 0) next = delta > 0 ? 0 : listRows.length - 1;
  if (next < 0) next = 0;
  if (next >= listRows.length) next = listRows.length - 1;
  const row = listRows[next];
  if (row) selectFromList(row.material_id);
}
async function loadList(preferId) {
  if (!auth()?.token) return;
  const lim = limit();
  const ret = await invokeString("API_AdminListMaterials", [
    auth().token,
    qEl.value.trim(),
    listCategoryFilter(),
    String(lim),
    String(offset),
    "",
    (exposureFilterEl?.value || "").trim()
  ]);
  if (ret.startsWith("ERROR")) {
    setStatus(ret, "err");
    if (ret.includes("login") || ret.includes("admin")) showLogin();
    return;
  }
  const parsed = JSON.parse(ret);
  total = Number(parsed.total) || 0;
  listRows = parsed.materials ?? [];
  tbodyEl.innerHTML = listRows.map(
    (m) => `
      <tr data-id="${esc(m.material_id)}" role="option" tabindex="-1" title="Dubbelklik om te bewerken">
        <td data-field="mat-catalog-id">${esc(m.catalog_id || "")}</td>
        <td data-field="mat-master">${esc(m.master_category || "")}</td>
        <td data-field="mat-cat">${esc(m.category || "")}</td>
        <td class="mat-name-cell" data-field="mat-name">${esc(m.name)}</td>
        <td class="mat-kind-cell">${materialKindBadgeHtml(m.material_kind, esc)}</td>
        <td class="mat-exposure-cell" data-field="mat-exposure">${esc(m.exposure === "INTERIOR" ? "Interieur" : "Exterieur")}</td>
        <td data-field="mat-thick">${esc(m.thickness_mm || "")}</td>
        <td data-field="mat-weight">${esc(m.weight_kg_m2 || "")}</td>
        <td class="mat-col-ext" data-field="mat-ra">${esc(m.exposure === "INTERIOR" ? "" : m.ra_dba || "")}</td>
        <td data-field="mat-r63">${esc(m.r_63_hz || "")}</td>
        <td data-field="mat-r125">${esc(m.r_125_hz || "")}</td>
        <td data-field="mat-r250">${esc(m.r_250_hz || "")}</td>
        <td data-field="mat-r500">${esc(m.r_500_hz || "")}</td>
        <td data-field="mat-r1000">${esc(m.r_1000_hz || "")}</td>
        <td data-field="mat-r2000">${esc(m.r_2000_hz || "")}</td>
        <td data-field="mat-r4000">${esc(m.r_4000_hz || "")}</td>
        <td data-field="mat-rw">${esc(m.rw_db || "")}</td>
        <td class="mat-col-ext" data-field="mat-c">${esc(m.exposure === "INTERIOR" ? "" : m.c_db || "")}</td>
        <td class="mat-col-ext" data-field="mat-ctr">${esc(m.exposure === "INTERIOR" ? "" : m.ctr_db || "")}</td>
        <td class="mat-col-int" data-field="mat-dntak">${esc(m.exposure === "INTERIOR" ? m.dnt_a_k_db || "" : "")}</td>
      </tr>`
  ).join("");
  syncInteriorSpectrumUi();
  updatePager();
  const want = preferId ?? selectedId;
  const preferred = want ? listRows.find((m) => m.material_id === want) : null;
  if (preferred) {
    fillEditor(preferred);
    setStatus(`Geladen ${listRows.length} \xB7 ${preferred.name}`, "ok");
    return;
  }
  if (preferId) {
    highlightSelection();
    const q = qEl.value.trim();
    if (total === 0 && q) setStatus(`materiaal '${q}' niet gevonden.`, "err");
    else setStatus(`${listRows.length} materialen geladen`, "ok");
    return;
  }
  const pick = listRows[0] || null;
  if (pick) {
    fillEditor(pick);
    setStatus(`Geladen ${listRows.length} \xB7 ${pick.name}`, "ok");
  } else {
    clearEditor();
    const q = qEl.value.trim();
    if (total === 0 && q) {
      setStatus(`materiaal '${q}' niet gevonden.`, "err");
    } else if (total === 0) {
      setStatus("Geen materialen gevonden", "ok");
    } else {
      setStatus(`${listRows.length} materialen geladen`, "ok");
    }
  }
}
async function applyDeepLink() {
  if (!auth()?.token) return;
  if (deepNew && !deepMaterialId) {
    await loadList();
    clearEditor();
    editorForm.scrollIntoView({ block: "nearest", behavior: "smooth" });
    nameEl.focus({ preventScroll: true });
    setStatus(
      "Nieuw materiaal \u2014 catalogus-id/nr automatisch; rubriek/subrubriek overgenomen uit filter waar mogelijk",
      "ok"
    );
    return;
  }
  if (!deepMaterialId) return;
  if (deepQ && !qEl.value.trim()) qEl.value = deepQ;
  setStatus("Materiaal laden\u2026", "busy");
  const ret = await invokeString("API_AdminGetMaterial", [auth().token, deepMaterialId]);
  if (ret.startsWith("ERROR")) {
    const label = (deepQ || deepMaterialId).trim();
    setStatus(
      ret.includes("not found") || ret.includes("niet gevonden") ? `materiaal '${label}' niet gevonden.` : ret,
      "err"
    );
    await loadList();
    return;
  }
  const m = JSON.parse(ret);
  if (m.catalog_id && !qEl.value.trim()) qEl.value = m.catalog_id;
  offset = 0;
  await loadList(m.material_id);
  if (!listRows.some((r) => r.material_id === m.material_id)) {
    fillEditor(m);
  }
  editorForm.scrollIntoView({ block: "nearest", behavior: "smooth" });
  nameEl.focus({ preventScroll: true });
  setStatus(`Geopend: ${m.catalog_id || ""} \xB7 ${m.name}`, "ok");
}
loginForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  loginBtn.disabled = true;
  setStatus("Inloggen\u2026", "busy");
  try {
    const info = await session.bootstrapAndLogin(
      String(new FormData(loginForm).get("username") ?? "").trim(),
      String(new FormData(loginForm).get("password") ?? "")
    );
    if (info.username !== "admin") {
      setStatus("Materiaaleditor is alleen voor gebruiker 'admin'", "err");
      return;
    }
    offset = 0;
    if (activeTab !== "studio") {
      if (deepMaterialId || deepNew) await applyDeepLink();
      else await loadList();
    }
    setStatus("Beheerder ingelogd", "ok");
  } catch (err) {
    if (err instanceof MfaChallengeError) {
      beginMatMfa(err.challenge);
      setStatus(err.message, "ok");
    } else {
      setStatus(err instanceof Error ? err.message : String(err), "err");
    }
  } finally {
    loginBtn.disabled = false;
  }
});
totpForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const code = totpCodeEl.value.trim();
  if (!pendingMfa?.challenge || !/^\d{6}$/.test(code)) {
    setStatus("Vul een geldige 6-cijferige code in", "err");
    return;
  }
  totpBtn.disabled = true;
  try {
    const info = await session.verifyTotp(pendingMfa.challenge, code);
    if (info.username !== "admin") {
      setStatus("Materiaaleditor is alleen voor gebruiker 'admin'", "err");
      return;
    }
    resetMatMfaUi();
    offset = 0;
    if (activeTab !== "studio") {
      if (deepMaterialId || deepNew) await applyDeepLink();
      else await loadList();
    }
    setStatus("Beheerder ingelogd (2FA)", "ok");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  } finally {
    totpBtn.disabled = false;
  }
});
totpCancelBtn.addEventListener("click", () => {
  resetMatMfaUi();
  setStatus("Authenticator-stap geannuleerd", "ok");
});
logoutBtn.addEventListener("click", async () => {
  try {
    if (session.auth?.token) await invokeString("API_Logout", [session.auth.token]);
  } catch {
  }
  session.logout();
  setStatus("Uitgelogd", "ok");
});
filterForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  offset = 0;
  try {
    await loadList();
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  }
});
categoryEl.addEventListener("change", () => {
  fillFilterSubrubrieken();
});
masterEl.addEventListener("change", () => {
  fillEditorSubrubrieken();
  if (exposureEl && masterEl.value === "Interieur") exposureEl.value = "INTERIOR";
  syncGlassFieldsVisibility();
  syncInteriorSpectrumUi();
});
exposureEl?.addEventListener("change", () => syncInteriorSpectrumUi());
exposureFilterEl?.addEventListener("change", () => {
  syncInteriorSpectrumUi();
});
prevBtn.addEventListener("click", async () => {
  offset = Math.max(0, offset - limit());
  selectedId = null;
  await loadList();
});
nextBtn.addEventListener("click", async () => {
  offset = offset + limit();
  selectedId = null;
  await loadList();
});
newBtn.addEventListener("click", () => {
  clearEditor();
  nameEl.focus();
  const rub = masterEl.value.trim();
  const sub = catEl.value.trim();
  const bits = [rub && `rubriek ${rub}`, sub && `subrubriek ${sub}`].filter(Boolean);
  setStatus(
    bits.length ? `Nieuw materiaal \u2014 ${bits.join(", ")} overgenomen uit zoekfilter` : "Nieuw materiaal \u2014 catalogus-id en nr worden automatisch toegewezen",
    "ok"
  );
});
clearBtn.addEventListener("click", () => clearEditor());
favoriteEl?.addEventListener("change", () => {
  if (!favoriteEl) return;
  if (!contextBuildingId) {
    favoriteEl.checked = false;
    setStatus(
      "Geen projectcontext \u2014 open de catalogus via \xABMateriaalcatalogus\u2026\xBB op de geveltekening",
      "err"
    );
    return;
  }
  if (!selectedId && !idEl.value.trim()) {
    favoriteEl.checked = false;
    setStatus("Sla het materiaal eerst op voordat je favoriet zet", "err");
    return;
  }
  const label = (nameEl.value || catalogIdEl?.value || "materiaal").trim();
  void setFavoriteForSelection(favoriteEl.checked).then(
    () => setStatus(
      favoriteEl.checked ? `Toegevoegd aan meest gebruikt: ${label}` : `Verwijderd uit meest gebruikt: ${label}`,
      "ok"
    )
  ).catch((err) => {
    favoriteEl.checked = !favoriteEl.checked;
    setStatus(err instanceof Error ? err.message : String(err), "err");
  });
});
presetAddSelectEl?.addEventListener("change", () => syncPresetAddUi());
presetAddBtn?.addEventListener("click", () => {
  const pid = presetAddSelectEl?.value;
  if (!pid) return;
  void addSelectedToPreset(pid).catch(
    (err) => setStatus(err instanceof Error ? err.message : String(err), "err")
  );
});
function promptNewPreset(withSelected) {
  const fromInput = presetCreateNameEl?.value.trim() || "";
  const name = fromInput || window.prompt("Naam voor de nieuwe favorieten-preset:")?.trim() || "";
  if (!name) {
    setPresetFeedback("Vul eerst een preset-naam in.", "err");
    presetCreateNameEl?.focus();
    return;
  }
  if (presetCreateBtn) presetCreateBtn.disabled = true;
  void createPreset(name, withSelected).then(() => {
    if (presetCreateNameEl) presetCreateNameEl.value = "";
    const msg = withSelected ? `Preset \xAB${name}\xBB aangemaakt (geselecteerd materiaal toegevoegd).` : `Preset \xAB${name}\xBB aangemaakt.`;
    setPresetFeedback(msg, "ok");
    setStatus(msg, "ok");
  }).catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    setPresetFeedback(msg, "err");
    setStatus(msg, "err");
  }).finally(() => {
    if (presetCreateBtn) presetCreateBtn.disabled = false;
  });
}
presetAddNewBtn?.addEventListener("click", () => {
  document.getElementById("mat-presets-panel")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  if (presetCreateNameEl) {
    presetCreateNameEl.focus();
    if (!presetCreateNameEl.value.trim()) {
      setPresetFeedback("Typ een naam en druk Enter of klik Aanmaken (geselecteerd materiaal wordt meegenomen).", "busy");
      return;
    }
  }
  promptNewPreset(true);
});
presetCreateBtn?.addEventListener(
  "click",
  () => promptNewPreset(Boolean(selectedId || idEl.value.trim()))
);
presetCreateNameEl?.addEventListener("keydown", (ev) => {
  if (ev.key === "Enter") {
    ev.preventDefault();
    promptNewPreset(Boolean(selectedId || idEl.value.trim()));
  }
});
presetRefreshBtn?.addEventListener("click", () => {
  void loadPresets().then(() => refreshPresetsForSelectedMaterial()).then(() => {
    setPresetFeedback("Presets vernieuwd", "ok");
    setStatus("Presets vernieuwd", "ok");
  }).catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    setPresetFeedback(msg, "err");
    setStatus(msg, "err");
  });
});
pickBtnEl?.addEventListener("click", () => pickMaterialForCaller());
pickBtnEditorEl?.addEventListener("click", () => pickMaterialForCaller());
tbodyEl.addEventListener("click", (ev) => {
  const tr = ev.target.closest("tr[data-id]");
  if (!tr) return;
  selectFromList(tr.getAttribute("data-id") || "");
});
tbodyEl.addEventListener("dblclick", (ev) => {
  const td = ev.target.closest("td[data-field]");
  const tr = ev.target.closest("tr[data-id]");
  if (!tr) return;
  ev.preventDefault();
  const fieldId = td?.getAttribute("data-field") || "mat-name";
  selectFromList(tr.getAttribute("data-id") || "", { focusFieldId: fieldId });
});
listboxEl.addEventListener("keydown", (ev) => {
  if (ev.key === "ArrowDown") {
    ev.preventDefault();
    moveSelection(1);
    return;
  }
  if (ev.key === "ArrowUp") {
    ev.preventDefault();
    moveSelection(-1);
    return;
  }
  if (ev.key === "Home") {
    ev.preventDefault();
    if (listRows[0]) selectFromList(listRows[0].material_id);
    return;
  }
  if (ev.key === "End") {
    ev.preventDefault();
    const last = listRows[listRows.length - 1];
    if (last) selectFromList(last.material_id);
    return;
  }
  if (ev.key === "Enter" || ev.key === " ") {
    ev.preventDefault();
    if (selectedId) selectFromList(selectedId);
    else if (listRows[0]) selectFromList(listRows[0].material_id);
  }
});
editorForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if (!auth()?.token) return;
  const isNew = !idEl.value.trim();
  const cid = catalogIdEl.value.trim();
  if (!isNew && !cid) {
    setStatus("Catalogus-id is verplicht bij bewerken", "err");
    catalogIdEl.focus();
    return;
  }
  saveBtn.disabled = true;
  setStatus("Materiaal opslaan\u2026", "busy");
  const savedName = nameEl.value.trim();
  const hasSpectrum = [r63El, r125El, r250El, r500El, r1000El, r2000El].some((el) => el.value.trim());
  if (isNew && !hasSpectrum) {
    spectrumOkEl.checked = false;
  }
  try {
    const ret = await invokeString("API_AdminSaveMaterial", [
      auth().token,
      idEl.value.trim(),
      isNew ? "" : catalogIdEl.value.trim(),
      masterEl.value.trim(),
      isNew ? "" : noEl.value.trim(),
      savedName,
      catEl.value.trim(),
      decimalField(thickEl, "Dikte"),
      decimalField(weightEl, "Gewicht"),
      decimalField(raEl, "RA"),
      sourceRefEl.value.trim(),
      spectrumOkEl.checked ? "true" : "false",
      decimalField(r63El, "63 Hz"),
      decimalField(r125El, "125 Hz"),
      decimalField(r250El, "250 Hz"),
      decimalField(r500El, "500 Hz"),
      decimalField(r1000El, "1000 Hz"),
      decimalField(r2000El, "2000 Hz"),
      decimalField(r4000El, "4000 Hz"),
      decimalField(rwEl, "Rw"),
      decimalField(cEl, "C"),
      decimalField(ctrEl, "Ctr"),
      decimalField(t1El, "Glas t1"),
      decimalField(cavEl, "Spouw"),
      decimalField(t2El, "Glas t2"),
      resolveSaveSource(),
      masterEl.value.trim() === "Interieur" || exposureEl?.value === "INTERIOR" ? "INTERIOR" : "EXTERIOR",
      dntakEl ? decimalField(dntakEl, "Praktijkwaarde") : ""
    ]);
    if (ret.startsWith("ERROR")) {
      setStatus(ret, "err");
      return;
    }
    const saved = JSON.parse(ret);
    const wantFav = Boolean(favoriteEl?.checked && contextBuildingId);
    await focusSavedMaterial(saved.material_id, {
      catalog_id: saved.catalog_id,
      name: savedName,
      created: saved.created
    });
    if (wantFav && saved.material_id) {
      try {
        if (bppPhase1Enabled()) {
          await bppAddMaterialFavorite(
            invokeString,
            auth().token,
            contextBuildingId,
            saved.material_id
          );
        } else {
          await httpJson("/api/floormap/material-favorites", {
            method: "POST",
            body: JSON.stringify({
              building_id: contextBuildingId,
              material_id: saved.material_id
            })
          });
        }
        if (favoriteEl) favoriteEl.checked = true;
      } catch (favErr) {
        setStatus(
          `Opgeslagen, maar favoriet mislukt: ${favErr instanceof Error ? favErr.message : String(favErr)}`,
          "err"
        );
      }
    }
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  } finally {
    saveBtn.disabled = false;
  }
});
deleteBtn.addEventListener("click", async () => {
  if (!auth()?.token || !idEl.value) return;
  if (!window.confirm(`Materiaal \u201C${nameEl.value || idEl.value}\u201D verwijderen?`)) return;
  deleteBtn.disabled = true;
  setStatus("Verwijderen\u2026", "busy");
  try {
    const ret = await invokeString("API_AdminDeleteMaterial", [auth().token, idEl.value]);
    if (ret.startsWith("ERROR")) {
      setStatus(ret, "err");
      return;
    }
    selectedId = null;
    await loadList();
    setStatus("Materiaal verwijderd", "ok");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  } finally {
    deleteBtn.disabled = !idEl.value;
  }
});
fillFilterRubrieken();
fillEditorRubrieken();
syncGlassFieldsVisibility();
syncInteriorSpectrumUi();
setupReturnNav();
syncPickUi();
if (deepQ) qEl.value = deepQ;
{
  const exp = deepExposure === "INTERIEUR" || deepExposure === "INTERIOR" ? "INTERIOR" : deepExposure === "EXTERIEUR" || deepExposure === "EXTERIOR" ? "EXTERIOR" : deepExposure === "ALL" || deepExposure === "ALLE" ? "" : deepExposure;
  if (exposureFilterEl && (exp === "" || exp === "INTERIOR" || exp === "EXTERIOR")) {
    exposureFilterEl.value = exp;
  }
  if (deepRubriek) {
    const rub = rubriekByName(deepRubriek) || MATERIAL_RUBRIEKEN.find((r) => String(r.nr) === deepRubriek) || null;
    if (rub && [...categoryEl.options].some((o) => o.value === rub.name)) {
      categoryEl.value = rub.name;
      fillFilterSubrubrieken();
      if (deepSubrubriek) {
        const sub = subrubriekenFor(rub.nr).find(
          (s) => s.name === deepSubrubriek || String(s.nr) === deepSubrubriek
        ) || null;
        if (sub && [...subcategoryFilterEl.options].some((o) => o.value === sub.name)) {
          subcategoryFilterEl.value = sub.name;
        }
      }
    }
  }
  if (masterEl && categoryEl.value) {
    const fromFilter = categoryEl.value;
    if ([...masterEl.options].some((o) => o.value === fromFilter)) {
      masterEl.value = fromFilter;
      fillEditorSubrubrieken();
      if (subcategoryFilterEl.value && [...catEl.options].some((o) => o.value === subcategoryFilterEl.value)) {
        catEl.value = subcategoryFilterEl.value;
      }
    }
  }
  if (exposureEl && exposureFilterEl?.value === "INTERIOR") {
    exposureEl.value = "INTERIOR";
  }
}
tabCatalogBtn.addEventListener("click", () => setTab("catalog"));
tabStudioBtn.addEventListener("click", () => setTab("studio"));
initPasswordToggles();
session.connect({ reconnectMs: 1500 });
