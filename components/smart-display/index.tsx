"use client"

import { useState } from "react"
import { Clock } from "./clock"
import { CalendarWidget } from "./calendar-widget"
import { WeatherWidget } from "./weather-widget"
import { TimerActivity, MusicActivity, DeliveryActivity } from "./live-activity"
import { Dock } from "./dock"

type Page = "home" | "calendar" | "weather" | "activities"

export function SmartDisplay() {
  const [activePage, setActivePage] = useState<Page>("home")

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-hidden">
      {/* Page content */}
      <main className="flex-1 flex items-center justify-center pb-28">
        {activePage === "home" && (
          <div className="flex flex-col items-center justify-center">
            <Clock />
          </div>
        )}

        {activePage === "calendar" && (
          <div className="w-full max-w-md px-6">
            <CalendarWidget />
          </div>
        )}

        {activePage === "weather" && (
          <div className="w-full max-w-sm px-6">
            <WeatherWidget />
          </div>
        )}

        {activePage === "activities" && (
          <div className="w-full max-w-md px-6 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest text-center mb-6">
              Live Activities
            </p>
            <TimerActivity initialSeconds={1500} label="Focus Session" />
            <MusicActivity />
            <DeliveryActivity />
          </div>
        )}
      </main>

      {/* macOS-style Dock */}
      <Dock activePage={activePage} onNavigate={setActivePage} />
    </div>
  )
}
