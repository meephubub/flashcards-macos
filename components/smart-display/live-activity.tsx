"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { 
  Timer, 
  Music, 
  MapPin, 
  Package,
  Plane,
  Dumbbell
} from "lucide-react"
import { useEffect, useState } from "react"

interface LiveActivityProps {
  type: "timer" | "music" | "delivery" | "flight" | "workout" | "location"
  title: string
  subtitle?: string
  progress?: number
  icon?: React.ReactNode
  metadata?: Record<string, string>
  accentColor?: string
}

export function LiveActivity({
  type,
  title,
  subtitle,
  progress,
  metadata,
}: LiveActivityProps) {
  const icons = {
    timer: <Timer className="h-5 w-5" />,
    music: <Music className="h-5 w-5" />,
    delivery: <Package className="h-5 w-5" />,
    flight: <Plane className="h-5 w-5" />,
    workout: <Dumbbell className="h-5 w-5" />,
    location: <MapPin className="h-5 w-5" />,
  }

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="p-2 rounded-xl bg-muted">
            {icons[type]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium truncate">{title}</p>
              {metadata?.time && (
                <span className="text-xs text-muted-foreground font-mono shrink-0">
                  {metadata.time}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            )}
            {progress !== undefined && (
              <Progress value={progress} className="h-1 mt-3" />
            )}
            {metadata && Object.keys(metadata).length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                {Object.entries(metadata)
                  .filter(([key]) => key !== "time")
                  .map(([key, value]) => (
                    <span key={key} className="text-xs text-muted-foreground">
                      <span className="capitalize">{key}:</span> {value}
                    </span>
                  ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Timer Live Activity with countdown
export function TimerActivity({ 
  initialSeconds = 300,
  label = "Focus Timer" 
}: { 
  initialSeconds?: number
  label?: string 
}) {
  const [seconds, setSeconds] = useState(initialSeconds)
  const [isRunning, setIsRunning] = useState(true)

  useEffect(() => {
    if (!isRunning || seconds <= 0) return

    const interval = setInterval(() => {
      setSeconds((s) => s - 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [isRunning, seconds])

  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  const progress = ((initialSeconds - seconds) / initialSeconds) * 100

  return (
    <LiveActivity
      type="timer"
      title={label}
      subtitle={isRunning ? "Running" : "Paused"}
      progress={progress}
      metadata={{
        time: `${minutes}:${secs.toString().padStart(2, "0")}`,
      }}
    />
  )
}

// Music Activity
export function MusicActivity() {
  const [progress, setProgress] = useState(35)

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => (p >= 100 ? 0 : p + 0.5))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <LiveActivity
      type="music"
      title="Midnight City"
      subtitle="M83 · Hurry Up, We're Dreaming"
      progress={progress}
      metadata={{ time: "2:34" }}
    />
  )
}

// Delivery Activity
export function DeliveryActivity() {
  return (
    <LiveActivity
      type="delivery"
      title="Package arriving today"
      subtitle="Out for delivery"
      progress={75}
      metadata={{
        eta: "2:30 PM",
        stops: "3 stops away",
      }}
    />
  )
}
