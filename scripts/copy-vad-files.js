import fs from 'fs'
import path from 'path'
import { glob } from 'glob'

const PUBLIC_DIR = path.join(process.cwd(), 'public')
const VAD_DIR = path.join(PUBLIC_DIR, 'vad')

// Create directories if they don't exist
if (!fs.existsSync(VAD_DIR)) {
  fs.mkdirSync(VAD_DIR, { recursive: true })
}

// Copy VAD files
const vadFiles = [
  {
    from: path.join(process.cwd(), 'node_modules', '@ricky0123', 'vad-web', 'dist', 'vad.worklet.bundle.min.js'),
    to: path.join(VAD_DIR, 'vad.worklet.bundle.min.js')
  },
  {
    from: path.join(process.cwd(), 'node_modules', '@ricky0123', 'vad-web', 'dist', 'silero_vad_legacy.onnx'),
    to: path.join(VAD_DIR, 'silero_vad_legacy.onnx')
  },
  {
    from: path.join(process.cwd(), 'node_modules', '@ricky0123', 'vad-web', 'dist', 'silero_vad_v5.onnx'),
    to: path.join(VAD_DIR, 'silero_vad_v5.onnx')
  }
]

// Copy ONNX Runtime files
const onnxDir = path.join(PUBLIC_DIR, 'onnx')
if (!fs.existsSync(onnxDir)) {
  fs.mkdirSync(onnxDir, { recursive: true })
}

const onnxFiles = [
  {
    pattern: path.join(process.cwd(), 'node_modules', 'onnxruntime-web', 'dist', '*.wasm'),
    dir: onnxDir
  },
  {
    pattern: path.join(process.cwd(), 'node_modules', 'onnxruntime-web', 'dist', '*.mjs'),
    dir: onnxDir
  }
]

// Copy VAD files
vadFiles.forEach(({ from, to }) => {
  if (fs.existsSync(from)) {
    fs.copyFileSync(from, to)
    console.log(`Copied: ${path.basename(from)}`)
  } else {
    console.warn(`Not found: ${from}`)
  }
})

// Copy ONNX Runtime files
for (const { pattern, dir } of onnxFiles) {
  try {
    const files = glob.sync(pattern)
    console.log(`Found ${files.length} files for pattern: ${pattern}`)
    files.forEach(file => {
      const filename = path.basename(file)
      fs.copyFileSync(file, path.join(dir, filename))
      console.log(`Copied ONNX: ${filename}`)
    })
  } catch (error) {
    console.error(`Error copying files for pattern ${pattern}:`, error)
  }
}

console.log('VAD and ONNX Runtime files copied successfully!')
