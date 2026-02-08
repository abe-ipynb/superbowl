type PriceHandler = (clobTokenId: string, price: number, timestamp: number) => void;
type StatusHandler = (status: 'connected' | 'disconnected' | 'reconnecting') => void;

export class PolymarketWS {
  private ws: WebSocket | null = null;
  private subscriptions = new Set<string>();
  private onPrice: PriceHandler;
  private onStatus: StatusHandler;
  private backoff = 1000;
  private maxBackoff = 30000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private destroyed = false;

  constructor(onPrice: PriceHandler, onStatus: StatusHandler) {
    this.onPrice = onPrice;
    this.onStatus = onStatus;
    this.connect();
  }

  private connect() {
    if (this.destroyed) return;
    this.onStatus('reconnecting');

    const ws = new WebSocket('wss://ws-subscriptions-clob.polymarket.com/ws/market');

    ws.onopen = () => {
      this.backoff = 1000;
      this.ws = ws;

      // Required initial handshake
      ws.send(JSON.stringify({ assets_ids: [], type: 'market' }));

      // Re-subscribe all tracked assets
      if (this.subscriptions.size > 0) {
        ws.send(JSON.stringify({
          operation: 'subscribe',
          assets_ids: Array.from(this.subscriptions),
        }));
      }

      this.onStatus('connected');
      this.startHeartbeat();
    };

    ws.onmessage = (event) => {
      try {
        const raw = typeof event.data === 'string' ? event.data : event.data.toString();
        if (raw === 'PONG' || raw === 'pong') return;

        const msgs = JSON.parse(raw);
        const list = Array.isArray(msgs) ? msgs : [msgs];

        for (const msg of list) {
          if (!msg.event_type) continue;

          if (msg.event_type === 'last_trade_price') {
            // Direct trade execution — most useful for live price
            const ts = msg.timestamp ? parseInt(msg.timestamp) : Date.now();
            this.onPrice(msg.asset_id, parseFloat(msg.price), ts);
          } else if (msg.event_type === 'price_change' && msg.price_changes) {
            // Order book price changes — use mid of best bid/ask
            const ts = msg.timestamp ? parseInt(msg.timestamp) : Date.now();
            for (const pc of msg.price_changes) {
              const bid = parseFloat(pc.best_bid);
              const ask = parseFloat(pc.best_ask);
              if (bid > 0 && ask > 0) {
                const mid = (bid + ask) / 2;
                this.onPrice(pc.asset_id, mid, ts);
              } else if (pc.price) {
                this.onPrice(pc.asset_id, parseFloat(pc.price), ts);
              }
            }
          }
        }
      } catch {
        // ignore non-JSON messages
      }
    };

    ws.onclose = () => {
      this.stopHeartbeat();
      this.onStatus('disconnected');
      this.ws = null;
      this.scheduleReconnect();
    };

    ws.onerror = () => {
      ws.close();
    };
  }

  private scheduleReconnect() {
    if (this.destroyed) return;
    const jitter = Math.random() * 1000;
    this.reconnectTimer = setTimeout(() => {
      this.backoff = Math.min(this.backoff * 2, this.maxBackoff);
      this.connect();
    }, this.backoff + jitter);
  }

  private startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send('PING');
      }
    }, 30000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  subscribe(clobTokenId: string) {
    this.subscriptions.add(clobTokenId);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        operation: 'subscribe',
        assets_ids: [clobTokenId],
      }));
    }
  }

  unsubscribe(clobTokenId: string) {
    this.subscriptions.delete(clobTokenId);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        operation: 'unsubscribe',
        assets_ids: [clobTokenId],
      }));
    }
  }

  destroy() {
    this.destroyed = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }
}
