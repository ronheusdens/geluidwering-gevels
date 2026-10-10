/**
 * Sticky status-bar load indicator: progress fill + countdown / elapsed.
 * Used while drawings (PDF) are fetched and decoded — including after refresh.
 */

export type ConnLoadProgress = {
  setLabel(text: string): void;
  /** 0..1 when known; null = indeterminate pulse. */
  setFraction(frac: number | null): void;
  /** Bytes received (updates fraction + ETA when total known). */
  setBytes(received: number, total: number | null): void;
  done(): void;
};

type Host = {
  bar: HTMLElement;
  status: HTMLElement;
};

function ensureUi(host: Host): {
  meta: HTMLElement;
  track: HTMLElement;
  fill: HTMLElement;
} {
  let meta = host.bar.querySelector<HTMLElement>(".conn-load-meta");
  let track = host.bar.querySelector<HTMLElement>(".conn-load-track");
  let fill = host.bar.querySelector<HTMLElement>(".conn-load-fill");
  if (!meta) {
    meta = document.createElement("span");
    meta.className = "conn-load-meta";
    meta.hidden = true;
    host.bar.appendChild(meta);
  }
  if (!track) {
    track = document.createElement("div");
    track.className = "conn-load-track";
    track.hidden = true;
    track.setAttribute("role", "progressbar");
    track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-valuemax", "100");
    fill = document.createElement("div");
    fill.className = "conn-load-fill";
    track.appendChild(fill);
    host.bar.appendChild(track);
  }
  if (!fill) {
    fill = document.createElement("div");
    fill.className = "conn-load-fill";
    track.appendChild(fill);
  }
  return { meta, track, fill };
}

function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}:${String(r).padStart(2, "0")}` : `${r}s`;
}

function formatEta(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "";
  const s = Math.max(0, Math.ceil(sec));
  if (s < 1) return "nog <1s";
  if (s < 60) return `nog ~${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `nog ~${m}m${r}s` : `nog ~${m}m`;
}

/**
 * Show floating progress under the sticky conn-bar until `done()`.
 * Updates status text; caller should call `setStatus` after `done()`.
 */
export function startConnLoadProgress(host: Host, initialLabel: string): ConnLoadProgress {
  const ui = ensureUi(host);
  const started = performance.now();
  let label = initialLabel;
  let fraction: number | null = null;
  let received = 0;
  let total: number | null = null;
  let finished = false;
  let timer: number | null = null;
  const samples: Array<{ t: number; n: number }> = [];

  host.bar.classList.add("is-loading", "status", "busy");
  host.bar.classList.remove("ok", "err");
  ui.meta.hidden = false;
  ui.track.hidden = false;

  const paint = (): void => {
    if (finished) return;
    const elapsed = performance.now() - started;
    host.status.textContent = label;
    let eta = "";
    if (total != null && total > 0 && received > 0 && fraction != null && fraction < 0.995) {
      const now = performance.now();
      samples.push({ t: now, n: received });
      while (samples.length > 8) samples.shift();
      if (samples.length >= 2) {
        const a = samples[0];
        const b = samples[samples.length - 1];
        const dt = (b.t - a.t) / 1000;
        const dn = b.n - a.n;
        if (dt > 0.05 && dn > 0) {
          const rate = dn / dt;
          eta = formatEta((total - received) / rate);
        }
      }
    }
    const pct =
      fraction != null && Number.isFinite(fraction)
        ? ` · ${Math.min(100, Math.max(0, Math.round(fraction * 100)))}%`
        : "";
    ui.meta.textContent = [formatElapsed(elapsed), eta].filter(Boolean).join(" · ") + pct;

    if (fraction == null) {
      ui.track.classList.add("is-indeterminate");
      ui.track.removeAttribute("aria-valuenow");
      ui.fill.style.width = "";
    } else {
      ui.track.classList.remove("is-indeterminate");
      const pctN = Math.min(100, Math.max(0, fraction * 100));
      ui.track.setAttribute("aria-valuenow", String(Math.round(pctN)));
      ui.fill.style.width = `${pctN}%`;
    }
  };

  paint();
  timer = window.setInterval(paint, 200);

  return {
    setLabel(text: string) {
      if (finished) return;
      label = text;
      paint();
    },
    setFraction(frac: number | null) {
      if (finished) return;
      fraction = frac == null ? null : Math.min(1, Math.max(0, frac));
      paint();
    },
    setBytes(rec: number, tot: number | null) {
      if (finished) return;
      received = Math.max(0, rec);
      total = tot != null && tot > 0 ? tot : null;
      fraction = total != null ? Math.min(1, received / total) : null;
      paint();
    },
    done() {
      if (finished) return;
      finished = true;
      if (timer != null) {
        window.clearInterval(timer);
        timer = null;
      }
      host.bar.classList.remove("is-loading");
      ui.meta.hidden = true;
      ui.meta.textContent = "";
      ui.track.hidden = true;
      ui.track.classList.remove("is-indeterminate");
      ui.fill.style.width = "0%";
      ui.track.removeAttribute("aria-valuenow");
    },
  };
}

/** Fetch binary body with optional byte progress (Content-Length when present). */
export async function fetchArrayBufferWithProgress(
  url: string,
  init: RequestInit,
  onProgress?: (received: number, total: number | null) => void,
): Promise<ArrayBuffer> {
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(`Download mislukt (HTTP ${res.status})`);
  }
  const lenHeader = res.headers.get("Content-Length");
  const total = lenHeader ? Number(lenHeader) : NaN;
  const totalBytes = Number.isFinite(total) && total > 0 ? total : null;

  if (!res.body || !onProgress) {
    const buf = await res.arrayBuffer();
    onProgress?.(buf.byteLength, totalBytes ?? buf.byteLength);
    return buf;
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  onProgress(0, totalBytes);
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.byteLength;
      onProgress(received, totalBytes);
    }
  }
  const out = new Uint8Array(received);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  onProgress(received, totalBytes ?? received);
  return out.buffer;
}
