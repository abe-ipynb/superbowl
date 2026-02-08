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
      this.onStatus('connected');
      this.ws = ws;
      for (const id of this.subscriptions) {
        this.sendSubscribe(id);
      }
      this.startHeartbeat();
    };

    ws.onmessage = (event) => {
      try {
        const msgs = JSON.parse(event.data);
        const list = Array.isArray(msgs) ? msgs : [msgs];
        for (const data of list) {
          if (data.asset_id && data.price) {
            const ts = data.timestamp ? new Date(data.timestamp).getTime() : Date.now();
            this.onPrice(data.asset_id, parseFloat(data.price), ts);
          }
        }
      } catch {
        // ignore non-JSON messages (pong, etc)
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
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private sendSubscribe(clobTokenId: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'market', assets_id: clobTokenId }));
    }
  }

  subscribe(clobTokenId: string) {
    this.subscriptions.add(clobTokenId);
    this.sendSubscribe(clobTokenId);
  }

  unsubscribe(clobTokenId: string) {
    this.subscriptions.delete(clobTokenId);
  }

  destroy() {
    this.destroyed = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }
}
