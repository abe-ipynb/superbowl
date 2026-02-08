# Abe's Super Bowl LX Watch Party — Polymarket Dashboard

## Product Spec v1.0

**Author:** Abe Arafat
**Date:** February 2026
**Status:** Draft

---

## 1. Overview

A browser-only React SPA that displays live Polymarket odds for Super Bowl LX markets on a 32" 4K display during a watch party. Users browse available Super Bowl markets, select up to 8 to pin to a dashboard, and watch real-time price movements via area charts that match Polymarket's native UI style.

### Key Constraints

| Constraint | Decision |
|---|---|
| Backend | None — browser-only SPA, all API calls from client |
| Display | 32" 4K (3840×2160), landscape, viewed from couch distance (~6–10 ft) |
| Data source (metadata) | Gamma API (`https://gamma-api.polymarket.com`) |
| Data source (live prices) | Polymarket WebSocket (`wss://ws-subscriptions-clob.polymarket.com/ws/market`) |
| CLOB REST API | Not used |
| Max simultaneous charts | 8 (minimum 4) |

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     React SPA (Vite)                    │
│                                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────┐  │
│  │ Market Browse │    │  Dashboard   │    │  Header   │  │
│  │    Panel      │───▶│   Grid       │    │  Banner   │  │
│  │  (Gamma API)  │    │ (WS-powered) │    │           │  │
│  └──────────────┘    └──────────────┘    └───────────┘  │
│         │                    ▲                           │
│         │                    │                           │
│    Gamma REST           WebSocket                       │
│    (on-demand)          (persistent)                    │
│         │                    │                           │
│         ▼                    │                           │
│  ┌──────────────┐    ┌──────────────┐                   │
│  │ gamma-api.   │    │ ws-subscrip  │                   │
│  │ polymarket   │    │ tions-clob.  │                   │
│  │ .com         │    │ polymarket   │                   │
│  │              │    │ .com         │                   │
│  └──────────────┘    └──────────────┘                   │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

1. **On load:** Fetch Super Bowl markets from Gamma API (`GET /markets?tag=super-bowl` or search by slug/keyword).
2. **User selects markets:** Selected markets are pinned to the dashboard grid.
3. **WebSocket connects:** For each pinned market, subscribe to the WS channel using its `condition_id` / `token_id` (obtained from Gamma response).
4. **Live updates:** WS price ticks are appended to an in-memory time-series array per market. Charts re-render on each tick.
5. **User unpins a market:** Unsubscribe from that WS channel, free the grid slot.

---

## 3. API Integration

### 3.1 Gamma API (Market Discovery)

**Endpoint:** `GET https://gamma-api.polymarket.com/markets`

**Query strategy:** Filter for Super Bowl / "big game" markets. Gamma supports query params like `tag`, `slug`, or free-text search. The app should search for markets matching keywords: `"super bowl"`, `"Super Bowl LX"`, `"big game"`, `"NFL championship"`.

**Response fields used:**

| Field | Usage |
|---|---|
| `id` | Unique market identifier |
| `question` | Display title (e.g., "Will the Chiefs win Super Bowl LX?") |
| `description` | Tooltip / detail text |
| `outcomes` | Array of outcome names (e.g., ["Yes", "No"]) |
| `outcomePrices` | Current prices per outcome (e.g., ["0.62", "0.38"]) |
| `image` | Market thumbnail |
| `conditionId` | Used for WS subscription |
| `clobTokenIds` | Token IDs for each outcome — needed for WS price feeds |
| `slug` | URL slug for deep-linking back to Polymarket |
| `active` | Boolean — only show active markets |
| `closed` | Boolean — exclude closed markets |

**Polling:** Gamma is called on-demand (page load + manual refresh button). No continuous polling needed since live prices come from the WebSocket.

### 3.2 WebSocket (Live Prices)

**Endpoint:** `wss://ws-subscriptions-clob.polymarket.com/ws/market`

**Subscription message format:**

```json
{
  "type": "market",
  "assets_id": "<clobTokenId>"
}
```

**Incoming message format (price tick):**

```json
{
  "asset_id": "<clobTokenId>",
  "price": "0.6500",
  "timestamp": "2026-02-08T23:45:12.000Z"
}
```

> **Note:** The exact WS message schema should be verified against Polymarket's current implementation during development. The above is based on documented/observed behavior as of early 2026.

**Connection management:**

| Concern | Strategy |
|---|---|
| Reconnection | Exponential backoff (1s → 2s → 4s → max 30s) with jitter |
| Heartbeat | Send ping every 30s; if no pong within 10s, reconnect |
| Max subscriptions | 8 simultaneous (one per pinned market) |
| Unsubscribe | On market unpin, send unsubscribe message and stop appending ticks |

