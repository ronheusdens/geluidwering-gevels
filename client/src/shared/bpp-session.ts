/**
 * Shared BPP WebSocket session — replaces identical send/onMessage/invokeString/
 * loadSharedApi/bootstrapAndLogin boilerplate across 6 entry points.
 *
 * Thin wrapper: callers still own `ws`, DOM elements, and page-specific callbacks.
 */
import { loadAuth, storeAuth as persistAuth, syncSessionCookie } from "../auth-store";

export type Envelope = {
  v: number;
  type: string;
  request_id: string;
  session_id?: string;
  payload?: Record<string, unknown>;
};

export type AuthInfo = {
  token: string;
  username: string;
  display_name: string;
};

/** Two-pass (TOTP) challenge for account admin. */
export type MfaChallenge = {
  needs_totp?: boolean;
  needs_totp_setup?: boolean;
  challenge: string;
  username?: string;
  totp_secret?: string;
  otpauth_uri?: string;
  authenticator_app?: string;
  authenticator_hint?: string;
};

export class MfaChallengeError extends Error {
  readonly challenge: MfaChallenge;
  constructor(challenge: MfaChallenge) {
    super(
      challenge.needs_totp_setup
        ? "Authenticator koppelen vereist (Microsoft Authenticator)"
        : "Authenticator-code vereist",
    );
    this.name = "MfaChallengeError";
    this.challenge = challenge;
  }
}

type Waiter = {
  resolve: (env: Envelope) => void;
  reject: (err: Error) => void;
  want: string;
};

export type StatusKind = "busy" | "ok" | "err";

export interface BppSessionCallbacks {
  onStatus: (text: string, kind: StatusKind) => void;
  onConnLed: (connected: boolean) => void;
  onLogin: (info: AuthInfo) => void;
  onLogout: () => void;
  /** Called after WS open + session + shared API loaded + optional session restore. */
  onReady?: () => void | Promise<void>;
}

export class BppSession {
  ws: WebSocket | null = null;
  sessionId: string | null = null;
  auth: AuthInfo | null = null;

