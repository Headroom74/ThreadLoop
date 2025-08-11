// Web Worker for heavy waveform processing
// This runs in a separate thread to avoid blocking the main UI

interface WaveformWorkerMessage {
  type: 'generateWaveform';
  audioData: Float32Array;
  samples: number;
  startSample?: number;
  endSample?: number;
  sampleRate: number;
}

interface WaveformWorkerResponse {
  type: 'waveformGenerated';
  waveformData: number[];
  totalSamples: number;
}

self.onmessage = function(e: MessageEvent<WaveformWorkerMessage>) {
  const { type, audioData, samples, startSample = 0, endSample, sampleRate } = e.data;
  
  if (type === 'generateWaveform') {
    try {
      const actualEndSample = endSample || audioData.length;
      const actualStartSample = Math.max(0, startSample);
      const actualEndSampleClamped = Math.min(actualEndSample, audioData.length);
      
      const actualSampleRange = actualEndSampleClamped - actualStartSample;
      const samplesPerBin = Math.max(1, Math.floor(actualSampleRange / samples));
      
      const waveformData: number[] = [];
      
      // Process in chunks to avoid blocking
      const chunkSize = 1000;
      let processed = 0;
      
      const processChunk = () => {
        const endIndex = Math.min(processed + chunkSize, samples);
        
        for (let i = processed; i < endIndex; i++) {
          const start = actualStartSample + i * samplesPerBin;
          const end = Math.min(start + samplesPerBin, actualEndSampleClamped);
          
          let max = 0;
          for (let j = start; j < end; j++) {
            if (j < audioData.length) {
              max = Math.max(max, Math.abs(audioData[j]));
            }
          }
          
          waveformData[i] = max;
        }
        
        processed = endIndex;
        
        // Post progress updates for large files
        if (audioData.length > 1000000 && processed % 100 === 0) {
          self.postMessage({
            type: 'progress',
            progress: processed / samples
          });
        }
        
        if (processed < samples) {
          // Use setTimeout to yield control back to the event loop
          setTimeout(processChunk, 0);
        } else {
          // Send final result
          const response: WaveformWorkerResponse = {
            type: 'waveformGenerated',
            waveformData,
            totalSamples: actualSampleRange
          };
          
          self.postMessage(response);
        }
      };
      
      processChunk();
      
    } catch (error) {
      self.postMessage({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
};

export {}; // Make this a module