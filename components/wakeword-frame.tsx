"use client"

import * as React from "react"

import { SiriGlowClock } from "./siri-glow-clock"
import { Markdown } from "./ui/markdown"
// @ts-ignore - No types available for this package
import WakeWordEngine from "openwakeword-wasm-browser"

export function WakewordFrame() {
  const [active, setActive] = React.useState(false)
  const [supported, setSupported] = React.useState(true)
  const [activity, setActivity] = React.useState(0)
  const [micStatus, setMicStatus] = React.useState<"idle" | "requesting" | "active" | "denied">(
    "idle",
  )

  const [systemPrompt, setSystemPrompt] = React.useState<string>("")
  const [streamResponse, setStreamResponse] = React.useState<string>("")
  const [isStreaming, setIsStreaming] = React.useState(false)
  const [streamError, setStreamError] = React.useState<string | null>(null)
  const [ttsEnabled, setTtsEnabled] = React.useState(false)

  const vadRef = React.useRef<any | null>(null)
  const stopTimerRef = React.useRef<number | null>(null)
  const shouldSendToAgentRef = React.useRef(false)
  const abortControllerRef = React.useRef<AbortController | null>(null)
  const ttsRef = React.useRef<any | null>(null)
  const ttsQueueRef = React.useRef<string[]>([])
  const ttsPlayingRef = React.useRef(false)
  const ttsSplitterRef = React.useRef<any | null>(null)
  const engine = React.useMemo(() => new WakeWordEngine({
    baseAssetUrl: '/openwakeword/models',
    keywords: ['alexa'],
    detectionThreshold: 0.5,
    cooldownMs: 2000
  }), [])

  const sendAudioToAgent = React.useCallback(async (audio: Float32Array) => {
    const wav = await (async () => {
      const numChannels = 1
      const bytesPerSample = 2
      const blockAlign = numChannels * bytesPerSample
      const byteRate = 16000 * blockAlign
      const dataSize = audio.length * bytesPerSample

      const buffer = new ArrayBuffer(44 + dataSize)
      const view = new DataView(buffer)

      const writeString = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
      }

      writeString(0, "RIFF")
      view.setUint32(4, 36 + dataSize, true)
      writeString(8, "WAVE")
      writeString(12, "fmt ")
      view.setUint32(16, 16, true)
      view.setUint16(20, 1, true)
      view.setUint16(22, numChannels, true)
      view.setUint32(24, 16000, true)
      view.setUint32(28, byteRate, true)
      view.setUint16(32, blockAlign, true)
      view.setUint16(34, 16, true)
      writeString(36, "data")
      view.setUint32(40, dataSize, true)

      let offset = 44
      for (let i = 0; i < audio.length; i++) {
        const s = Math.max(-1, Math.min(1, audio[i]))
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
        offset += 2
      }

      return new Blob([buffer], { type: "audio/wav" })
    })()

    const formData = new FormData()
    formData.append("files", wav, "recording.wav")
    if (systemPrompt.trim()) {
      formData.append("text", systemPrompt.trim())
    }

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      setIsStreaming(true)
      setStreamResponse("")

      const res = await fetch("/api/proxy/chat/stream", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      })

      if (!res.ok) {
        throw new Error(`Agent responded ${res.status}`)
      }

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error("No response body")
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split("\n")

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const payload = line.slice(6)
            if (payload === "[DONE]") {
              return
            }
            setStreamResponse(payload)
            if (ttsEnabled && ttsSplitterRef.current) {
              const tokens = payload.match(/\s*\S+/g) || []
              ttsQueueRef.current.push(...tokens)
              processTTSQueue()
            }
          }
        }
      }
    } catch (e) {
      console.error("Agent stream error:", e)
      setStreamError(e instanceof Error ? e.message : String(e))
    } finally {
      setIsStreaming(false)
      abortControllerRef.current = null
    }
  }, [systemPrompt])

  const initTTS = React.useCallback(async () => {
    if (ttsRef.current) return
    try {
      const { KokoroTTS, TextSplitterStream } = await import("kokoro-js")
      const model_id = "onnx-community/Kokoro-82M-v1.0-ONNX"
      ttsRef.current = await KokoroTTS.from_pretrained(model_id, {
        dtype: "fp32",
      })
      ttsSplitterRef.current = new TextSplitterStream()
      const stream = ttsRef.current.stream(ttsSplitterRef.current)
      ;(async () => {
        for await (const { audio } of stream) {
          const buf = await audio.arrayBuffer()
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
          const audioBuffer = await audioCtx.decodeAudioData(buf)
          const source = audioCtx.createBufferSource()
          source.buffer = audioBuffer
          source.connect(audioCtx.destination)
          source.onended = () => {
            ttsPlayingRef.current = false
            processTTSQueue()
          }
          ttsPlayingRef.current = true
          source.start(0)
        }
      })()
    } catch (e) {
      console.error("Failed to init TTS:", e)
    }
  }, [])

  const processTTSQueue = React.useCallback(() => {
    if (!ttsEnabled || !ttsRef.current || !ttsSplitterRef.current || ttsPlayingRef.current || ttsQueueRef.current.length === 0) return
    const next = ttsQueueRef.current.shift()
    if (next) {
      ttsSplitterRef.current.push(next)
      ttsSplitterRef.current.flush()
    }
  }, [ttsEnabled])

  React.useEffect(() => {
    if (ttsEnabled) {
      void initTTS()
    }
  }, [ttsEnabled, initTTS])

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
    shouldSendToAgentRef.current = false
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    setIsStreaming(false)
    setStreamError(null)
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
        onSpeechEnd: (audio: Float32Array) => {
          if (shouldSendToAgentRef.current) {
            void sendAudioToAgent(audio)
          }
          void deactivate()
        },
        onVADMisfire: () => {
          void deactivate()
        },
        onFrameProcessed: (_probs: any, frame: any) => {
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
  }, [clearStopTimer, deactivate, sendAudioToAgent])

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
        try {
          const ort = await import("onnxruntime-web")
          const anyEngine = engine as any
          const vadModel = anyEngine?._vadModel
          if (vadModel?.inputNames?.includes("state")) {
            const stateName = "state"
            const meta = vadModel.inputMetadata?.[stateName]
            const shape = Array.isArray(meta?.shape) ? meta.shape : [2, 1, 128]
            const size = shape.reduce((acc: number, d: unknown) => {
              return acc * (typeof d === "number" && Number.isFinite(d) ? d : 1)
            }, 1)

            anyEngine._vadState = anyEngine._vadState ?? {}
            anyEngine._vadState.state = new ort.Tensor(
              "float32",
              new Float32Array(size).fill(0),
              shape,
            )

            anyEngine._runVad = async (chunk: Float32Array) => {
              try {
                const tensor = new ort.Tensor("float32", chunk, [1, chunk.length])
                const sr = new ort.Tensor("int64", [BigInt(anyEngine.config.sampleRate)], [])
                const res = await vadModel.run({ input: tensor, sr, state: anyEngine._vadState.state })

                if (res?.state) {
                  anyEngine._vadState.state = res.state
                }

                const outputName = vadModel.outputNames?.find((n: string) => n !== "state") ?? "output"
                const confidence = res?.[outputName]?.data?.[0] ?? res?.output?.data?.[0]
                return typeof confidence === "number" ? confidence > 0.5 : false
              } catch (err) {
                anyEngine._emitter?.emit?.("error", err)
                return false
              }
            }
          }
        } catch (e) {
          console.warn("Wake word VAD patch skipped:", e)
        }

        try {
          const anyEngine = engine as any
          const origStart = anyEngine.start?.bind(anyEngine)
          if (typeof origStart === "function") {
            anyEngine.start = async (
              opts: { deviceId?: string; gain?: number } = {},
            ) => {
              const { deviceId, gain = 1.0 } = opts
              if (!anyEngine._loaded) throw new Error("Call load() before start()")
              if (anyEngine._workletNode) return

              anyEngine._resetState?.()
              anyEngine._mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: deviceId ? { deviceId: { exact: deviceId } } : true,
              })

              const ctx = new AudioContext({ sampleRate: anyEngine.config.sampleRate })
              anyEngine._audioContext = ctx
              try {
                await ctx.resume()
              } catch {}

              const source = ctx.createMediaStreamSource(anyEngine._mediaStream)
              const gainNode = ctx.createGain()
              gainNode.gain.value = gain
              anyEngine._gainNode = gainNode

              const processor = ctx.createScriptProcessor(0, 1, 1)
              let buf = new Float32Array(1280)
              let pos = 0

              processor.onaudioprocess = (ev: AudioProcessingEvent) => {
                const input = ev.inputBuffer.getChannelData(0)
                for (let i = 0; i < input.length; i++) {
                  buf[pos++] = input[i]
                  if (pos === buf.length) {
                    const chunk = buf
                    buf = new Float32Array(1280)
                    pos = 0
                    anyEngine._processingQueue = anyEngine._processingQueue
                      .then(() => anyEngine._processChunk(chunk))
                      .catch((e: unknown) => {
                        anyEngine._emitter.emit("error", e)
                      })
                  }
                }
              }

              anyEngine._workletNode = processor

              source.connect(gainNode)
              gainNode.connect(processor)
              processor.connect(ctx.destination)
            }
          }
        } catch (e) {
          console.warn("Wake word worklet patch skipped:", e)
        }

        try {
          const anyEngine = engine as any
          const origStop = anyEngine.stop?.bind(anyEngine)
          if (typeof origStop === "function") {
            anyEngine.stop = async () => {
              const node = anyEngine._workletNode
              if (node) {
                try {
                  if (node.port) node.port.onmessage = null
                } catch {}
                try {
                  node.disconnect()
                } catch {}
                anyEngine._workletNode = null
              }
              if (anyEngine._gainNode) {
                try {
                  anyEngine._gainNode.disconnect()
                } catch {}
                anyEngine._gainNode = null
              }
              if (anyEngine._audioContext && anyEngine._audioContext.state !== "closed") {
                try {
                  await anyEngine._audioContext.close()
                } catch {}
              }
              anyEngine._audioContext = null
              if (anyEngine._mediaStream) {
                try {
                  anyEngine._mediaStream.getTracks().forEach((track: MediaStreamTrack) => track.stop())
                } catch {}
                anyEngine._mediaStream = null
              }
              anyEngine._isDetectionCoolingDown = false
            }
          }
        } catch (e) {
          console.warn("Wake word stop patch skipped:", e)
        }

        console.log('Wake word engine loaded successfully')
        unsubs.push(engine.on('detect', ({ keyword, score }: { keyword: string; score: number }) => {
          console.log(`Wake word detected: ${keyword} (${score})`)
          shouldSendToAgentRef.current = true
          void activate()
        }))
        unsubs.push(engine.on('error', (err: any) => {
          console.error('Wake word engine error:', err)
        }))
        unsubs.push(engine.on('ready', () => {
          console.log('Wake word engine is ready and listening')
        }))

        const startEngine = async () => {
          try {
            console.log('Starting wake word engine...')
            await engine.start()
            console.log('Wake word engine started')
          } catch (err) {
            console.error('Wake word engine start failed:', err)
            throw err
          }
        }

        const onFirstGesture = () => {
          window.removeEventListener('pointerdown', onFirstGesture)
          window.removeEventListener('keydown', onFirstGesture)
          void startEngine()
        }

        window.addEventListener('pointerdown', onFirstGesture)
        window.addEventListener('keydown', onFirstGesture)

        try {
          await startEngine()
          window.removeEventListener('pointerdown', onFirstGesture)
          window.removeEventListener('keydown', onFirstGesture)
        } catch {}
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
      const isCtrlO = ctrlOrMeta && key === "o"

      if (isCtrlO) {
        e.preventDefault()
        e.stopPropagation()
        setTtsEnabled((v) => !v)
        return
      }

      if (!isCtrlB && !isCtrlShiftB) return
      e.preventDefault()
      e.stopPropagation()
      shouldSendToAgentRef.current = true
      void activate()
      // Immediately start VAD for manual activation
      if (vadRef.current) {
        try {
          void vadRef.current.start()
        } catch {
          // ignore
        }
      }
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
            <div className="mt-4 max-w-2xl mx-auto">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                System prompt (optional)
              </label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="You are a helpful assistant."
                className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                rows={2}
              />
            </div>
            {streamResponse && (
              <div className="mt-4 max-w-2xl mx-auto">
                <div className="rounded-lg border bg-muted p-4">
                  <div className="mb-2 text-xs font-medium text-muted-foreground">
                    {isStreaming ? "Agent is responding..." : streamError ? "Error" : "Agent response"}
                  </div>
                  <Markdown className="text-sm leading-relaxed">
                    {streamResponse}
                  </Markdown>
                  {streamError && (
                    <button
                      type="button"
                      className="mt-2 text-xs text-blue-600 underline hover:text-blue-800"
                      onClick={() => {
                        setStreamError(null)
                        setStreamResponse("")
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            )}
            {isStreaming && (
              <div className="mt-2 text-center text-xs text-muted-foreground animate-pulse">
                Waiting for agent stream...
              </div>
            )}
            <div className="mt-2 text-center text-xs text-foreground/45">
              Say "Alexa" to activate &bull; Shortcut: Ctrl+B &bull; {ttsEnabled ? "TTS ON" : "TTS OFF"} (Ctrl+O)
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
