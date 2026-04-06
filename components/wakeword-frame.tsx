"use client"

import * as React from "react"

import { SiriGlowClock } from "./siri-glow-clock"
import { KeywordDetector } from "web-wake-word"
import { MicVAD } from "@ricky0123/vad-web"

export function WakewordFrame() {
  const [active, setActive] = React.useState(false)
  const [supported, setSupported] = React.useState(true)
  const [activity, setActivity] = React.useState(0)
  const [micStatus, setMicStatus] = React.useState<"idle" | "requesting" | "active" | "denied">(
    "idle",
  )

  const vadRef = React.useRef<MicVAD | null>(null)
  const stopTimerRef = React.useRef<number | null>(null)

  const clearStopTimer = React.useCallback(() => {
    if (stopTimerRef.current) {
      window.clearTimeout(stopTimerRef.current)
      stopTimerRef.current = null
    }
  }, [])

  const deactivate = React.useCallback(async () => {
    clearStopTimer()
    setActive(false)
    setActivity(0)
    setMicStatus("idle")
    if (vadRef.current) {
      try {
        await vadRef.current.destroy()
      } catch {
        // ignore
      }
      vadRef.current = null
    }
  }, [clearStopTimer])

  const activate = React.useCallback(async () => {
    setActive(true)
    setMicStatus("requesting")
    clearStopTimer()

    // If we never detect speech, auto-hide after a short grace period.
    stopTimerRef.current = window.setTimeout(() => {
      void deactivate()
    }, 5000)

    if (vadRef.current) {
      try {
        await vadRef.current.start()
        setMicStatus("active")
      } catch {
        setMicStatus("denied")
      }
      return
    }

    try {
      const vad = await MicVAD.new({
        baseAssetPath: "/api/vad/",
        onSpeechStart: () => {
          clearStopTimer()
        },
        onSpeechEnd: () => {
          void deactivate()
        },
        onVADMisfire: () => {
          void deactivate()
        },
        onFrameProcessed: (_probs, frame) => {
          let sum = 0
          for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i]
          const rms = Math.sqrt(sum / frame.length)
          // Smooth + clamp into a UI-friendly 0..1 range.
          setActivity((prev) => {
            const next = Math.max(prev * 0.82, Math.min(1, rms * 4.5))
            return next
          })
        },
      })
      vadRef.current = vad
      await vad.start()
      setMicStatus("active")
    } catch {
      setMicStatus("denied")
    }
  }, [clearStopTimer, deactivate])

  React.useEffect(() => {
    return () => {
      void deactivate()
    }
  }, [deactivate])

  React.useEffect(() => {
    let detector: KeywordDetector | null = null
    let cancelled = false

    async function start() {
      try {
        // IMPORTANT: web-wake-word requires ONNX models. Put these in:
        // public/wakewords/{embedding_model.onnx,melspectrogram.onnx,hey.onnx}
        detector = new KeywordDetector(
          "/wakewords",
          [
            {
              modelToUse: "hey.onnx",
              threshold: 0.7,
              bufferCount: 3,
              onKeywordDetected: () => void activate(),
            },
          ],
          "/api/web-wake-word/",
          "/api/web-wake-word/",
        )
        await detector.init()
        if (cancelled) return
        setSupported(true)
        detector.startListening()
      } catch {
        if (cancelled) return
        setSupported(false)
      }
    }

    void start()

    return () => {
      cancelled = true
      try {
        detector?.stopListening()
      } catch {
        // ignore
      }
    }
  }, [activate])

  const v = Math.max(0, Math.min(1, activity))
  const borderPadPx = Math.round(10 + v * 26)
  const borderBlurPx = Math.round(10 + v * 20)
  const blobBlurPx = Math.round(28 + v * 36)
  const blobOpacity = (0.5 + v * 0.45).toFixed(3)
  const blobScale = (1 + v * 0.12).toFixed(3)

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      const ctrlOrMeta = e.ctrlKey || e.metaKey

      // Note: many browsers reserve Ctrl+B for bookmarks. We still listen for it,
      // but also support Ctrl+Shift+B as a reliable fallback.
      const isCtrlB = ctrlOrMeta && key === "b"
      const isCtrlShiftB = ctrlOrMeta && e.shiftKey && key === "b"

      if (!isCtrlB && !isCtrlShiftB) return
      e.preventDefault()
      e.stopPropagation()
      void activate()
    }

    document.addEventListener("keydown", onKeyDown, { capture: true })
    return () => document.removeEventListener("keydown", onKeyDown, { capture: true })
  }, [activate])

  return (
    <>
      <div
        className={`siri-screen-border${active ? " is-active" : ""}`}
        style={
          {
            ["--siri-border-pad" as never]: `${borderPadPx}px`,
            ["--siri-border-blur" as never]: `${borderBlurPx}px`,
            ["--siri-blob-blur" as never]: `${blobBlurPx}px`,
            ["--siri-blob-opacity" as never]: blobOpacity,
            ["--siri-blob-scale" as never]: blobScale,
          } as React.CSSProperties
        }
        aria-hidden="true"
      />
      <main className="min-h-dvh bg-background text-foreground">
        <div className="mx-auto flex min-h-dvh max-w-3xl items-center justify-center px-6">
          <div className="w-full">
            <SiriGlowClock />
            {!supported ? (
              <div className="mt-4 text-center text-sm text-foreground/55">
                Wakeword not ready. (Missing models or unsupported browser.)
              </div>
            ) : null}
            <div className="mt-2 text-center text-xs text-foreground/45">
              Shortcut: Ctrl+B (may be reserved by your browser), fallback Ctrl+Shift+B.
            </div>
            {active ? (
              <div className="mt-2 text-center text-xs text-foreground/45">
                Voice activity: {micStatus === "active" ? `${Math.round(v * 100)}%` : micStatus}
              </div>
            ) : null}
          </div>
        </div>
      </main>
    </>
  )
}

