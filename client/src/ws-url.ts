/**
 * Resolve bppServer WebSocket URL.
 * HTTPS pages always use same-origin wss:// (ignore ?ws= open redirect).
 * Dev (http) uses ?ws= / BPP_WS_URL / ws://hostname:18080/ws.
 */
export function resolveBppWsUrl(): string {
  if (location.protocol === "https:") {
    return `wss://${location.host}/ws`;
  }
  const q = new URLSearchParams(location.search).get("ws");
  const override = (window as unknown as { BPP_WS_URL?: string }).BPP_WS_URL;
  return q || override || `ws://${location.hostname}:18080/ws`;
}
