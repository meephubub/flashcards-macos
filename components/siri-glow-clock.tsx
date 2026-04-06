"use client"

import * as React from "react"

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

export function SiriGlowClock({
  className,
  active,
}: {
  className?: string
  active?: boolean
}) {
  const [now, setNow] = React.useState(() => new Date())

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 50)
    return () => window.clearInterval(id)
  }, [])

  const ms = String(now.getMilliseconds()).padStart(3, "0")

  return (
    <div className={`${active ? 'blob-static' : ''} ${className || ''}`}>
      <div className="siri-glow-inner grid min-h-[170px] place-items-center rounded-[28px] bg-background/70 px-10 py-10 text-center backdrop-blur-xl">
        <div className="flex items-baseline justify-center gap-3 tabular-nums">
          <div className="text-6xl font-bold leading-none tracking-tight text-foreground sm:text-7xl">
            {formatTime(now)}
          </div>
          <div className="text-xl font-semibold leading-none text-foreground/45 sm:text-2xl">
            .{ms}
          </div>
        </div>
      </div>
    </div>
  )
}

