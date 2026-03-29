"use client"

import { Clock } from "./clock"
import { CalendarWidget } from "./calendar-widget"
import { WeatherWidget } from "./weather-widget"
import { 
  TimerActivity, 
  MusicActivity, 
  DeliveryActivity 
} from "./live-activity"

export function SmartDisplay() {
  return (
    <div className="min-h-screen bg-background p-8 flex flex-col">
      {/* Main clock - center focus */}
      <div className="flex-1 flex items-center justify-center">
        <Clock />
      </div>

      {/* Bottom widgets grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-auto">
        {/* Weather */}
        <WeatherWidget />

        {/* Calendar */}
        <CalendarWidget />

        {/* Live Activities */}
        <div className="space-y-4">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
            Live Activities
          </h3>
          <TimerActivity initialSeconds={1500} label="Focus Session" />
          <MusicActivity />
        </div>

        {/* More Live Activities */}
        <div className="space-y-4">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
            Updates
          </h3>
          <DeliveryActivity />
        </div>
      </div>
    </div>
  )
}
