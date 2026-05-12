import WebSocket from 'ws';
import { log } from '../logger.js';

const WS_URL = 'wss://api.hyperliquid.xyz/ws';
const RECONNECT_DELAY_MS = 3000;
const PING_INTERVAL_MS = 30_000;
const TARGET_SYMBOLS = ['SMSN', 'SKHX', 'HYUNDAI', 'KR200', 'EWY', 'SP500', 'KRW'] as const;

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
      if (msg.channel === 'allMids' && msg.data?.mids) {
        const mids = msg.data.mids as Record<string, string>;
        for (const symbol of TARGET_SYMBOLS) {
          const apiKey = `xyz:${symbol}`;
          const v = mids[apiKey];
          if (v !== undefined) {
            const num = Number(v);
            if (Number.isFinite(num)) {
              state.mids.set(`xyz_${symbol}`, num);
            }
          }
        }
        state.lastUpdate = Date.now();
        if (!loggedFirstMids) {
          loggedFirstMids = true;
          log.info('[hl-ws] received first allMids update, cached', state.mids.size, 'targets');
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
