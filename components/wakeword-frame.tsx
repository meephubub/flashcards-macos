"use client"

import * as React from "react"

import { SiriGlowClock } from "./siri-glow-clock"
// @ts-ignore - No types available for this package
import WakeWordEngine from "openwakeword-wasm-browser"

export function WakewordFrame() {
  const [active, setActive] = React.useState(false)
  const [supported, setSupported] = React.useState(true)
  const [activity, setActivity] = React.useState(0)
  const [micStatus, setMicStatus] = React.useState<"idle" | "requesting" | "active" | "denied">(
    "idle",
  )
  const [detected, setDetected] = React.useState<string | null>(null)

  const vadRef = React.useRef<any | null>(null)
  const stopTimerRef = React.useRef<number | null>(null)
  const engine = React.useMemo(() => new WakeWordEngine({
    baseAssetUrl: '/openwakeword/models',
    keywords: ['alexa'],
    detectionThreshold: 0.5,
    cooldownMs: 2000
  }), [])

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
      const { MicVAD } = await import("@ricky0123/vad-web")
      console.log("Initializing VAD with public directories")
      
      // Configure ONNX Runtime to use public directory
      const ort = await import("onnxruntime-web")
      ort.env.wasm.wasmPaths = "/onnx/"
      
      const vad = await MicVAD.new({
        baseAssetPath: "/vad/",
        onnxWASMBasePath: "/onnx/",
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
          // Smooth + clamp into a UI-friendly 0..1 range with reduced sensitivity
          setActivity((prev) => {
            const next = Math.max(prev * 0.9, Math.min(1, rms * 2.0))
            return next
          })
        },
      })
      vadRef.current = vad
      await vad.start()
      setMicStatus("active")
    } catch (error) {
      console.error("VAD initialization failed:", error)
      setMicStatus("denied")
    }
  }, [clearStopTimer, deactivate])

  React.useEffect(() => {
    return () => {
      void deactivate()
    }
  }, [deactivate])

  React.useEffect(() => {
    const unsubs: (() => void)[] = []

    const start = async () => {
      try {
        console.log('Loading wake word engine...')
        await engine.load()
        console.log('Wake word engine loaded successfully')
        unsubs.push(engine.on('detect', ({ keyword, score }: { keyword: string; score: number }) => {
          console.log(`Wake word detected: ${keyword} (${score})`)
          setDetected(`${keyword} (${score.toFixed(2)})`)
          void activate()
        }))
        unsubs.push(engine.on('error', (err: any) => {
          console.error('Wake word engine error:', err)
        }))
        unsubs.push(engine.on('ready', () => {
          console.log('Wake word engine is ready and listening')
        }))
        console.log('Starting wake word engine...')
        await engine.start()
        console.log('Wake word engine started')
        setSupported(true)
      } catch (error) {
        console.error('Failed to load wake word engine:', error)
        setSupported(false)
      }
    }

    void start()

    return () => {
      unsubs.forEach(unsub => unsub())
      engine.stop()
    }
  }, [engine, activate])

  const v = Math.max(0, Math.min(1, activity))
  const borderPadPx = Math.round(8 + v * 12)
  const borderBlurPx = Math.round(8 + v * 8)
  const blobBlurPx = Math.round(24 + v * 20)
  const blobOpacity = (0.4 + v * 0.3).toFixed(3)
  const blobScale = (1 + v * 0.08).toFixed(3)

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
            <SiriGlowClock active={active} />
            {!supported ? (
              <div className="mt-4 text-center text-sm text-foreground/55">
                Wake word engine not ready. (Missing models or unsupported browser.)
              </div>
            ) : null}
            {detected && (
              <div className="mt-4 text-center text-sm text-green-600">
                Detected: {detected}
              </div>
            )}
            <div className="mt-2 text-center text-xs text-foreground/45">
              Say "Alexa" to activate • Shortcut: Ctrl+B
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

