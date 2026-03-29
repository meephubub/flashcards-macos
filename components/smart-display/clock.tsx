"use client"

import { useEffect, useState } from "react"

export function Clock() {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const hours = time.getHours()
  const minutes = time.getMinutes().toString().padStart(2, "0")
  const seconds = time.getSeconds().toString().padStart(2, "0")

  const formattedDate = time.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="flex items-baseline gap-2 font-mono">
        <span className="text-[12rem] font-light tracking-tight leading-none">
          {hours.toString().padStart(2, "0")}
        </span>
        <span className="text-[12rem] font-light tracking-tight leading-none animate-pulse">
          :
        </span>
        <span className="text-[12rem] font-light tracking-tight leading-none">
          {minutes}
        </span>
        <span className="text-6xl text-muted-foreground font-light ml-2">
          {seconds}
        </span>
      </div>
      <p className="text-2xl text-muted-foreground mt-4">{formattedDate}</p>
    </div>
  )
}
