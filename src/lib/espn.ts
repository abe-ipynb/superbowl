const SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
const GAME_ID = '401772988';
const POLL_INTERVAL_PRE = 60_000;   // 1 min before game
const POLL_INTERVAL_LIVE = 15_000;  // 15s during game
const POLL_INTERVAL_FINAL = 0;      // stop polling

export interface TeamInfo {
  abbreviation: string;
  displayName: string;
  logo: string;
  score: number;
}

export interface GameStatus {
  /** ESPN status type name: STATUS_SCHEDULED, STATUS_IN_PROGRESS, STATUS_HALFTIME, STATUS_END_PERIOD, STATUS_FINAL */
  name: string;
  /** Human-readable: "Scheduled", "In Progress", "Halftime", "Final", etc. */
  description: string;
  /** Detailed: "Sun, February 8th at 6:30 PM EST", "1st - 12:34", "Halftime", "Final" */
  detail: string;
  displayClock: string;
  period: number;
}

export interface GameScore {
  home: TeamInfo;
  away: TeamInfo;
  status: GameStatus;
}

export async function fetchGameScore(): Promise<GameScore | null> {
  try {
    const res = await fetch(`${SCOREBOARD_URL}?dates=20260208`);
    const data = await res.json();
    const event = data.events?.find((e: { id: string }) => e.id === GAME_ID);
    if (!event) return null;

    const comp = event.competitions[0];
    const home = comp.competitors.find((c: { homeAway: string }) => c.homeAway === 'home');
    const away = comp.competitors.find((c: { homeAway: string }) => c.homeAway === 'away');

    return {
      home: {
        abbreviation: home.team.abbreviation,
        displayName: home.team.displayName,
        logo: home.team.logo,
        score: parseInt(home.score) || 0,
      },
      away: {
        abbreviation: away.team.abbreviation,
        displayName: away.team.displayName,
        logo: away.team.logo,
        score: parseInt(away.score) || 0,
      },
      status: {
        name: event.status.type.name,
        description: event.status.type.description,
        detail: event.status.type.detail,
        displayClock: event.status.displayClock,
        period: event.status.period,
      },
    };
  } catch {
    return null;
  }
}

export function getPollInterval(status: GameStatus | undefined): number {
  if (!status) return POLL_INTERVAL_PRE;
  if (status.name === 'STATUS_FINAL') return POLL_INTERVAL_FINAL;
  if (status.name === 'STATUS_IN_PROGRESS' || status.name === 'STATUS_END_PERIOD') return POLL_INTERVAL_LIVE;
  if (status.name === 'STATUS_HALFTIME') return POLL_INTERVAL_LIVE;
  return POLL_INTERVAL_PRE;
}

const QUARTER_NAMES: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th' };

export function formatGameClock(status: GameStatus): string {
  switch (status.name) {
    case 'STATUS_SCHEDULED':
      return `Starting at 6:30 PM ET`;
    case 'STATUS_HALFTIME':
      return 'Halftime';
    case 'STATUS_FINAL':
      return status.period > 4 ? 'Final (OT)' : 'Final';
    case 'STATUS_END_PERIOD': {
      const q = QUARTER_NAMES[status.period] || `${status.period}th`;
      return `End of ${q}`;
    }
    case 'STATUS_IN_PROGRESS': {
      if (status.period > 4) {
        return `OT ${status.displayClock}`;
      }
      const q = QUARTER_NAMES[status.period] || `${status.period}th`;
      return `${q} ${status.displayClock}`;
    }
    default:
      return status.detail;
  }
}
