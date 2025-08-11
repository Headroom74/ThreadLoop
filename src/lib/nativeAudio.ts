import { Capacitor } from '@capacitor/core';

type PathOrBlob = { path: string } | { base64: string };

const isNative = Capacitor.isNativePlatform();

const plugin = isNative
  ? (window as any).Capacitor?.Plugins?.NativeAudioLooper
  : null;

export const NativeAudio = {
  async loadAudio(input: PathOrBlob): Promise<{ duration?: number }|void> {
    if (plugin) return plugin.loadAudio(input);
    return;
  },
  async setLoopPoints(start: number, end: number) {
    if (plugin) return plugin.setLoopPoints({ start, end });
  },
  async setRate(rate: number) {
    if (plugin) return plugin.setRate({ rate });
  },
  async setPitch(semitones: number) {
    if (plugin) return plugin.setPitch({ semitones });
  },
  async play() {
    if (plugin) return plugin.play();
  },
  async pause() {
    if (plugin) return plugin.pause();
  },
  async seek(time: number) {
    if (plugin) return plugin.seek({ time });
  },
  async getCurrentTime(): Promise<number> {
    if (plugin) {
      const res = await plugin.getCurrentTime();
      return res?.time ?? 0;
    }
    return 0;
  },
};
