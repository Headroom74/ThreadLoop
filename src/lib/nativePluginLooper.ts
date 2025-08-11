import { NativeAudio } from './nativeAudio';

export type TimeUpdateCallback = (time: number) => void;
export type EndedCallback = () => void;

export class NativePluginLooper {
  private onTimeUpdate?: TimeUpdateCallback;
  private onEnded?: EndedCallback;
  private rafId: number | null = null;
  private isPlaying = false;
  private durationSec = 0;

  async loadAudio(arrayBuffer: ArrayBuffer): Promise<number> {
    const base64 = await this.toBase64(arrayBuffer);
    const res = await NativeAudio.loadAudio({ base64 });
    const d = (res as any)?.duration;
    this.durationSec = typeof d === 'number' ? d : 0;
    this.startRaf();
    return this.durationSec;
  }

  setTimeUpdateCallback(cb: TimeUpdateCallback) { this.onTimeUpdate = cb; }
  setEndedCallback(cb: EndedCallback) { this.onEnded = cb; }

  setLoopPoints(start: number, end: number) { return NativeAudio.setLoopPoints(start, end); }
  setPlaybackRate(rate: number) { return NativeAudio.setRate(rate); }
  setPitch(semitones: number) { return NativeAudio.setPitch(semitones); }
  play() { this.isPlaying = true; return NativeAudio.play(); }
  pause() { this.isPlaying = false; return NativeAudio.pause(); }
  seek(time: number) { return NativeAudio.seek(time); }

  destroy() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.onTimeUpdate = undefined;
    this.onEnded = undefined;
  }

  private startRaf() {
    const tick = async () => {
      if (this.onTimeUpdate && this.isPlaying) {
        try {
          const t = await NativeAudio.getCurrentTime();
          this.onTimeUpdate(t);
        } catch {}
      }
      this.rafId = requestAnimationFrame(tick);
    };
    if (this.rafId === null) this.rafId = requestAnimationFrame(tick);
  }

  private toBase64(ab: ArrayBuffer): Promise<string> {
    return new Promise((resolve) => {
      const blob = new Blob([ab]);
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(blob);
    });
  }
}
