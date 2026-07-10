// Shared visual metadata for workout types — colors, emoji, HR zones.
// Single source of truth reused across dashboard, calendar, plan and detail.

export type WorkoutMeta = {
  color: string
  bg: string
  emoji: string
  zone: string
  label: string
}

export const TYPE_META: Record<string, WorkoutMeta> = {
  easy_run:  { color: 'var(--blue)',   bg: 'var(--blue-dim)',   emoji: '🚶', zone: 'Z1–Z2', label: 'Easy Run' },
  long_run:  { color: 'var(--blue)',   bg: 'var(--blue-dim)',   emoji: '🏃', zone: 'Z2',    label: 'Long Run' },
  tempo:     { color: 'var(--orange)', bg: 'var(--orange-dim)', emoji: '⚡', zone: 'Z3',    label: 'Tempo Run' },
  intervals: { color: 'var(--orange)', bg: 'var(--orange-dim)', emoji: '🔥', zone: 'Z4–Z5', label: 'Interwały' },
  rest:      { color: 'var(--text-3)', bg: 'var(--surface3)',   emoji: '😴', zone: '—',     label: 'Odpoczynek' },
}

export function metaFor(type: string | null | undefined): WorkoutMeta {
  return TYPE_META[type ?? ''] ?? TYPE_META.rest
}

/** Trim a stored target_pace like "4:45 min/km" down to "4:45". */
export function shortPace(pace: string | null | undefined): string | null {
  if (!pace) return null
  return pace.match(/^\d+:\d{2}/)?.[0] ?? pace
}

export const DAY_PL: Record<string, string> = {
  mon: 'Poniedziałek', tue: 'Wtorek', wed: 'Środa', thu: 'Czwartek',
  fri: 'Piątek', sat: 'Sobota', sun: 'Niedziela',
}
