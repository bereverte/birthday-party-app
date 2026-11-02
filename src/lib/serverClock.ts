import { supabase } from './supabase'

// Difference between the server clock and this device's clock, in ms.
// Only used to display countdowns: scoring always uses server timestamps.
let offsetMs = 0

// Postgres sends microseconds ("...:00.123456+00:00"). Some browsers reject
// more than 3 fractional digits, so trim them before parsing.
export function parseServerTime(value: string): number {
  return new Date(value.replace(/(\.\d{3})\d+/, '$1')).getTime()
}

// Takes a few samples and keeps the one with the shortest round trip: the
// shorter the trip, the closer the midpoint is to when the server read its
// clock.
export async function syncServerClock(samples = 3): Promise<number> {
  let best: { rtt: number; offset: number } | null = null

  for (let i = 0; i < samples; i++) {
    const t0 = Date.now()
    const { data, error } = await supabase.rpc('server_now')
    const t1 = Date.now()
    if (error || !data) continue

    const rtt = t1 - t0
    const offset = parseServerTime(data) - (t0 + t1) / 2
    if (!best || rtt < best.rtt) best = { rtt, offset }
  }

  if (best) offsetMs = Math.round(best.offset)
  return offsetMs
}

export function serverNow(): number {
  return Date.now() + offsetMs
}

export function getClockOffset(): number {
  return offsetMs
}
