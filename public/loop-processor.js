class LoopProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    
    // Initialize parameters
    this.sampleRate = sampleRate;
    this.isPlaying = false;
    this.isLooping = false;
    this.playbackRate = 1.0;
    this.volume = 1.0;
    
    // Loop parameters (in samples)
    this.loopStartSample = 0;
    this.loopEndSample = 0;
    this.currentSample = 0;
    
    // Audio buffer
    this.audioBuffer = null;
    this.bufferChannels = 0;
    this.bufferLength = 0;
    
    // Crossfade parameters for smooth transitions
    this.crossfadeSamples = Math.floor(this.sampleRate * 0.001); // 1ms crossfade
    
    // Message handling
    this.port.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }
  
  handleMessage(data) {
    switch (data.type) {
      case 'SET_BUFFER':
        this.setBuffer(data.buffer);
        break;
      case 'PLAY':
        this.play();
        break;
      case 'PAUSE':
        this.pause();
        break;
      case 'SEEK':
        this.seek(data.sample);
        break;
      case 'SET_LOOP_POINTS':
        this.setLoopPoints(data.startSample, data.endSample);
        break;
      case 'SET_LOOPING':
        this.isLooping = data.enabled;
        break;
      case 'SET_PLAYBACK_RATE':
        this.playbackRate = data.rate;
        break;
      case 'SET_VOLUME':
        this.volume = data.volume;
        break;
      case 'GET_CURRENT_TIME':
        this.port.postMessage({
          type: 'CURRENT_TIME',
          sample: this.currentSample,
          time: this.currentSample / this.sampleRate
        });
        break;
    }
  }
  
  setBuffer(bufferData) {
    this.audioBuffer = bufferData;
    this.bufferChannels = bufferData.numberOfChannels;
    this.bufferLength = bufferData.length;
  }
  
  play() {
    this.isPlaying = true;
  }
  
  pause() {
    this.isPlaying = false;
  }
  
  seek(sample) {
    this.currentSample = Math.max(0, Math.min(sample, this.bufferLength - 1));
  }
  
  setLoopPoints(startSample, endSample) {
    this.loopStartSample = startSample;
    this.loopEndSample = endSample;
  }
  
  applyCrossfade(outputSample, loopSample, fadePosition) {
    // Linear crossfade between current position and loop start
    const fadeRatio = fadePosition / this.crossfadeSamples;
    return outputSample * (1 - fadeRatio) + loopSample * fadeRatio;
  }
  
  process(inputs, outputs, parameters) {
    const output = outputs[0];
    
    if (!this.isPlaying || !this.audioBuffer || !output.length) {
      return true;
    }
    
    const outputLength = output[0].length;
    const channelCount = Math.min(output.length, this.bufferChannels);
    
    for (let sample = 0; sample < outputLength; sample++) {
      // Use integer sample position for loop detection to avoid floating point errors
      const currentSampleInt = Math.floor(this.currentSample);
      const fraction = this.currentSample - currentSampleInt;
      
      // Check for loop boundary exactly at the sample level
      if (this.isLooping && this.loopEndSample > 0 && currentSampleInt >= this.loopEndSample) {
        // Immediate loop transition - jump to loop start
        const loopLength = this.loopEndSample - this.loopStartSample;
        this.currentSample = this.loopStartSample + (this.currentSample - this.loopEndSample) % loopLength;
        
        // Recalculate position after loop jump
        const newSampleInt = Math.floor(this.currentSample);
        const newFraction = this.currentSample - newSampleInt;
        
        // Output from new loop position
        for (let channel = 0; channel < channelCount; channel++) {
          const channelSample = this.getInterpolatedSample(newSampleInt, newFraction, channel);
          output[channel][sample] = channelSample * this.volume;
        }
        
        // Debug logging for precise tracking
        console.log(`Loop: ${currentSampleInt} -> ${newSampleInt} (exact: ${this.currentSample.toFixed(2)})`);
      } else if (currentSampleInt < this.bufferLength) {
        // Normal playback
        for (let channel = 0; channel < channelCount; channel++) {
          const channelSample = this.getInterpolatedSample(currentSampleInt, fraction, channel);
          output[channel][sample] = channelSample * this.volume;
        }
      } else {
        // Past the end of buffer, output silence
        for (let channel = 0; channel < channelCount; channel++) {
          output[channel][sample] = 0;
        }
      }
      
      // Increment current sample position (maintain precise floating point tracking)
      this.currentSample += this.playbackRate;
    }
    
    // Send periodic time updates
    if (Math.floor(this.currentSample / this.sampleRate * 10) !== 
        Math.floor((this.currentSample - outputLength * this.playbackRate) / this.sampleRate * 10)) {
      this.port.postMessage({
        type: 'TIME_UPDATE',
        sample: this.currentSample,
        time: this.currentSample / this.sampleRate
      });
    }
    
    return true;
  }
  
  getInterpolatedSample(sampleIndex, fraction, channel) {
    if (!this.audioBuffer || sampleIndex >= this.bufferLength - 1) {
      return 0;
    }
    
    const channelData = this.audioBuffer.getChannelData(channel);
    const sample1 = channelData[sampleIndex] || 0;
    const sample2 = channelData[sampleIndex + 1] || 0;
    
    // Linear interpolation for smooth playback at any rate
    return sample1 + (sample2 - sample1) * fraction;
  }
}

registerProcessor('loop-processor', LoopProcessor);