  private reqCounter = 0;
  private pending = new Map<string, Waiter>();
  private readonly wsUrl: string;
  private readonly authKey: string;
  private readonly clientName: string;
  private readonly cb: BppSessionCallbacks;
  /** Bumps on each connect() so stale open/close handlers are ignored. */
  private connectGen = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  /** Resolvers waiting for WebSocket OPEN (login while still connecting). */
  private openWaiters: Array<{
    resolve: () => void;
    reject: (err: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }> = [];

  constructor(opts: {
    wsUrl: string;
    authKey: string;
    clientName: string;
    callbacks: BppSessionCallbacks;
  }) {
    this.wsUrl = opts.wsUrl;
    this.authKey = opts.authKey;
    this.clientName = opts.clientName;
    this.cb = opts.callbacks;
  }

  nextRequestId(prefix: string): string {
    this.reqCounter += 1;
    return `${prefix}_${this.reqCounter}_${Date.now()}`;
  }

  private rejectAllPending(err: Error): void {
    for (const [id, waiter] of this.pending) {
      this.pending.delete(id);
      waiter.reject(err);
    }
  }

  private rejectOpenWaiters(err: Error): void {
    const waiters = this.openWaiters.splice(0);
    for (const w of waiters) {
      clearTimeout(w.timer);
      w.reject(err);
    }
  }

  private resolveOpenWaiters(): void {
    const waiters = this.openWaiters.splice(0);
    for (const w of waiters) {
      clearTimeout(w.timer);
      w.resolve();
    }
  }

  /** Wait until WS is OPEN (or fail). Used when user acts while still connecting. */
  async whenOpen(timeoutMs = 12_000): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING) {
      throw new Error(`WebSocket niet verbonden (${this.wsUrl}). Herlaad of start ./start.sh.`);
    }
    // CONNECTING
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.openWaiters.findIndex((w) => w.timer === timer);
        if (idx >= 0) this.openWaiters.splice(idx, 1);
        reject(new Error(`WebSocket timeout — geen verbinding met ${this.wsUrl}`));
      }, timeoutMs);
      this.openWaiters.push({ resolve, reject, timer });
    });
  }

  async send(type: string, payload: Record<string, unknown>, wantType: string): Promise<Envelope> {
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
    const env: Envelope = { v: 1, type, request_id, payload };
    if (this.sessionId && type !== "session.open") env.session_id = this.sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(request_id, { resolve, reject, want: wantType });
      this.ws!.send(JSON.stringify(env));
    });
  }

  onMessage(raw: string): void {
    let env: Envelope;
    try {
      env = JSON.parse(raw) as Envelope;
    } catch {
      return;
    }
    if (env.type === "session.opened") {
      const sid =
        (typeof env.session_id === "string" && env.session_id) ||
        (typeof env.payload?.session_id === "string" ? env.payload.session_id : null);
      if (sid) this.sessionId = sid;
    }
    if (env.type === "error") {
      const waiter = this.pending.get(env.request_id);
      if (waiter) {
        this.pending.delete(env.request_id);
        waiter.reject(new Error(JSON.stringify(env.payload ?? env)));
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

  async invokeString(target: string, args: unknown[]): Promise<string> {
    const inv = await this.send("invoke.request", { target_kind: "procedure", target, args }, "invoke.completed");
    const ret = inv.payload?.return;
    if (typeof ret !== "string") throw new Error(`Onverwacht antwoord van ${target}`);
    return ret;
  }

  async loadSharedApi(): Promise<void> {
    await this.send(
      "exec.request",
      { code: 'INCLUDE "fixtures/app-gevelwering/shared_building_api.basicpp"\n' },
      "exec.completed",
    );
    const bootRet = await this.invokeString("API_Bootstrap", []);
    if (!bootRet.startsWith("OK")) throw new Error(`API_Bootstrap mislukt: ${bootRet}`);
  }

  private applyAuth(info: AuthInfo): AuthInfo {
    this.auth = info;
    this.storeAuth(info);
    this.cb.onLogin(info);
    return info;
  }

  async bootstrapAndLogin(username: string, password: string): Promise<AuthInfo> {
    await this.whenOpen();
    await this.loadSharedApi();
    const ret = await this.invokeString("API_Login", [username, password]);
    if (ret.startsWith("ERROR")) throw new Error(ret);
    const parsed = JSON.parse(ret) as {
      ok?: boolean;
      token?: string;
      username?: string;
      display_name?: string;
      needs_totp?: boolean;
      needs_totp_setup?: boolean;
      challenge?: string;
      totp_secret?: string;
      otpauth_uri?: string;
      authenticator_app?: string;
      authenticator_hint?: string;
    };
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
        authenticator_hint: parsed.authenticator_hint,
      });
    }
    if (!parsed.ok || !parsed.token) throw new Error("Inloggen mislukt");
    return this.applyAuth({
      token: parsed.token,
      username: parsed.username || username,
      display_name: parsed.display_name || username,
    });
  }

  async verifyTotp(challenge: string, code: string): Promise<AuthInfo> {
    const ret = await this.invokeString("API_VerifyTotp", [challenge, code]);
    if (ret.startsWith("ERROR")) throw new Error(ret.replace(/^ERROR:\s*/, ""));
    const parsed = JSON.parse(ret) as {
      ok?: boolean;
      token?: string;
      username?: string;
      display_name?: string;
    };
    if (!parsed.ok || !parsed.token) throw new Error("Authenticator-bevestiging mislukt");
    return this.applyAuth({
      token: parsed.token,
      username: parsed.username || "admin",
      display_name: parsed.display_name || parsed.username || "admin",
    });
  }

  storeAuth(info: AuthInfo | null): void {
    persistAuth(this.authKey, info);
    void syncSessionCookie(info?.token ?? null);
  }

  loadStoredAuth(): AuthInfo | null {
    return loadAuth(this.authKey) as AuthInfo | null;
  }

  logout(): void {
    this.auth = null;
    this.storeAuth(null);
    this.cb.onLogout();
  }

  /**
   * Open WS, session.open, loadSharedApi, validate stored token.
   * Page-specific `onReady` callback fires after successful restore or login prompt.
   */
  connect(opts?: { reconnectMs?: number }): void {
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
        /* ignore */
      }
    }

    this.cb.onStatus(`Verbinden met ${this.wsUrl}…`, "busy");
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
              this.cb.onStatus("Sessie verlopen — log in", "err");
            } else {
              this.auth = stored;
              this.cb.onLogin(stored);
              this.cb.onStatus("Gereed", "ok");
            }
          } else {
            this.cb.onLogout();
            this.cb.onStatus("Verbonden — log in", "ok");
          }
        } catch (err) {
          if (gen !== this.connectGen) return;
          this.cb.onStatus(err instanceof Error ? err.message : String(err), "err");
          // Alleen uitloggen als we nog geen geldige sessie hebben — anders blijft
          // een mislukte onReady (project laden) ten onrechte het login-scherm tonen.
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
        reconnectMs > 0
          ? `Verbinding verbroken — opnieuw verbinden… (${this.wsUrl})`
          : `Verbinding verbroken (${this.wsUrl})`,
        "err",
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
}
