# OpenWakeWord Models

This directory contains ONNX models for the open-source OpenWakeWord library.

## Available Models

- `alexa.onnx` - "Alexa" wake word (currently active)
- `hey_jarvis.onnx` - "Hey Jarvis" wake word  
- `embedding_model.onnx` - Audio embedding model (required)
- `melspectrogram.onnx` - Mel spectrogram model (required)

## How to Change Wake Word

Edit `components/wakeword-frame.tsx` and change the keywords array:

```typescript
const engine = React.useMemo(() => new WakeWordEngine({
  baseAssetUrl: '/openwakeword/models',
  keywords: ['alexa'], // Change this to your preferred wake word
  detectionThreshold: 0.5,
  cooldownMs: 2000
}), [])
```

## Available Wake Words

Common wake words that have pre-trained models:
- `alexa` - Amazon Alexa
- `hey_mycroft` - Mycroft AI assistant
- `hey_jarvis` - Marvel's AI assistant
- `timer` - Timer activation
- `weather` - Weather activation

Download more models from: https://github.com/dscripka/openWakeWord/releases

## Troubleshooting

If you get "protobuf parsing failed" errors:
1. Check that the ONNX file downloaded completely
2. Verify the model file isn't corrupted
3. Try a different wake word model
4. Ensure browser supports WebAssembly
