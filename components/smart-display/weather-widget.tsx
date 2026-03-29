"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Cloud, Sun, CloudRain, Snowflake, Wind } from "lucide-react"

interface WeatherData {
  temp: number
  condition: "sunny" | "cloudy" | "rainy" | "snowy" | "windy"
  high: number
  low: number
  location: string
}

const mockWeather: WeatherData = {
  temp: 68,
  condition: "sunny",
  high: 72,
  low: 58,
  location: "San Francisco",
}

const weatherIcons = {
  sunny: <Sun className="h-12 w-12" />,
  cloudy: <Cloud className="h-12 w-12" />,
  rainy: <CloudRain className="h-12 w-12" />,
  snowy: <Snowflake className="h-12 w-12" />,
  windy: <Wind className="h-12 w-12" />,
}

export function WeatherWidget() {
  const { temp, condition, high, low, location } = mockWeather

  return (
    <Card className="border-border/50">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-5xl font-light">{temp}°</p>
            <p className="text-sm text-muted-foreground mt-1 capitalize">{condition}</p>
            <p className="text-xs text-muted-foreground mt-2">
              H: {high}° L: {low}°
            </p>
          </div>
          <div className="text-right">
            {weatherIcons[condition]}
            <p className="text-xs text-muted-foreground mt-2">{location}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
