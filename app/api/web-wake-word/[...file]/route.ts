import { readFile } from "node:fs/promises"
import path from "node:path"

const DIST_DIR = path.join(process.cwd(), "node_modules", "web-wake-word", "dist")

function contentTypeFor(file: string) {
  if (file.endsWith(".wasm")) return "application/wasm"
  if (file.endsWith(".mjs")) return "text/javascript; charset=utf-8"
  if (file.endsWith(".js")) return "text/javascript; charset=utf-8"
  if (file.endsWith(".d.ts")) return "text/plain; charset=utf-8"
  if (file.endsWith(".map")) return "application/json; charset=utf-8"
  return "application/octet-stream"
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ file: string[] }> },
) {
  const { file } = await params
  const rel = file.join("/")

  // Prevent path traversal
  if (rel.includes("..")) return new Response("Invalid path", { status: 400 })

  const abs = path.join(DIST_DIR, rel)

  try {
    const buf = await readFile(abs)
    return new Response(buf, {
      headers: {
        "content-type": contentTypeFor(rel),
        "cache-control": "public, max-age=31536000, immutable",
      },
    })
  } catch {
    return new Response("Not found", { status: 404 })
  }
}

