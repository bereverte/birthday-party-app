import { useEffect, useState } from 'react'
import { parseServerTime, serverNow } from '../../lib/serverClock'

// Seconds left until closesAt, on the server's clock. Display only:
// submit_answer and close_question check the time on the server.
export function useCountdown(closesAt: string | null, running: boolean) {
  const target = closesAt ? parseServerTime(closesAt) : null
  const [now, setNow] = useState(serverNow)

  useEffect(() => {
    if (!running || target === null) return
    const tick = () => setNow(serverNow())
    tick()
    const timer = setInterval(tick, 250)
    return () => clearInterval(timer)
  }, [running, target])

  if (target === null) return null
  return Math.max(0, Math.ceil((target - now) / 1000))
}
