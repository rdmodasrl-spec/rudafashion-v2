import { useEffect, useRef, useState } from 'react';

/**
 * ModaUI 智能核心的音频侧驱动。
 *
 * 两个能力都只服务视觉状态，不参与语音识别或业务判断：
 * - `useMicLevel`：真实麦克风 RMS（`getUserMedia` + `AnalyserNode`），仅聆听期间持有音频流。
 * - `useSpeechReply`：真实语音播报（`speechSynthesis`），用 `start/boundary/end` 事件驱动脉动。
 */

const LEVEL_SMOOTHING = 0.28;
const LEVEL_GAIN = 5.2;
const PULSE_DECAY_MS = 110;
const MAX_SPEAK_CHARS = 600;

export type AudioLevelRef = { current: number };

export type SpeechReplyHandle = {
  speaking: boolean;
  pulseRef: AudioLevelRef;
  speak: (text: string) => boolean;
  cancel: () => void;
};

export function toSpeakableText(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`|~]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_SPEAK_CHARS);
}

export function useMicLevel(active: boolean): AudioLevelRef {
  const levelRef = useRef(0);

  useEffect(() => {
    if (!active) {
      levelRef.current = 0;
      return;
    }

    let cancelled = false;
    let rafId = 0;
    let context: AudioContext | null = null;
    let stream: MediaStream | null = null;

    const stop = () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = 0;
      stream?.getTracks().forEach(track => track.stop());
      stream = null;
      if (context) {
        void context.close().catch(() => undefined);
        context = null;
      }
      levelRef.current = 0;
    };

    const run = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) return;
        const media = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          media.getTracks().forEach(track => track.stop());
          return;
        }
        stream = media;
        const AudioContextCtor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextCtor) return;
        context = new AudioContextCtor();
        const source = context.createMediaStreamSource(media);
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.7;
        source.connect(analyser);
        const samples = new Uint8Array(analyser.fftSize);

        const tick = () => {
          if (cancelled) return;
          analyser.getByteTimeDomainData(samples);
          let sum = 0;
          for (let index = 0; index < samples.length; index += 1) {
            const value = (samples[index] - 128) / 128;
            sum += value * value;
          }
          const rms = Math.sqrt(sum / samples.length);
          const scaled = Math.min(1, rms * LEVEL_GAIN);
          levelRef.current = levelRef.current * (1 - LEVEL_SMOOTHING) + scaled * LEVEL_SMOOTHING;
          rafId = window.requestAnimationFrame(tick);
        };
        tick();
      } catch {
        // 权限被拒绝或设备不可用：保持 0，聆听状态仅剩基础运动，不影响对话功能。
        levelRef.current = 0;
      }
    };

    void run();

    return () => {
      cancelled = true;
      stop();
    };
  }, [active]);

  return levelRef;
}

export function useSpeechReply(isIt: boolean): SpeechReplyHandle {
  const [speaking, setSpeaking] = useState(false);
  const pulseRef = useRef(0);
  const pulseTimerRef = useRef<number | null>(null);
  const supportedRef = useRef(false);

  useEffect(() => {
    supportedRef.current = typeof window !== 'undefined' && 'speechSynthesis' in window;
    return () => {
      if (pulseTimerRef.current) window.clearTimeout(pulseTimerRef.current);
      pulseTimerRef.current = null;
      pulseRef.current = 0;
      if (supportedRef.current) window.speechSynthesis.cancel();
    };
  }, []);

  const clearPulse = () => {
    if (pulseTimerRef.current) {
      window.clearTimeout(pulseTimerRef.current);
      pulseTimerRef.current = null;
    }
    pulseRef.current = 0;
  };

  const cancel = () => {
    clearPulse();
    setSpeaking(false);
    if (supportedRef.current) window.speechSynthesis.cancel();
  };

  const speak = (raw: string) => {
    if (!supportedRef.current) return false;
    const text = toSpeakableText(raw);
    if (!text) return false;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = isIt ? 'it-IT' : 'zh-CN';
    utterance.rate = isIt ? 1.02 : 1.05;
    utterance.pitch = 0.94;
    utterance.onstart = () => {
      setSpeaking(true);
      pulseRef.current = 1;
    };
    utterance.onboundary = () => {
      pulseRef.current = 1;
      if (pulseTimerRef.current) window.clearTimeout(pulseTimerRef.current);
      pulseTimerRef.current = window.setTimeout(() => {
        pulseRef.current = 0;
        pulseTimerRef.current = null;
      }, PULSE_DECAY_MS);
    };
    const finish = () => {
      clearPulse();
      setSpeaking(false);
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    window.speechSynthesis.speak(utterance);
    return true;
  };

  return { speaking, pulseRef, speak, cancel };
}
