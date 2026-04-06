"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type MicState = "idle" | "requesting" | "active" | "denied" | "unsupported";

export interface MicVolumeOptions {
    fftSize?: number;
    smoothingTimeConstant?: number;
    minDecibels?: number;
    maxDecibels?: number;
}

export interface UseMicVolumeReturn {
    volume: number;           // 0–1 normalized RMS
    micState: MicState;
    start: () => Promise<void>;
    stop: () => void;
}

export function useMicVolume(options: MicVolumeOptions = {}): UseMicVolumeReturn {
    const {
        fftSize = 256,
        smoothingTimeConstant = 0.8,
        minDecibels = -80,
        maxDecibels = -10,
    } = options;

    const [volume, setVolume] = useState(0);
    const [micState, setMicState] = useState<MicState>("idle");

    const audioCtxRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const rafRef = useRef<number | null>(null);
    const dataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

    const tick = useCallback(() => {
        if (!analyserRef.current || !dataRef.current) return;

        analyserRef.current.getByteFrequencyData(dataRef.current);

        // RMS over frequency bins
        let sum = 0;
        const buf = dataRef.current;
        for (let i = 0; i < buf.length; i++) {
            const norm = buf[i] / 255;
            sum += norm * norm;
        }
        const rms = Math.sqrt(sum / buf.length);
        setVolume(rms);

        rafRef.current = requestAnimationFrame(tick);
    }, []);

    const start = useCallback(async () => {
        if (!navigator.mediaDevices?.getUserMedia) {
            setMicState("unsupported");
            return;
        }

        setMicState("requesting");

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            streamRef.current = stream;

            const ctx = new AudioContext();
            audioCtxRef.current = ctx;

            const analyser = ctx.createAnalyser();
            analyser.fftSize = fftSize;
            analyser.smoothingTimeConstant = smoothingTimeConstant;
            analyser.minDecibels = minDecibels;
            analyser.maxDecibels = maxDecibels;
            analyserRef.current = analyser;

            dataRef.current = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));

            const source = ctx.createMediaStreamSource(stream);
            source.connect(analyser);
            sourceRef.current = source;

            setMicState("active");
            rafRef.current = requestAnimationFrame(tick);
        } catch {
            setMicState("denied");
        }
    }, [fftSize, smoothingTimeConstant, minDecibels, maxDecibels, tick]);

    const stop = useCallback(() => {
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
        sourceRef.current?.disconnect();
        analyserRef.current?.disconnect();
        streamRef.current?.getTracks().forEach(t => t.stop());
        audioCtxRef.current?.close();

        audioCtxRef.current = null;
        analyserRef.current = null;
        sourceRef.current = null;
        streamRef.current = null;
        dataRef.current = null;

        setVolume(0);
        setMicState("idle");
    }, []);

    useEffect(() => () => stop(), [stop]);

    return { volume, micState, start, stop };
}