import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

export const YOUTUBE_HOT_TIMEZONE = 'Asia/Shanghai';
export const SNAPSHOT_DATE_FORMAT = 'YYYY-MM-DD';
export const SNAPSHOT_HOUR_FORMAT = 'YYYY-MM-DD HH:00:00';

export function toSnapshotDate(input: dayjs.ConfigType = new Date()): string {
  return dayjs(input).tz(YOUTUBE_HOT_TIMEZONE).format(SNAPSHOT_DATE_FORMAT);
}

export function parseSnapshotDate(input: string): string | null {
  const value = input.trim();
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = dayjs.tz(value, YOUTUBE_HOT_TIMEZONE);
    return parsed.isValid() ? parsed.format(SNAPSHOT_DATE_FORMAT) : null;
  }

  const parsed = dayjs(value);
  if (!parsed.isValid()) return null;
  return parsed.tz(YOUTUBE_HOT_TIMEZONE).format(SNAPSHOT_DATE_FORMAT);
}

export function toSnapshotHour(input: dayjs.ConfigType = new Date()): string {
  return dayjs(input).tz(YOUTUBE_HOT_TIMEZONE).startOf('hour').format(SNAPSHOT_HOUR_FORMAT);
}

export function parseSnapshotHour(input: string): string | null {
  const value = input.trim();
  if (!value) return null;

  const parsed = dayjs.tz(value, YOUTUBE_HOT_TIMEZONE);
  if (parsed.isValid()) {
    return parsed.startOf('hour').format(SNAPSHOT_HOUR_FORMAT);
  }

  const fallback = dayjs(value);
  if (!fallback.isValid()) return null;
  return fallback.tz(YOUTUBE_HOT_TIMEZONE).startOf('hour').format(SNAPSHOT_HOUR_FORMAT);
}

export function snapshotDateFromHour(input: string): string | null {
  const parsedHour = parseSnapshotHour(input);
  if (!parsedHour) return null;
  return dayjs.tz(parsedHour, YOUTUBE_HOT_TIMEZONE).format(SNAPSHOT_DATE_FORMAT);
}
