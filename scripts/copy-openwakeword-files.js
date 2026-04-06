import fs from 'fs'
import path from 'path'

const PUBLIC_DIR = path.join(process.cwd(), 'public')
const OPENWAKEWORD_DIR = path.join(PUBLIC_DIR, 'openwakeword')
const MODELS_DIR = path.join(OPENWAKEWORD_DIR, 'models')

// Create directories if they don't exist
if (!fs.existsSync(MODELS_DIR)) {
  fs.mkdirSync(MODELS_DIR, { recursive: true })
}

// Copy OpenWakeWord model files
const modelFiles = [
  {
    from: path.join(process.cwd(), 'node_modules', 'openwakeword-wasm-browser', 'models', 'alexa.onnx'),
    to: path.join(MODELS_DIR, 'alexa.onnx')
  },
  {
    from: path.join(process.cwd(), 'node_modules', 'openwakeword-wasm-browser', 'models', 'embedding_model.onnx'),
    to: path.join(MODELS_DIR, 'embedding_model.onnx')
  },
  {
    from: path.join(process.cwd(), 'node_modules', 'openwakeword-wasm-browser', 'models', 'hey_jarvis.onnx'),
    to: path.join(MODELS_DIR, 'hey_jarvis.onnx')
  },
  {
    from: path.join(process.cwd(), 'node_modules', 'openwakeword-wasm-browser', 'models', 'melspectrogram.onnx'),
    to: path.join(MODELS_DIR, 'melspectrogram.onnx')
  }
]

// Copy model files
modelFiles.forEach(({ from, to }) => {
  if (fs.existsSync(from)) {
    fs.copyFileSync(from, to)
    console.log(`Copied OpenWakeWord model: ${path.basename(from)}`)
  } else {
    console.warn(`OpenWakeWord model not found: ${from}`)
  }
})

console.log('OpenWakeWord model files copied successfully!')
