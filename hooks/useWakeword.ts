"use client"

import * as React from "react"

type SpeechRecognitionLike = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: unknown) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function useWakeword({
  wakeword = "hey flashcards",
  enabled = true,
  holdMs = 2500,
}: {
  wakeword?: string
  enabled?: boolean
  holdMs?: number
}) {
  const [supported, setSupported] = React.useState(true)
  const [active, setActive] = React.useState(false)
  const [lastHeard, setLastHeard] = React.useState<string>("")

  const timeoutRef = React.useRef<number | null>(null)
  const recRef = React.useRef<SpeechRecognitionLike | null>(null)

  const clearHold = React.useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const trigger = React.useCallback(() => {
    setActive(true)
    clearHold()
    timeoutRef.current = window.setTimeout(() => setActive(false), holdMs)
  }, [clearHold, holdMs])

  React.useEffect(() => {
    if (!enabled) return

    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) {
      setSupported(false)
      return
    }
    setSupported(true)

    const rec = new Ctor()
    recRef.current = rec

    rec.continuous = true
    rec.interimResults = true
    rec.lang = "en-US"

    const normalizedWakeword = wakeword.trim().toLowerCase()

    rec.onresult = (event) => {
      const e = event as {
        resultIndex: number
        results: ArrayLike<ArrayLike<{ transcript?: string }>>
      }
      const result = e.results[e.resultIndex]
      if (!result) return
      const transcript = (result[0]?.transcript ?? "").trim()
      if (!transcript) return

      setLastHeard(transcript)
      if (transcript.toLowerCase().includes(normalizedWakeword)) trigger()
    }

    rec.onerror = () => {
      // If permission is denied or recognition fails, we just stop trying.
    }

    rec.onend = () => {
      // Chrome often ends recognition; restart while enabled.
      try {
        if (enabled) rec.start()
      } catch {
        // ignore
      }
    }

    try {
      rec.start()
    } catch {
      // ignore
    }

    return () => {
      clearHold()
      try {
        rec.onresult = null
        rec.onerror = null
        rec.onend = null
        rec.stop()
      } catch {
        // ignore
      } finally {
        recRef.current = null
      }
    }
  }, [clearHold, enabled, trigger, wakeword])

  return { active, supported, lastHeard, trigger }
}

