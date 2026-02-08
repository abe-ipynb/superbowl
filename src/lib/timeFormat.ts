import type { TickMarkType } from 'lightweight-charts';

const TZ = 'America/New_York';

const timeFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const dateFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  month: 'short',
  day: 'numeric',
});

const fullFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

export function etTickFormatter(time: number, tickMarkType: TickMarkType): string {
  const date = new Date(time * 1000);
  // TickMarkType: 0=Year, 1=Month, 2=DayOfMonth, 3=Time, 4=TimeWithSeconds
  if (tickMarkType >= 3) {
    return timeFmt.format(date);
  }
  return dateFmt.format(date);
}

export function etTooltipFormatter(time: number): string {
  const date = new Date(time * 1000);
  return fullFmt.format(date) + ' ET';
}
