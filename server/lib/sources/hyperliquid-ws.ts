import WebSocket from 'ws';
import { log } from '../logger.js';

const WS_URL = 'wss://api.hyperliquid.xyz/ws';
const RECONNECT_DELAY_MS = 3000;
const PING_INTERVAL_MS = 30_000;

type MidsState = {
  mids: Map<string, number>;
  lastUpdate: number;
  connected: boolean;
};

const state: MidsState = {
  mids: new Map(),
  lastUpdate: 0,
  connected: false,
};

let ws: WebSocket | null = null;
let pingTimer: NodeJS.Timeout | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let started = false;
let loggedFirstMids = false;

function startPing() {
  if (pingTimer) clearInterval(pingTimer);
  pingTimer = setInterval(() => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ method: 'ping' }));
    }
  }, PING_INTERVAL_MS);
}

function connect() {
  log.info('[hl-ws] connecting to', WS_URL);
  ws = new WebSocket(WS_URL);

  ws.on('open', () => {
    log.info('[hl-ws] connected, subscribing to allMids dex=xyz');
    state.connected = true;
    ws!.send(
      JSON.stringify({
        method: 'subscribe',
        subscription: { type: 'allMids', dex: 'xyz' },
      }),
    );
    startPing();
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      // allMids message shape: { channel: 'allMids', data: { mids: { 'xyz:SMSN': '205.23', ... } } }
      // v0.5.0: allMids 전체 저장 (Tier 3 search 및 동적 watchlist hydration 위해).
      //         정적 7-ticker dashboard 는 assemble.ts HL_SYMBOL_TO_TICKER 가 REST fetcher
      //         (hyperliquid.ts) 결과 사용 — 본 WS map 과 무관, 동작 유지.
      if (msg.channel === 'allMids' && msg.data?.mids) {
        const mids = msg.data.mids as Record<string, string>;
        for (const apiKey in mids) {
          if (!Object.prototype.hasOwnProperty.call(mids, apiKey)) continue;
          const v = mids[apiKey];
          if (typeof v !== 'string') continue;
          const num = Number(v);
          if (!Number.isFinite(num)) continue;
          // key 'xyz:SMSN' → 'xyz_SMSN' (search Tier 3 + assemble entry.symbol 일관).
          state.mids.set(apiKey.replace(':', '_'), num);
        }
        state.lastUpdate = Date.now();
        if (!loggedFirstMids) {
          loggedFirstMids = true;
          log.info('[hl-ws] received first allMids update, cached', state.mids.size, 'mids');
        }
      }
    } catch (err) {
      log.warn('[hl-ws] message parse failed', err);
    }
  });

  ws.on('close', () => {
    log.warn('[hl-ws] disconnected, reconnecting in', RECONNECT_DELAY_MS, 'ms');
    state.connected = false;
    if (pingTimer) clearInterval(pingTimer);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => connect(), RECONNECT_DELAY_MS);
  });

  ws.on('error', (err) => {
    log.error('[hl-ws] error', err.message);
    // close handler will trigger reconnect
  });
}

/**
 * Start WS subscription. Idempotent — multiple calls are no-ops after first.
 */
export function startHyperliquidWs(): void {
  if (started) return;
  started = true;
  connect();
}

/**
 * Returns the latest mid prices map. Empty if WS not yet received first message.
 */
export function getLatestMids(): { mids: Map<string, number>; lastUpdate: number; connected: boolean } {
  return { mids: new Map(state.mids), lastUpdate: state.lastUpdate, connected: state.connected };
}
