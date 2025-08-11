export class AudioWorkletLooper {
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private gainNode: GainNode | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private isSupported: boolean = false;
  private isInitialized: boolean = false;
  
  // State tracking
  private currentTime: number = 0;
  private isPlaying: boolean = false;
  private isLooping: boolean = false;
  private playbackRate: number = 1.0;
  private volume: number = 1.0;
  private loopStartTime: number = 0;
  private loopEndTime: number = 0;
  
  // Callbacks
  private onTimeUpdate?: (time: number) => void;
  private onError?: (error: Error) => void;

  constructor() {
    this.checkSupport();
  }

  private checkSupport(): boolean {
    this.isSupported = 
      typeof AudioWorkletNode !== 'undefined' && 
      typeof AudioContext !== 'undefined';
    return this.isSupported;
  }

  async initialize(): Promise<boolean> {
    if (!this.isSupported) {
      throw new Error('AudioWorklet not supported in this browser');
    }

    try {
      this.audioContext = new AudioContext();
      
      // Load the worklet processor
      await this.audioContext.audioWorklet.addModule('/loop-processor.js');
      
      // Create the worklet node
      this.workletNode = new AudioWorkletNode(this.audioContext, 'loop-processor');
      
      // Create gain node for volume control
      this.gainNode = this.audioContext.createGain();
      
      // Connect the audio graph
      this.workletNode.connect(this.gainNode);
      this.gainNode.connect(this.audioContext.destination);
      
      // Set up message handling
      this.workletNode.port.onmessage = (event) => {
        this.handleWorkletMessage(event.data);
      };
      
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize AudioWorkletLooper:', error);
      this.onError?.(error as Error);
      return false;
    }
  }

  private handleWorkletMessage(data: any) {
    switch (data.type) {
      case 'TIME_UPDATE':
        this.currentTime = data.time;
        this.onTimeUpdate?.(data.time);
        break;
      case 'CURRENT_TIME':
        this.currentTime = data.time;
        break;
      default:
        break;
    }
  }

  async loadAudio(arrayBuffer: ArrayBuffer): Promise<void> {
    if (!this.audioContext || !this.workletNode) {
      throw new Error('AudioWorkletLooper not initialized');
    }

    try {
      this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      // Send buffer to worklet
      this.workletNode.port.postMessage({
        type: 'SET_BUFFER',
        buffer: this.audioBuffer
      });
    } catch (error) {
      console.error('Failed to load audio:', error);
      throw error;
    }
  }

  play(): void {
    if (!this.workletNode) return;
    
    // Resume audio context if suspended
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume();
    }
    
    this.workletNode.port.postMessage({ type: 'PLAY' });
    this.isPlaying = true;
  }

  pause(): void {
    if (!this.workletNode) return;
    
    this.workletNode.port.postMessage({ type: 'PAUSE' });
    this.isPlaying = false;
  }

  seek(timeSeconds: number): void {
    if (!this.workletNode || !this.audioBuffer) return;
    
    const sample = Math.round(timeSeconds * this.audioBuffer.sampleRate);
    this.workletNode.port.postMessage({ 
      type: 'SEEK', 
      sample 
    });
    this.currentTime = timeSeconds;
  }

  setLoopPoints(startTime: number, endTime: number): void {
    if (!this.workletNode || !this.audioBuffer) return;
    
    this.loopStartTime = startTime;
    this.loopEndTime = endTime;
    
    const startSample = Math.round(startTime * this.audioBuffer.sampleRate);
    const endSample = Math.round(endTime * this.audioBuffer.sampleRate);
    
    this.workletNode.port.postMessage({
      type: 'SET_LOOP_POINTS',
      startSample,
      endSample
    });
  }

  setLooping(enabled: boolean): void {
    if (!this.workletNode) return;
    
    this.isLooping = enabled;
    this.workletNode.port.postMessage({
      type: 'SET_LOOPING',
      enabled
    });
  }

  setPlaybackRate(rate: number): void {
    if (!this.workletNode) return;
    
    this.playbackRate = rate;
    this.workletNode.port.postMessage({
      type: 'SET_PLAYBACK_RATE',
      rate
    });
  }

  setVolume(volume: number): void {
    if (!this.gainNode) return;
    
    this.volume = volume;
    this.gainNode.gain.setValueAtTime(volume, this.audioContext!.currentTime);
  }

  getCurrentTime(): number {
    if (!this.workletNode) return this.currentTime;
    
    // Request current time from worklet
    this.workletNode.port.postMessage({ type: 'GET_CURRENT_TIME' });
    return this.currentTime;
  }

  getDuration(): number {
    return this.audioBuffer ? this.audioBuffer.duration : 0;
  }

  getLoopStart(): number {
    return this.loopStartTime;
  }

  getLoopEnd(): number {
    return this.loopEndTime;
  }

  isAudioPlaying(): boolean {
    return this.isPlaying;
  }

  isAudioLooping(): boolean {
    return this.isLooping;
  }

  getPlaybackRate(): number {
    return this.playbackRate;
  }

  getVolume(): number {
    return this.volume;
  }

  setTimeUpdateCallback(callback: (time: number) => void): void {
    this.onTimeUpdate = callback;
  }

  setErrorCallback(callback: (error: Error) => void): void {
    this.onError = callback;
  }

  static isSupported(): boolean {
    return typeof AudioWorkletNode !== 'undefined' && 
           typeof AudioContext !== 'undefined';
  }

  destroy(): void {
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.isInitialized = false;
    this.audioBuffer = null;
  }
}