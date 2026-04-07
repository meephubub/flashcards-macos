import { NextRequest } from "next/server"

export async function POST(req: NextRequest) {
  const body = await req.formData()
  const file = body.get("files") as File | null

  const backendFormData = new FormData()
  if (file) {
    backendFormData.append("files", file, file.name || "recording.wav")
  }

  try {
    const backendRes = await fetch("http://localhost:8000/chat/stream", {
      method: "POST",
      body: backendFormData,
      headers: {
        // Don't set Content-Type; fetch handles multipart boundary
      },
    })

    if (!backendRes.ok) {
      const errText = await backendRes.text()
      console.error("Backend error:", backendRes.status, errText)
      return new Response(`Error: Backend responded ${backendRes.status}`, {
        status: backendRes.status,
        statusText: backendRes.statusText,
      })
    }

    // Stream the SSE response back to the client
    const reader = backendRes.body?.getReader()
    if (!reader) {
      return new Response("Error: No response body from backend", { status: 500 })
    }

    const abortController = new AbortController()
    const encoder = new TextEncoder()
    let aborted = false

    const stream = new ReadableStream({
      async start(controller) {
        req.signal.addEventListener("abort", () => {
          aborted = true
          abortController.abort()
        })
        try {
          while (true) {
            if (aborted) break
            const { done, value } = await reader.read()
            if (done) break
            if (!aborted) {
              controller.enqueue(value)
            }
          }
        } catch (e) {
          console.error("Streaming error:", e)
          if (!aborted) {
            controller.error(e)
          }
        } finally {
          try {
            reader.releaseLock?.()
          } catch {}
          if (!aborted) {
            controller.close()
          }
        }
      },
      cancel() {
        aborted = true
        abortController.abort()
        try {
          reader.cancel?.()
        } catch {}
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    })
  } catch (e) {
    console.error("Proxy fetch error:", e)
    return new Response(`Error: Could not reach backend. ${e instanceof Error ? e.message : String(e)}`, {
      status: 502,
    })
  }
}