---

## 4. UI Design

### 4.1 Layout (3840×2160 target)

```
┌──────────────────────────────────────────────────────────────┐
│  🏈  ABE'S SUPER BOWL LX WATCH PARTY          [Refresh] [⚙] │
├──────────────┬───────────────────────────────────────────────┤
│              │                                               │
│  BROWSE      │              DASHBOARD GRID                   │
│  MARKETS     │                                               │
│              │   ┌─────────────┐  ┌─────────────┐           │
│  ☐ Chiefs    │   │  Market 1   │  │  Market 2   │           │
│    win       │   │  ▓▓▓▓▓▓▓▓▓  │  │  ▓▓▓▓▓▓▓▓▓  │           │
│  ☐ MVP       │   │  62¢ → 65¢  │  │  41¢ → 39¢  │           │
│    winner    │   └─────────────┘  └─────────────┘           │
│  ☐ Total     │   ┌─────────────┐  ┌─────────────┐           │
│    points    │   │  Market 3   │  │  Market 4   │           │
│  ☐ First     │   │  ▓▓▓▓▓▓▓▓▓  │  │  ▓▓▓▓▓▓▓▓▓  │           │
│    TD        │   │  78¢ → 80¢  │  │  22¢ → 19¢  │           │
│  ☐ Halftime  │   └─────────────┘  └─────────────┘           │
│    show      │                                               │
│  ...         │                                               │
│              │                                               │
├──────────────┴───────────────────────────────────────────────┤
│  WS: Connected  •  8/8 markets live  •  Last tick: 23:45:12 │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 Grid Behavior

| # Pinned Markets | Grid Layout | Card Size (approx at 4K) |
|---|---|---|
| 1 | 1×1 (full area) | ~2800×1600 px |
| 2 | 2×1 | ~1400×1600 px |
| 3–4 | 2×2 | ~1400×800 px |
| 5–6 | 3×2 | ~930×800 px |
| 7–8 | 4×2 | ~700×800 px |

Grid auto-adjusts as markets are added/removed. CSS Grid with `auto-fill` / `minmax`.

### 4.3 Header Banner

- Title: **"ABE'S SUPER BOWL LX WATCH PARTY"** in bold, fun typography
- Football emoji 🏈 or subtle animated football graphic
- Dark background with team color accents (configurable or auto-detected from matchup)
- Optional: live clock, game score integration (stretch goal)
- Vibe: celebratory, sports-bar energy — not corporate dashboard

### 4.4 Browse Panel (Left Sidebar)

- Scrollable list of all Super Bowl markets fetched from Gamma
- Each row shows:
  - Market question (truncated if long)
  - Current lead outcome + price (e.g., "Yes 65¢")
  - Toggle/checkbox to pin to dashboard
- Search/filter bar at top of panel
- Pinned markets highlighted with accent color
- Visual indicator when market is live on dashboard (green dot)
- Panel is collapsible to maximize chart area

### 4.5 Chart Cards (Dashboard Grid)

Each card matches Polymarket's native chart style:

**Card layout:**

```
┌───────────────────────────────────┐
│ Will the Chiefs win Super Bowl LX │  ← Question title
│                                   │
│ 65¢                               │  ← Current price, large
│ Yes                               │  ← Outcome name
│                                   │
│  ╱──╲    ╱──────╲                 │
│ ╱    ╲──╱        ╲───             │  ← Area chart (filled)
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓           │
│                                   │
│ 6:00 PM    8:00 PM    10:00 PM   │  ← Time axis
│                                   │
│ [×]                               │  ← Unpin button
└───────────────────────────────────┘
```

**Chart specifications:**

| Property | Value |
|---|---|
| Chart type | Area chart (filled below the line) |
| Line color | `#22C55E` (green) when price trending up; `#EF4444` (red) when trending down vs. session open |
| Fill | Same color as line, 15–20% opacity gradient fading to transparent at bottom |
| Line weight | 2px |
| Y-axis | 0¢ – 100¢ (always full range, representing 0%–100% probability) |
| X-axis | Time — auto-scales based on session duration. Labels in local time (ET) |
| Tooltip | On hover: exact price + timestamp |
| Animation | Smooth line transition on new tick (no jarring redraws) |
| Background | Dark (`#1A1A2E` or similar dark navy) — matches Polymarket's dark mode |

**Chart library:** Lightweight Charts (TradingView open-source) or Recharts. Lightweight Charts preferred for performance with streaming data and native financial chart feel.

### 4.6 Color & Theme

