"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { CalendarDays } from "lucide-react"

interface CalendarEvent {
  id: string
  title: string
  time: string
  duration?: string
  isNow?: boolean
}

// Mock events - replace with real calendar integration
const mockEvents: CalendarEvent[] = [
  { id: "1", title: "Morning standup", time: "9:00 AM", duration: "30m", isNow: true },
  { id: "2", title: "Design review", time: "11:00 AM", duration: "1h" },
  { id: "3", title: "Lunch", time: "12:30 PM", duration: "1h" },
  { id: "4", title: "Project sync", time: "2:00 PM", duration: "45m" },
  { id: "5", title: "Focus time", time: "4:00 PM", duration: "2h" },
]

export function CalendarWidget() {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <CalendarDays className="h-4 w-4" />
          Today&apos;s Schedule
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {mockEvents.map((event, index) => (
          <div key={event.id}>
            <div
              className={`flex items-start justify-between gap-4 py-2 px-3 rounded-lg transition-colors ${
                event.isNow ? "bg-primary/10 border border-primary/20" : ""
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${event.isNow ? "text-foreground" : ""}`}>
                  {event.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {event.time} {event.duration && `· ${event.duration}`}
                </p>
              </div>
              {event.isNow && (
                <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full shrink-0">
                  Now
                </span>
              )}
            </div>
            {index < mockEvents.length - 1 && <Separator className="mt-3" />}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
