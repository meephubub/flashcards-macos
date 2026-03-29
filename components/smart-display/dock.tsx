"use client"

import { useState } from "react"
import { Clock, CalendarDays, Cloud, Zap } from "lucide-react"
import { cn } from "@/lib/utils"

type Page = "home" | "calendar" | "weather" | "activities"

interface DockItem {
  id: Page
  label: string
  icon: React.ReactNode
}

const items: DockItem[] = [
  { id: "home",       label: "Clock",      icon: <Clock className="h-7 w-7" /> },
  { id: "calendar",   label: "Calendar",   icon: <CalendarDays className="h-7 w-7" /> },
  { id: "weather",    label: "Weather",    icon: <Cloud className="h-7 w-7" /> },
  { id: "activities", label: "Activities", icon: <Zap className="h-7 w-7" /> },
]

interface DockProps {
  activePage: Page
  onNavigate: (page: Page) => void
}

export function Dock({ activePage, onNavigate }: DockProps) {
  const [hovered, setHovered] = useState<Page | null>(null)

  return (
    <div className="fixed bottom-6 inset-x-0 flex justify-center pointer-events-none z-50">
      <nav
        className="pointer-events-auto flex items-end gap-3 px-5 py-3 rounded-2xl border border-border/60 bg-background/70 backdrop-blur-xl shadow-2xl"
        aria-label="Main navigation"
      >
        {items.map((item) => {
          const isActive = activePage === item.id
          const isHovered = hovered === item.id

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              onMouseEnter={() => setHovered(item.id)}
              onMouseLeave={() => setHovered(null)}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group relative flex flex-col items-center gap-1 transition-all duration-200 ease-out",
                isHovered ? "-translate-y-3" : "translate-y-0"
              )}
            >
              {/* Tooltip */}
              <span
                className={cn(
                  "absolute -top-9 left-1/2 -translate-x-1/2 text-xs font-medium px-2 py-1 rounded-md bg-foreground text-background whitespace-nowrap transition-all duration-150",
                  isHovered ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
                )}
              >
                {item.label}
              </span>

              {/* Icon container */}
              <div
                className={cn(
                  "flex items-center justify-center w-14 h-14 rounded-2xl border transition-all duration-200",
                  isActive
                    ? "bg-foreground text-background border-foreground"
                    : "bg-muted text-muted-foreground border-transparent hover:border-border hover:text-foreground hover:bg-muted/80"
                )}
              >
                {item.icon}
              </div>

              {/* Active indicator dot */}
              <span
                className={cn(
                  "w-1 h-1 rounded-full bg-foreground transition-all duration-200",
                  isActive ? "opacity-100" : "opacity-0"
                )}
              />
            </button>
          )
        })}
      </nav>
    </div>
  )
}
