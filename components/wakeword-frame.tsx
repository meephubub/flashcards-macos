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

  const vadRef = React.useRef<any | null>(null)
  const stopTimerRef = React.useRef<number | null>(null)
  const activatedByWakewordRef = React.useRef(false)
  const engine = React.useMemo(() => new WakeWordEngine({
    baseAssetUrl: '/openwakeword/models',
    keywords: ['alexa'],
    detectionThreshold: 0.5,
    cooldownMs: 2000
  }), [])

  const downloadWav = React.useCallback((audio: Float32Array, sampleRate: number) => {
    const numChannels = 1
    const bytesPerSample = 2
    const blockAlign = numChannels * bytesPerSample
    const byteRate = sampleRate * blockAlign
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
    view.setUint32(24, sampleRate, true)
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

    const blob = new Blob([buffer], { type: "audio/wav" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `vad-${new Date().toISOString().replace(/[:.]/g, "-")}.wav`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }, [])

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
    activatedByWakewordRef.current = false
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
        onSpeechEnd: (audio) => {
          if (activatedByWakewordRef.current) {
            try {
              downloadWav(audio, 16000)
            } catch (e) {
              console.error("Failed to download VAD audio:", e)
            }
          }
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

              anyEngine._audioContext = new AudioContext({ sampleRate: anyEngine.config.sampleRate })
              try {
                await anyEngine._audioContext.resume()
              } catch {}
              if (!anyEngine._audioContext.audioWorklet) {
                throw new Error("AudioWorklet is not supported in this browser")
              }
              const source = anyEngine._audioContext.createMediaStreamSource(anyEngine._mediaStream)
              anyEngine._gainNode = anyEngine._audioContext.createGain()
              anyEngine._gainNode.gain.value = gain

              const AUDIO_PROCESSOR_COMPAT = `
class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 1280;
    this._buffer = new Float32Array(this.bufferSize);
    this._pos = 0;
  }
  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (input) {
      for (let i = 0; i < input.length; i++) {
        this._buffer[this._pos++] = input[i];
        if (this._pos === this.bufferSize) {
          this.port.postMessage(this._buffer);
          this._pos = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('audio-processor', AudioProcessor);
`

              const blob = new Blob([AUDIO_PROCESSOR_COMPAT], { type: "application/javascript" })
              const workletURL = URL.createObjectURL(blob)
              try {
                try {
                  await anyEngine._audioContext.audioWorklet.addModule(workletURL)
                } catch (err) {
                  console.error("AudioWorklet addModule failed:", err)
                  throw err
                }
              } finally {
                URL.revokeObjectURL(workletURL)
              }

              let sinkNode: AudioNode
              try {
                anyEngine._workletNode = new AudioWorkletNode(anyEngine._audioContext, "audio-processor")
                anyEngine._workletNode.port.onmessage = (event: MessageEvent) => {
                  const chunk = (event as any).data
                  if (!chunk) return
                  anyEngine._processingQueue = anyEngine._processingQueue
                    .then(() => anyEngine._processChunk(chunk))
                    .catch((err: unknown) => {
                      anyEngine._emitter.emit("error", err)
                    })
                }
                sinkNode = anyEngine._workletNode
              } catch (err) {
                console.error("AudioWorkletNode creation failed:", err)

                const processor = anyEngine._audioContext.createScriptProcessor(0, 1, 1)
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
                sinkNode = processor
              }

              source.connect(anyEngine._gainNode)
              anyEngine._gainNode.connect(sinkNode)
              sinkNode.connect(anyEngine._audioContext.destination)
            }
          }
        } catch (e) {
          console.warn("Wake word worklet patch skipped:", e)
        }

        console.log('Wake word engine loaded successfully')
        unsubs.push(engine.on('detect', ({ keyword, score }: { keyword: string; score: number }) => {
          console.log(`Wake word detected: ${keyword} (${score})`)
          activatedByWakewordRef.current = true
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
        } catch {
        }
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
      activatedByWakewordRef.current = false
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