| Element | Color |
|---|---|
| Background (app) | `#0F0F1A` (very dark navy/black) |
| Background (cards) | `#1A1A2E` |
| Background (sidebar) | `#12121F` |
| Text (primary) | `#FFFFFF` |
| Text (secondary) | `#9CA3AF` (gray-400) |
| Accent (up/positive) | `#22C55E` (green-500) |
| Accent (down/negative) | `#EF4444` (red-500) |
| Header accent | Gradient or team-color configurable |
| Border/divider | `#2D2D44` |

### 4.7 Typography

- **Header title:** 48–64px, bold, slightly playful font (e.g., Inter Black or a sports-style display font)
- **Market question (card):** 18–22px, semi-bold, white
- **Current price (card):** 36–48px, bold, green or red
- **Axis labels:** 12–14px, gray
- **Sidebar items:** 16px, regular weight

All sizes optimized for readability at 6–10 ft viewing distance on a 32" 4K display.

### 4.8 Status Bar (Bottom)

Persistent footer showing:
- WebSocket connection status (🟢 Connected / 🔴 Disconnected / 🟡 Reconnecting)
- Count of active subscriptions (e.g., "6/8 markets live")
- Timestamp of last received tick
- Subtle, non-distracting — small text, muted color

---

## 5. State Management

### In-Memory Data Structures

```typescript
interface Market {
  id: string;
  question: string;
  description: string;
  outcomes: string[];
  outcomePrices: string[];
  image: string;
  conditionId: string;
  clobTokenIds: string[];
  slug: string;
}

interface PriceTick {
  price: number;      // 0.00 – 1.00
  timestamp: number;  // Unix ms
}

interface PinnedMarket {
  market: Market;
  outcomeIndex: number;             // Which outcome to chart (default: 0, i.e., "Yes")
  timeSeries: PriceTick[];          // Append-only in-memory array
  sessionOpenPrice: number;         // First tick price — used for up/down color
  currentPrice: number;             // Latest tick
}

interface AppState {
  allMarkets: Market[];              // From Gamma
  pinnedMarkets: PinnedMarket[];     // Max 8
  wsStatus: 'connected' | 'disconnected' | 'reconnecting';
  lastTickTime: number | null;
  sidebarCollapsed: boolean;
  searchQuery: string;
}
```

**State library:** React `useReducer` + Context. No Redux needed for this scope.

### Time-Series Buffer

- Max buffer size: 3,600 ticks per market (enough for ~1 hour at 1 tick/second)
- If buffer exceeds max, drop oldest ticks (sliding window)
- On unpin, discard time series data

---

## 6. Interactions & UX

| Action | Behavior |
|---|---|
| Pin market (sidebar click) | Add to dashboard grid, open WS subscription, grid re-layouts |
| Unpin market (card × button) | Remove from grid, close WS subscription, grid re-layouts |
| Hover chart | Show crosshair + tooltip with price and time |
| Click sidebar search | Filter market list by keyword |
| Collapse sidebar | Sidebar hides, charts expand to full width |
| Refresh button (header) | Re-fetch markets from Gamma, update sidebar list |
| Pin when 8 already pinned | Show toast: "Max 8 markets. Unpin one to add another." |

### Keyboard Shortcuts (Nice to Have)

| Key | Action |
|---|---|
| `S` | Toggle sidebar |
| `R` | Refresh markets |
| `1`–`8` | Focus/highlight corresponding chart card |
| `Esc` | Deselect / close any open tooltip |

---

## 7. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | React 18+ (Vite) | Fast dev, great ecosystem, no backend needed |
| Charts | Lightweight Charts (TradingView) | Built for streaming financial data, area charts, dark theme, performant |
| Styling | Tailwind CSS | Rapid dark-mode theming, responsive grid utilities |
| State | `useReducer` + Context | Simple, no external deps for this scale |
| WebSocket | Native browser `WebSocket` API + custom hook | No library needed; custom reconnection logic |
| Fonts | Inter (Google Fonts) | Clean, modern, highly readable at distance |
| Build | Vite | Fast HMR, optimized production builds |
| Deploy | Static hosting (Vercel / Netlify / even `file://`) | Zero backend |

---

## 8. Error Handling

| Scenario | Handling |
|---|---|
| Gamma API unreachable | Show error banner + retry button. Cache last successful response in `sessionStorage`. |
| WebSocket disconnects | Auto-reconnect with exponential backoff. Show 🟡 status. Charts freeze at last known price (no gap). |
| WebSocket never connects | Show 🔴 status. Charts display Gamma snapshot prices (static, no streaming). |
| No Super Bowl markets found | Show friendly message: "No Super Bowl markets found on Polymarket. Try refreshing." |
| Browser tab hidden | Pause chart rendering (save CPU). Resume on focus. WS stays connected. |
| CORS issues | Gamma API is CORS-friendly. If WS has issues, document workaround (browser extension or local proxy). |

