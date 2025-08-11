import { useRef, useCallback, useEffect } from 'react';

interface UseWaveformWorkerOptions {
  onWaveformGenerated: (waveformData: number[]) => void;
  onProgress?: (progress: number) => void;
  onError?: (error: string) => void;
}

export const useWaveformWorker = (options: UseWaveformWorkerOptions) => {
  const workerRef = useRef<Worker | null>(null);
  const { onWaveformGenerated, onProgress, onError } = options;

  useEffect(() => {
    // Create worker on mount
    workerRef.current = new Worker(
      new URL('../workers/WaveformWorker.ts', import.meta.url),
      { type: 'module' }
    );

    const worker = workerRef.current;

    worker.onmessage = (e) => {
      const { type, waveformData, progress, error } = e.data;
      
      switch (type) {
        case 'waveformGenerated':
          onWaveformGenerated(waveformData);
          break;
        case 'progress':
          onProgress?.(progress);
          break;
        case 'error':
          onError?.(error);
          break;
      }
    };

    worker.onerror = (error) => {
      onError?.(`Worker error: ${error.message}`);
    };

    // Cleanup on unmount
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [onWaveformGenerated, onProgress, onError]);

  const generateWaveform = useCallback((
    audioData: Float32Array,
    samples: number,
    startSample?: number,
    endSample?: number,
    sampleRate: number = 44100
  ) => {
    if (!workerRef.current) return;

    workerRef.current.postMessage({
      type: 'generateWaveform',
      audioData,
      samples,
      startSample,
      endSample,
      sampleRate
    });
  }, []);

  return { generateWaveform };
};