---

## 9. Performance Considerations

| Concern | Mitigation |
|---|---|
| 8 charts updating simultaneously | Lightweight Charts is canvas-based and handles high-frequency updates efficiently. Batch React state updates. |
| Memory (time-series buffers) | Cap at 3,600 ticks/market × 8 markets = ~28,800 objects max. Negligible. |
| 4K rendering | Canvas-based charts scale well. Ensure `devicePixelRatio` is respected for sharp rendering. |
| WS message volume | At ~1 tick/sec/market × 8 = ~8 msgs/sec. Trivial. |

---

## 10. Stretch Goals (Post-MVP)

| Feature | Description |
|---|---|
| Live game score | Integrate NFL score API to show score in header alongside odds |
| Price alerts | Audible chime or visual flash when a market crosses a threshold (e.g., "MVP market flips leader") |
| Historical data | On pin, fetch last 24h of price history from Polymarket's history endpoint to pre-fill chart |
| Multi-outcome charts | For markets with 3+ outcomes (e.g., "Who will be MVP?"), overlay multiple outcome lines |
| Shareable snapshot | Screenshot button that captures dashboard state as PNG |
| Team color theming | Auto-detect teams from market titles and apply team colors to header gradient |
| Sound effects | Optional celebration sounds when odds spike dramatically |

---

## 11. File Structure

```
superbowl-dashboard/
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── package.json
├── tsconfig.json
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── Header.tsx              # Banner with title + controls
│   │   ├── Sidebar.tsx             # Browse panel with market list
│   │   ├── MarketCard.tsx          # Single chart card
│   │   ├── DashboardGrid.tsx       # Auto-layout grid of MarketCards
│   │   ├── StatusBar.tsx           # WS status footer
│   │   └── Toast.tsx               # Notification toasts
│   ├── hooks/
│   │   ├── useGammaMarkets.ts      # Fetch + cache Gamma data
│   │   ├── usePolymarketWS.ts      # WebSocket connection + subscription manager
│   │   └── useTimeSeries.ts        # Time-series buffer management
│   ├── lib/
│   │   ├── gamma.ts                # Gamma API client
│   │   ├── ws.ts                   # WebSocket wrapper with reconnection
│   │   └── types.ts                # TypeScript interfaces
│   ├── state/
│   │   ├── context.tsx             # App-level context provider
│   │   └── reducer.ts              # useReducer actions + state
│   └── styles/
│       └── globals.css             # Tailwind base + custom styles
```

---

## 12. Development Plan

| Phase | Scope | Est. Effort |
|---|---|---|
| **Phase 1 — Static shell** | Header, sidebar, grid layout, Tailwind dark theme. Mock data. | 2–3 hrs |
| **Phase 2 — Gamma integration** | Fetch real markets, populate sidebar, search/filter. | 1–2 hrs |
| **Phase 3 — Charts** | Integrate Lightweight Charts, render static area charts from Gamma prices. | 2–3 hrs |
| **Phase 4 — WebSocket** | Connect WS, subscribe on pin, stream ticks to charts. | 2–3 hrs |
| **Phase 5 — Polish** | Status bar, error handling, toast notifications, responsive grid, keyboard shortcuts. | 2–3 hrs |
| **Phase 6 — 4K optimization** | Font sizes, chart DPI, viewing distance testing on actual display. | 1 hr |

**Total estimated:** ~10–15 hours

---

## Appendix A: Gamma API Examples

**Fetch Super Bowl markets:**
```
GET https://gamma-api.polymarket.com/markets?tag=super-bowl&closed=false&active=true&limit=50
```

**Alternative keyword search:**
```
GET https://gamma-api.polymarket.com/markets?_q=super+bowl&closed=false&active=true
```

## Appendix B: WebSocket Connection Example

```typescript
const ws = new WebSocket('wss://ws-subscriptions-clob.polymarket.com/ws/market');

ws.onopen = () => {
  // Subscribe to a market's "Yes" outcome
  ws.send(JSON.stringify({
    type: 'market',
    assets_id: clobTokenIds[0]  // "Yes" token ID from Gamma
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Append { price: parseFloat(data.price), timestamp: Date.now() } to time series
};
```

> **Important:** Verify exact subscription/message schemas against Polymarket's current WS implementation before development. The schemas above are based on community documentation and may have changed.
