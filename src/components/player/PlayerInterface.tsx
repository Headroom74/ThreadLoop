import React, { useState, useRef, useEffect, useCallback, useMemo, memo } from "react";
import { Upload, Play, Pause, RotateCcw, Repeat, X, Maximize, Minimize, ChevronLeft, ChevronRight, Clock, Info, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import DraggableSlider from "@/components/ui/DraggableSlider";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { AudioWorkletLooper } from "@/lib/AudioWorkletLooper";
import WaveformProgressDisplay from "./WaveformProgressDisplay";
import { useThrottledState } from "@/hooks/useThrottledState";
import SpeedRampControl from "@/components/ui/SpeedRampControl";
import ConditionalTooltip from "@/components/ui/ConditionalTooltip";
import { useHoldToRepeat } from "@/hooks/useHoldToRepeat";
import { usePointerActionGuard } from "@/hooks/usePointerActionGuard";

// Web Audio API looper class for seamless audio looping
class WebAudioLooper {
  private audioContext: AudioContext | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private gainNode: GainNode | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private nextSource: AudioBufferSourceNode | null = null;
  private startTime: number = 0;
  private pausedAt: number = 0;
  private isPlaying: boolean = false;
  private loopStart: number = 0;
  private loopEnd: number = 0;
  private playbackRate: number = 1;
  private onTimeUpdate?: (time: number) => void;
  private onEnded?: () => void;
  private animationFrame: number = 0;
  private isLooping: boolean = false;
  
  // Sample-accurate timing variables
  private nextStartTime: number = 0;
  private loopStartSample: number = 0;
  private loopEndSample: number = 0;
  private loopDurationSamples: number = 0;
  private sampleRate: number = 44100;
  private scheduleAheadTime: number = 0.1; // 100ms lookahead
  private schedulingActive: boolean = false;

  async initialize() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.gainNode = this.audioContext.createGain();
    this.gainNode.connect(this.audioContext.destination);
  }

  async loadAudio(arrayBuffer: ArrayBuffer) {
    if (!this.audioContext) await this.initialize();
    if (!this.audioContext) throw new Error('AudioContext not available');
    
    this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    this.sampleRate = this.audioContext.sampleRate;
    this.loopEnd = this.audioBuffer.duration;
    return this.audioBuffer.duration;
  }

  createSource(): AudioBufferSourceNode | null {
    if (!this.audioContext || !this.audioBuffer || !this.gainNode) return null;
    
    const source = this.audioContext.createBufferSource();
    source.buffer = this.audioBuffer;
    source.playbackRate.value = this.playbackRate;
    source.connect(this.gainNode);
    return source;
  }

  setLoopPoints(start: number, end: number) {
    this.loopStart = start;
    this.loopEnd = end;
    
    // Convert to sample-accurate positions
    this.loopStartSample = Math.round(start * this.sampleRate);
    this.loopEndSample = Math.round(end * this.sampleRate);
    this.loopDurationSamples = this.loopEndSample - this.loopStartSample;
  }

  setPlaybackRate(rate: number) {
    this.playbackRate = rate;
    if (this.currentSource) {
      this.currentSource.playbackRate.value = rate;
    }
    if (this.nextSource) {
      this.nextSource.playbackRate.value = rate;
    }
  }

  setVolume(volume: number) {
    if (this.gainNode) {
      this.gainNode.gain.value = volume;
    }
  }

  getCurrentTime(): number {
    if (!this.audioContext || !this.isPlaying) return this.pausedAt;
    
    if (this.isLooping && this.loopEnd > this.loopStart) {
      // For looping, use sample-accurate position calculation
      const elapsedAudioTime = this.audioContext.currentTime - this.startTime;
      const elapsedSamples = Math.floor(elapsedAudioTime * this.sampleRate * this.playbackRate);
      const positionInLoopSamples = elapsedSamples % this.loopDurationSamples;
      const currentSample = this.loopStartSample + positionInLoopSamples;
      return currentSample / this.sampleRate;
    }
    
    return this.pausedAt + (this.audioContext.currentTime - this.startTime) * this.playbackRate;
  }

  seek(time: number) {
    const wasPlaying = this.isPlaying;
    if (wasPlaying) this.pause();
    this.pausedAt = time;
    if (wasPlaying) this.play();
  }

  // Sample-accurate ping-pong loop scheduler
  private startSampleAccurateLoop() {
    if (!this.audioContext || !this.isLooping || !this.audioBuffer) return;
    
    // Calculate sample-accurate loop duration accounting for playback rate
    const exactLoopDurationSeconds = this.loopDurationSamples / (this.sampleRate * this.playbackRate);
    
    // Initialize scheduling with lookahead
    this.nextStartTime = this.audioContext.currentTime + this.scheduleAheadTime;
    this.schedulingActive = true;
    
    // Start the continuous scheduling loop
    this.scheduleBuffersAhead();
    
    this.startTime = this.nextStartTime;
    this.pausedAt = this.loopStart;
  }

  private scheduleBuffersAhead() {
    if (!this.audioContext || !this.schedulingActive) return;
    
    const currentAudioTime = this.audioContext.currentTime;
    const exactLoopDurationSeconds = this.loopDurationSamples / (this.sampleRate * this.playbackRate);
    
    // Schedule buffers while we're within the lookahead window
    while (this.nextStartTime < currentAudioTime + this.scheduleAheadTime) {
      const source = this.createSource();
      if (source) {
        // Use sample-accurate duration instead of calculated end-start
        source.start(this.nextStartTime, this.loopStart, exactLoopDurationSeconds);
        
        // Advance to next loop start time using cumulative timing (prevents drift)
        this.nextStartTime += exactLoopDurationSeconds;
      }
    }
    
    // Continue scheduling in the next frame
    if (this.schedulingActive) {
      requestAnimationFrame(() => this.scheduleBuffersAhead());
    }
  }

  updateTime = () => {
    if (this.isPlaying) {
      const currentTime = this.getCurrentTime();
      this.onTimeUpdate?.(currentTime);
      this.animationFrame = requestAnimationFrame(this.updateTime);
    }
  };

  play() {
    if (!this.audioContext || !this.audioBuffer) return;

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    this.isPlaying = true;

    if (this.isLooping && this.loopEnd > this.loopStart) {
      // Use sample-accurate ping-pong scheduling for loops
      this.startSampleAccurateLoop();
    } else {
      // Standard playback for non-looping
      this.currentSource = this.createSource();
      if (!this.currentSource) return;

      const offset = this.pausedAt;
      const duration = this.audioBuffer.duration - offset;

      this.currentSource.start(0, offset, duration);
      this.startTime = this.audioContext.currentTime;

      this.currentSource.onended = () => {
        this.isPlaying = false;
        this.pausedAt = 0;
        this.onEnded?.();
      };
    }

    // Start time updates
    this.updateTime();
  }

  pause() {
    // Stop sample-accurate scheduling
    this.schedulingActive = false;
    
    if (this.currentSource) {
      this.currentSource.stop();
      this.currentSource = null;
    }
    if (this.nextSource) {
      this.nextSource.stop();
      this.nextSource = null;
    }
    
    this.pausedAt = this.getCurrentTime();
    this.isPlaying = false;
    
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
  }

  setLooping(enabled: boolean) {
    this.isLooping = enabled;
  }

  setTimeUpdateCallback(callback: (time: number) => void) {
    this.onTimeUpdate = callback;
  }

  setEndedCallback(callback: () => void) {
    this.onEnded = callback;
  }

  destroy() {
    this.pause();
    if (this.audioContext) {
      this.audioContext.close();
    }
  }

  getDuration(): number {
    return this.audioBuffer?.duration || 0;
  }
}

// Consolidated state interfaces for better performance
interface PlaybackState {
  isPlaying: boolean;
  hasMedia: boolean;
  duration: number;
  isAudio: boolean;
  useWorkletAudio: boolean;
  audioBuffer: AudioBuffer | null;
  mediaUrl: string;
}

interface ControlsState {
  speed: number[];
  speedInput: string;
  volume: number[];
  bpm: number;
  isLooping: boolean;
  isFullscreen: boolean;
  isWaveformZoomed: boolean;
}

interface LoopState {
  loopStart: number | null;
  loopEnd: number | null;
  isABLooping: boolean;
  loopCount: number;
  currentLoopCount: number;
}

interface AutoSpeedRampState {
  enabled: boolean;
  loopsBeforeIncrease: number;
  speedIncreasePercent: number;
  maxSpeedPercent: number;
  originalSpeed: number;
}

interface TapTempoState {
  tapTimes: number[];
  tappedBpm: number | null;
  isTapping: boolean;
  tapTimeout: NodeJS.Timeout | null;
}

interface TimerState {
  totalPlaybackTime: number;
  currentSessionTime: number;
  playbackTimerInterval: NodeJS.Timeout | null;
}

export default function PlayerInterface() {
  // Consolidated state objects for better performance
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    hasMedia: false,
    duration: 0,
    isAudio: false,
    useWorkletAudio: false,
    audioBuffer: null,
    mediaUrl: ""
  });

  const [controlsState, setControlsState] = useState<ControlsState>({
    speed: [100],
    speedInput: "100",
    volume: [75],
    bpm: 120,
    isLooping: false,
    isFullscreen: false,
    isWaveformZoomed: false
  });

  const [loopState, setLoopState] = useState<LoopState>({
    loopStart: null,
    loopEnd: null,
    isABLooping: false,
    loopCount: 0,
    currentLoopCount: 0
  });

  const [autoSpeedRampState, setAutoSpeedRampState] = useState<AutoSpeedRampState>({
    enabled: false,
    loopsBeforeIncrease: 5,
    speedIncreasePercent: 5.0,
    maxSpeedPercent: 120,
    originalSpeed: 100
  });

  const [tapTempoState, setTapTempoState] = useState<TapTempoState>({
    tapTimes: [],
    tappedBpm: null,
    isTapping: false,
    tapTimeout: null
  });

  const [timerState, setTimerState] = useState<TimerState>({
    totalPlaybackTime: 0,
    currentSessionTime: 0,
    playbackTimerInterval: null
  });

  // Throttled time updates for performance
  const [currentTime, setCurrentTimeThrottled] = useThrottledState(0, { throttleMs: 100 });
  
  // UI interaction state (kept separate as they need immediate updates)
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState<'start' | 'end' | null>(null);
  const [wasPlayingBeforeDrag, setWasPlayingBeforeDrag] = useState(false);
  const [lastScrubTime, setLastScrubTime] = useState(0);
  const [scrubTimeout, setScrubTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isTooltipModeActive, setIsTooltipModeActive] = useState(false);

  // Destructure for easier access
  const { isPlaying, hasMedia, duration, isAudio, useWorkletAudio, audioBuffer, mediaUrl } = playbackState;
  const { speed, speedInput, volume, bpm, isLooping, isFullscreen, isWaveformZoomed } = controlsState;
  const { loopStart, loopEnd, isABLooping, loopCount, currentLoopCount } = loopState;
  const { enabled: autoSpeedRampEnabled, loopsBeforeIncrease, speedIncreasePercent, maxSpeedPercent, originalSpeed } = autoSpeedRampState;
  const { tapTimes, tappedBpm, isTapping, tapTimeout } = tapTempoState;
  const { totalPlaybackTime, currentSessionTime, playbackTimerInterval } = timerState;

  // State setter helpers for consolidated state management
  const setIsPlaying = useCallback((value: boolean) => {
    setPlaybackState(prev => ({ ...prev, isPlaying: value }));
  }, []);

  const setHasMedia = useCallback((value: boolean) => {
    setPlaybackState(prev => ({ ...prev, hasMedia: value }));
  }, []);

  const setDuration = useCallback((value: number) => {
    setPlaybackState(prev => ({ ...prev, duration: value }));
  }, []);

  const setIsAudio = useCallback((value: boolean) => {
    setPlaybackState(prev => ({ ...prev, isAudio: value }));
  }, []);

  const setUseWorkletAudio = useCallback((value: boolean) => {
    setPlaybackState(prev => ({ ...prev, useWorkletAudio: value }));
  }, []);

  const setAudioBuffer = useCallback((value: AudioBuffer | null) => {
    setPlaybackState(prev => ({ ...prev, audioBuffer: value }));
  }, []);

  const setMediaUrl = useCallback((value: string) => {
    setPlaybackState(prev => ({ ...prev, mediaUrl: value }));
  }, []);

  const setSpeed = useCallback((value: number[]) => {
    setControlsState(prev => ({ ...prev, speed: value }));
  }, []);

  const setSpeedInput = useCallback((value: string) => {
    setControlsState(prev => ({ ...prev, speedInput: value }));
  }, []);

  const setVolume = useCallback((value: number[]) => {
    setControlsState(prev => ({ ...prev, volume: value }));
  }, []);

  const setBpm = useCallback((value: number) => {
    setControlsState(prev => ({ ...prev, bpm: value }));
  }, []);

  const setIsLooping = useCallback((value: boolean) => {
    setControlsState(prev => ({ ...prev, isLooping: value }));
  }, []);

  const setIsFullscreen = useCallback((value: boolean) => {
    setControlsState(prev => ({ ...prev, isFullscreen: value }));
  }, []);

  const setIsWaveformZoomed = useCallback((value: boolean) => {
    setControlsState(prev => ({ ...prev, isWaveformZoomed: value }));
  }, []);

  const setLoopStart = useCallback((value: number | null) => {
    setLoopState(prev => ({ ...prev, loopStart: value }));
  }, []);

  const setLoopEnd = useCallback((value: number | null) => {
    setLoopState(prev => ({ ...prev, loopEnd: value }));
  }, []);

  const setIsABLooping = useCallback((value: boolean) => {
    setLoopState(prev => ({ ...prev, isABLooping: value }));
  }, []);

  const setLoopCount = useCallback((value: number) => {
    setLoopState(prev => ({ ...prev, loopCount: value }));
  }, []);

  const setCurrentLoopCount = useCallback((value: number) => {
    setLoopState(prev => ({ ...prev, currentLoopCount: value }));
  }, []);

  const setAutoSpeedRampEnabled = useCallback((value: boolean) => {
    setAutoSpeedRampState(prev => ({ ...prev, enabled: value }));
  }, []);

  const setLoopsBeforeIncrease = useCallback((value: number) => {
    setAutoSpeedRampState(prev => ({ ...prev, loopsBeforeIncrease: value }));
  }, []);

  const setSpeedIncreasePercent = useCallback((value: number) => {
    setAutoSpeedRampState(prev => ({ ...prev, speedIncreasePercent: value }));
  }, []);

  const setMaxSpeedPercent = useCallback((value: number) => {
    setAutoSpeedRampState(prev => ({ ...prev, maxSpeedPercent: value }));
  }, []);

  const setOriginalSpeed = useCallback((value: number) => {
    setAutoSpeedRampState(prev => ({ ...prev, originalSpeed: value }));
  }, []);

  const setTapTimes = useCallback((value: number[]) => {
    setTapTempoState(prev => ({ ...prev, tapTimes: value }));
  }, []);

  const setTappedBpm = useCallback((value: number | null) => {
    setTapTempoState(prev => ({ ...prev, tappedBpm: value }));
  }, []);

  const setIsTapping = useCallback((value: boolean) => {
    setTapTempoState(prev => ({ ...prev, isTapping: value }));
  }, []);

  const setTapTimeout = useCallback((value: NodeJS.Timeout | null) => {
    setTapTempoState(prev => ({ ...prev, tapTimeout: value }));
  }, []);

  const setTotalPlaybackTime = useCallback((value: number) => {
    setTimerState(prev => ({ ...prev, totalPlaybackTime: value }));
  }, []);

  const setCurrentSessionTime = useCallback((value: number) => {
    setTimerState(prev => ({ ...prev, currentSessionTime: value }));
  }, []);

  const setPlaybackTimerInterval = useCallback((value: NodeJS.Timeout | null) => {
    setTimerState(prev => ({ ...prev, playbackTimerInterval: value }));
  }, []);

  // Add missing setCurrentTime function
  const setCurrentTime = useCallback((value: number) => {
    setCurrentTimeThrottled(value);
  }, [setCurrentTimeThrottled]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const webAudioLooper = useRef<WebAudioLooper | null>(null);
  const workletLooper = useRef<AudioWorkletLooper | null>(null);

  // Tooltip content for all interactive elements
  const tooltipContent = {
    playPause: "Start or pause media playback",
    restart: "Restart from beginning",
    looping: "Toggle continuous loop mode",
    loopStart: "Set loop start point (A)",
    loopEnd: "Set loop end point (B)",
    nudgeStartLeft: "Fine-tune loop start backward",
    nudgeStartRight: "Fine-tune loop start forward", 
    nudgeEndLeft: "Fine-tune loop end backward",
    nudgeEndRight: "Fine-tune loop end forward",
    clearLoop: "Clear A-B loop points",
    abLoop: "Toggle A-B loop mode",
    volume: "Adjust playback volume",
    speed: "Control playback speed (25-200%)",
    speedInput: "Enter exact speed percentage",
    speedPreset: "Apply speed preset",
    autoSpeedRamp: "Automatically increase speed over time",
    tapTempo: "Tap to set target BPM tempo",
    fullscreen: "Toggle fullscreen mode",
    import: "Import audio or video file",
    infoToggle: "Toggle tooltip help system"
  };

  // Conditional Tooltip Wrapper Component
  const ConditionalTooltip = ({ 
    content, 
    children, 
    enabled = isTooltipModeActive 
  }: {
    content: string;
    children: React.ReactNode;
    enabled?: boolean;
  }) => {
    if (!enabled) return <>{children}</>;
    
    return (
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent 
          side="top"
          className="bg-gray-900 text-gray-100 border-gray-700 shadow-lg rounded-md px-3 py-1.5 text-sm max-w-xs"
        >
          {content}
        </TooltipContent>
      </Tooltip>
    );
  };

  // Speed Ramp Control Component
  const SpeedRampControl = React.memo(({ label, value, onChange, min, max, step, disabled }: {
    label: string;
    value: number;
    onChange: (value: number) => void;
    min: number;
    max: number;
    step: number;
    disabled: boolean;
  }) => {
    const [displayValue, setDisplayValue] = useState<string>('');

    // Sync display value with prop value only when value changes externally
    useEffect(() => {
      setDisplayValue(step === 0.5 ? value.toFixed(1) : value.toString());
    }, [value, step]);

    const increment = useCallback(() => {
      const newValue = Math.min(max, value + step);
      if (newValue !== value) {
        onChange(newValue);
      }
    }, [value, step, max, onChange]);

    const decrement = useCallback(() => {
      const newValue = Math.max(min, value - step);
      if (newValue !== value) {
        onChange(newValue);
      }
    }, [value, step, min, onChange]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      setDisplayValue(inputValue);
    }, []);

    const handleInputBlur = useCallback(() => {
      const numValue = step === 0.5 ? parseFloat(displayValue) : parseInt(displayValue);
      if (!isNaN(numValue) && numValue >= min && numValue <= max) {
        onChange(numValue);
      } else {
        // Revert to current value if invalid
        setDisplayValue(step === 0.5 ? value.toFixed(1) : value.toString());
      }
    }, [displayValue, value, step, min, max, onChange]);

    const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleInputBlur();
      }
    }, [handleInputBlur]);

    return (
      <div className="text-center">
        <Label className="text-xs text-muted-foreground mb-1 block">
          {label}
        </Label>
        <div className="flex items-center justify-center">
          <Button
            variant="outline"
            size="icon"
            className="w-8 h-8 rounded-r-none border-r-0"
            disabled={disabled || value <= min}
            onClick={decrement}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input
            value={displayValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyPress={handleKeyPress}
            className="text-center h-8 w-12 rounded-none border-x-0 px-1"
            disabled={disabled}
            type="text"
          />
          <Button
            variant="outline"
            size="icon"
            className="w-8 h-8 rounded-l-none border-l-0"
            disabled={disabled || value >= max}
            onClick={increment}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  });

  // Cleanup previous media URL when component unmounts
  useEffect(() => {
    return () => {
      if (mediaUrl) {
        URL.revokeObjectURL(mediaUrl);
      }
      if (webAudioLooper.current) {
        webAudioLooper.current.destroy();
      }
      if (workletLooper.current) {
        workletLooper.current.destroy();
      }
    };
  }, [mediaUrl]);

  // Update media element properties when state changes
  useEffect(() => {
    if (isAudio) {
      const activeLooper = useWorkletAudio ? workletLooper.current : webAudioLooper.current;
      if (activeLooper) {
        // Update audio settings for both worklet and fallback loopers
        activeLooper.setPlaybackRate(speed[0] / 100);
        activeLooper.setVolume(volume[0] / 100);
        activeLooper.setLooping(isABLooping && loopStart !== null && loopEnd !== null);
        if (loopStart !== null && loopEnd !== null) {
          activeLooper.setLoopPoints(loopStart, loopEnd);
        }
      }
    } else if (mediaRef.current) {
      // Update HTML5 video element settings for video files
      mediaRef.current.playbackRate = speed[0] / 100;
      mediaRef.current.volume = volume[0] / 100;
      mediaRef.current.loop = isLooping;
    }
  }, [speed, volume, isLooping, isAudio, isABLooping, loopStart, loopEnd, useWorkletAudio]);

  // Sync speed input with slider changes
  useEffect(() => {
    setSpeedInput(speed[0].toString());
  }, [speed]);

  const handleSpeedInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSpeedInput(event.target.value);
  };

  const handleSpeedInputBlur = () => {
    const value = parseInt(speedInput);
    if (!isNaN(value) && value >= 25 && value <= 200) {
      setSpeed([value]);
    } else {
      setSpeedInput(speed[0].toString());
    }
  };

  const handleSpeedInputKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleSpeedInputBlur();
    }
  };

  // Auto-SpeedRamp logic
  const handleAutoSpeedRamp = (newLoopCount: number) => {
    if (!autoSpeedRampEnabled || !isABLooping) return;
    
    // Check if we've reached the threshold for speed increase
    if (newLoopCount % loopsBeforeIncrease === 0) {
      const currentSpeedValue = speed[0];
      
      // Only increase if we haven't reached max speed
      if (currentSpeedValue < maxSpeedPercent) {
        const newSpeedValue = Math.min(
          maxSpeedPercent, 
          currentSpeedValue + speedIncreasePercent
        );
        setSpeed([newSpeedValue]);
      }
    }
  };

  // Tap Tempo logic
  const handleTapTempo = useCallback(() => {
    const now = performance.now();
    setIsTapping(true);
    
    // Clear existing timeout
    if (tapTimeout) {
      clearTimeout(tapTimeout);
    }
    
    // Remove taps older than 3 seconds
    const filteredTaps = tapTimes.filter(tapTime => now - tapTime < 3000);
    const newTaps = [...filteredTaps, now];
    
    // Calculate BPM if we have 4 or more taps
    if (newTaps.length >= 4) {
      const intervals = [];
      for (let i = 1; i < newTaps.length; i++) {
        intervals.push(newTaps[i] - newTaps[i - 1]);
      }
      
      // Calculate average interval and convert to BPM
      const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
      const calculatedBpm = Math.round(60000 / avgInterval);
      
      if (calculatedBpm >= 60 && calculatedBpm <= 300) {
        setTappedBpm(calculatedBpm);
        setBpm(calculatedBpm);
      }
    }
    
    setTapTimes(newTaps);
    
    // Reset tap session after 3 seconds of inactivity
    const newTimeout = setTimeout(() => {
      setTapTimes([]);
      setIsTapping(false);
    }, 3000);
    setTapTimeout(newTimeout);
    
    // Remove tapping visual feedback after short pulse
    setTimeout(() => setIsTapping(false), 150);
  }, [tapTimeout]);

  // Update BPM display based on current speed and tapped BPM
  const displayBpm = tappedBpm && autoSpeedRampEnabled && isABLooping 
    ? Math.round(tappedBpm * (speed[0] / 100))
    : tappedBpm || bpm;

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Clean up previous URL
      if (mediaUrl) {
        URL.revokeObjectURL(mediaUrl);
      }
      
      const url = URL.createObjectURL(file);
      setMediaUrl(url);
      const isAudioFile = file.type.startsWith('audio/');
      setIsAudio(isAudioFile);
      setHasMedia(true);
      setCurrentTime(0);
      setDuration(0);

      // Initialize audio processing for all files
      const arrayBuffer = await file.arrayBuffer();
      
      // Clean up existing loopers
      if (webAudioLooper.current) {
        webAudioLooper.current.destroy();
        webAudioLooper.current = null;
      }
      if (workletLooper.current) {
        workletLooper.current.destroy();
        workletLooper.current = null;
      }

      // Extract audio buffer for waveform display (for both audio and video files)
      try {
        const audioContext = new AudioContext();
        const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
        setAudioBuffer(decodedBuffer);
        audioContext.close();
      } catch (error) {
        console.warn('Failed to decode audio for waveform:', error);
        setAudioBuffer(null);
      }

      // Initialize audio looping for audio files
      if (isAudioFile) {
        // Try AudioWorklet first for professional-grade looping
        if (AudioWorkletLooper.isSupported()) {
          try {
            workletLooper.current = new AudioWorkletLooper();
            const initialized = await workletLooper.current.initialize();
            
            if (initialized) {
              await workletLooper.current.loadAudio(arrayBuffer);
              setUseWorkletAudio(true);
              
              const duration = workletLooper.current.getDuration();
              setDuration(duration);

              // Set up time update callback
              workletLooper.current.setTimeUpdateCallback((time: number) => {
                setCurrentTime(time);
              });

              workletLooper.current.setErrorCallback((error: Error) => {
                console.error('AudioWorklet error:', error);
              });

              console.log('AudioWorklet initialized for professional audio looping');
              return;
            }
          } catch (error) {
            console.warn('AudioWorklet failed, falling back to WebAudio:', error);
          }
        }

        // Fallback to WebAudioLooper
        try {
          webAudioLooper.current = new WebAudioLooper();
          const duration = await webAudioLooper.current.loadAudio(arrayBuffer);
          setDuration(duration);
          setUseWorkletAudio(false);
          
          // Set up callbacks
          webAudioLooper.current.setTimeUpdateCallback((time) => {
            setCurrentTime(time);
          });
          
          webAudioLooper.current.setEndedCallback(() => {
            setIsPlaying(false);
            setCurrentTime(0);
          });
          
          console.log('Web Audio API initialized for seamless looping');
        } catch (error) {
          console.error('Failed to initialize Web Audio API:', error);
          // Fallback to HTML5 audio
          setIsAudio(false);
        }
      }
    }
  };

  const togglePlayPause = async () => {
    try {
      if (isPlaying) {
        if (isAudio) {
          const activeLooper = useWorkletAudio ? workletLooper.current : webAudioLooper.current;
          if (activeLooper) {
            activeLooper.pause();
          }
        } else if (mediaRef.current) {
          mediaRef.current.pause();
        }
        setIsPlaying(false);
      } else {
        if (isAudio) {
          const activeLooper = useWorkletAudio ? workletLooper.current : webAudioLooper.current;
          if (activeLooper) {
            activeLooper.play();
          }
        } else if (mediaRef.current) {
          await mediaRef.current.play();
        }
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Playback failed:', error);
    }
  };

  const handleTimeUpdate = () => {
    // For video files, use HTML5 video element time update
    if (!isAudio && mediaRef.current) {
      const currentTime = mediaRef.current.currentTime;
      setCurrentTime(currentTime);
      
      // Simple loop handling for video files
      if (isABLooping && loopStart !== null && loopEnd !== null && currentTime >= loopEnd) {
        mediaRef.current.currentTime = loopStart;
        setLoopCount(loopCount + 1);
        const newCount = currentLoopCount + 1;
        setCurrentLoopCount(newCount);
        // Trigger auto speed ramp logic
        handleAutoSpeedRamp(newCount);
      }
    }
    // For audio files, time updates are handled by Web Audio API callbacks
  };

  const handleLoadedMetadata = () => {
    if (mediaRef.current) {
      setDuration(mediaRef.current.duration || 0);
    }
  };

  const handleProgressClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!duration || isDragging) return;
    
    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickRatio = clickX / rect.width;
    const newTime = clickRatio * duration;
    
    if (isAudio) {
      const activeLooper = useWorkletAudio ? workletLooper.current : webAudioLooper.current;
      if (activeLooper) {
        activeLooper.seek(newTime);
      }
    } else if (mediaRef.current) {
      mediaRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const calculateTimeFromPosition = (clientX: number) => {
    if (!progressBarRef.current || !duration) return 0;
    
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const clickRatio = Math.max(0, Math.min(1, clickX / rect.width));
    return clickRatio * duration;
  };

  const handleMarkerDragStart = (event: React.MouseEvent | React.TouchEvent, type: 'start' | 'end') => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
    setDragType(type);
    
    // Store playback state and pause for scrubbing
    setWasPlayingBeforeDrag(isPlaying);
    if (isAudio) {
      const activeLooper = useWorkletAudio ? workletLooper.current : webAudioLooper.current;
      if (activeLooper) {
        activeLooper.pause();
      }
    } else if (mediaRef.current) {
      mediaRef.current.pause();
    }
    setIsPlaying(false);
    
    // Set initial scrub time
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const initialTime = calculateTimeFromPosition(clientX);
    setLastScrubTime(initialTime);
  };

  const handleMarkerDrag = (event: MouseEvent | TouchEvent) => {
    if (!isDragging || !dragType) return;
    
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const newTime = calculateTimeFromPosition(clientX);
    
    // Real-time scrubbing - throttle to prevent excessive seeking
    if (Math.abs(newTime - lastScrubTime) > 0.016) { // ~60fps throttle
      if (isAudio) {
        const activeLooper = useWorkletAudio ? workletLooper.current : webAudioLooper.current;
        if (activeLooper) {
          activeLooper.seek(newTime);
        }
      } else if (mediaRef.current) {
        mediaRef.current.currentTime = newTime;
        setCurrentTime(newTime);
      }
      setLastScrubTime(newTime);
    }
    
    if (dragType === 'start') {
      const maxTime = loopEnd !== null ? loopEnd : duration;
      setLoopStart(Math.max(0, Math.min(newTime, maxTime)));
    } else if (dragType === 'end') {
      const minTime = loopStart !== null ? loopStart : 0;
      setLoopEnd(Math.max(minTime, Math.min(newTime, duration)));
    }
  };

  const handleMarkerDragEnd = () => {
    setIsDragging(false);
    setDragType(null);
    
    // Clear any pending scrub timeout
    if (scrubTimeout) {
      clearTimeout(scrubTimeout);
      setScrubTimeout(null);
    }
    
    // Restore playback state after scrubbing
    if (wasPlayingBeforeDrag) {
      if (isAudio) {
        const activeLooper = useWorkletAudio ? workletLooper.current : webAudioLooper.current;
        if (activeLooper) {
          activeLooper.play();
        }
      } else if (mediaRef.current) {
        mediaRef.current.play().catch(console.error);
      }
      setIsPlaying(true);
    }
    
    setWasPlayingBeforeDrag(false);
    setLastScrubTime(0);
  };

  // Add global event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      const handlePointerMove = (e: PointerEvent) => handleMarkerDrag(e);
      const handlePointerUp = () => handleMarkerDragEnd();

      document.addEventListener('pointermove', handlePointerMove, { passive: true });
      document.addEventListener('pointerup', handlePointerUp);

      return () => {
        document.removeEventListener('pointermove', handlePointerMove);
        document.removeEventListener('pointerup', handlePointerUp);
      };
    }
  }, [isDragging, dragType, loopStart, loopEnd, duration]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSetLoopStart = () => {
    setLoopStart(currentTime);
  };

  const handleSetLoopEnd = () => {
    setLoopEnd(currentTime);
  };

  const toggleABLoop = () => {
    if (loopStart !== null && loopEnd !== null) {
      setIsABLooping(!isABLooping);
    }
  };

  const clearLoop = () => {
    setLoopStart(null);
    setLoopEnd(null);
    setIsABLooping(false);
    setLoopCount(0);
    setIsWaveformZoomed(false); // Reset zoom when clearing loop
  };

  const handleZoomToggle = () => {
    if (loopStart !== null && loopEnd !== null) {
      setIsWaveformZoomed(!isWaveformZoomed);
    }
  };

  const getNudgeIncrement = () => {
    if (isAudio) {
      return 0.005; // 5ms precision for audio
    } else {
      // For video, try to detect frame rate or use default 60fps equivalent
      return 1/60; // ~0.017s for 60fps equivalent
    }
  };

  const handleNudgeLoopStart = (direction: 'left' | 'right') => {
    if (loopStart === null) return;
    
    const increment = getNudgeIncrement();
    const newTime = direction === 'left' 
      ? Math.max(0, loopStart - increment)
      : Math.min(loopEnd !== null ? loopEnd : duration, loopStart + increment);
    
    setLoopStart(newTime);
    
    // Update current playback position for immediate feedback
    if (isAudio) {
      const activeLooper = useWorkletAudio ? workletLooper.current : webAudioLooper.current;
      if (activeLooper) {
        activeLooper.seek(newTime);
      }
    } else if (mediaRef.current) {
      mediaRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleNudgeLoopEnd = (direction: 'left' | 'right') => {
    if (loopEnd === null) return;
    
    const increment = getNudgeIncrement();
    const newTime = direction === 'left' 
      ? Math.max(loopStart !== null ? loopStart : 0, loopEnd - increment)
      : Math.min(duration, loopEnd + increment);
    
    setLoopEnd(newTime);
    
    // Update current playback position for immediate feedback
    if (isAudio) {
      const activeLooper = useWorkletAudio ? workletLooper.current : webAudioLooper.current;
      if (activeLooper) {
        activeLooper.seek(newTime);
      }
    } else if (mediaRef.current) {
      mediaRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const toggleFullscreen = async () => {
    if (!videoContainerRef.current) return;

    try {
      if (!isFullscreen) {
        // Enter fullscreen
        if (videoContainerRef.current.requestFullscreen) {
          await videoContainerRef.current.requestFullscreen();
        } else if ((videoContainerRef.current as any).webkitRequestFullscreen) {
          await (videoContainerRef.current as any).webkitRequestFullscreen();
        }
      } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
      }
    } catch (error) {
      console.error('Fullscreen toggle failed:', error);
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement || !!(document as any).webkitFullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Cumulative playback timer logic
  useEffect(() => {
    if (isPlaying) {
      // Reset current session and start timer
      setCurrentSessionTime(0);
      
      // Update every second
      const interval = setInterval(() => {
        setCurrentSessionTime(currentSessionTime + 1);
      }, 1000);
      
      setPlaybackTimerInterval(interval);
    } else {
      // Stop timing and accumulate session time to total
      if (playbackTimerInterval) {
        setTotalPlaybackTime(totalPlaybackTime + currentSessionTime);
        setCurrentSessionTime(0);
        clearInterval(playbackTimerInterval);
        setPlaybackTimerInterval(null);
      }
    }
    
    return () => {
      if (playbackTimerInterval) {
        clearInterval(playbackTimerInterval);
      }
    };
  }, [isPlaying]);

  // Reset cumulative timer when new media is loaded
  useEffect(() => {
    if (hasMedia) {
      setTotalPlaybackTime(0);
      setCurrentSessionTime(0);
      if (playbackTimerInterval) {
        clearInterval(playbackTimerInterval);
        setPlaybackTimerInterval(null);
      }
    }
  }, [hasMedia]);

  // Format cumulative time as HH:MM:SS
  const formatCumulativeTime = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  const speedPresets = [{
    label: "50%",
    value: 50
  }, {
    label: "75%",
    value: 75
  }, {
    label: "100%",
    value: 100
  }];

  // Pointer-first handlers with guarded click fallbacks
  const fileImportHandlers = usePointerActionGuard(() => fileInputRef.current?.click());
  const fullscreenHandlers = usePointerActionGuard(() => { if (hasMedia) toggleFullscreen(); });
  const playPauseHandlers = usePointerActionGuard(() => { if (hasMedia) togglePlayPause(); });
  const loopToggleHandlers = usePointerActionGuard(() => { if (hasMedia) setIsLooping(!isLooping); });
  const setLoopStartHandlers = usePointerActionGuard(() => { if (hasMedia) handleSetLoopStart(); });
  const setLoopEndHandlers = usePointerActionGuard(() => { if (hasMedia) handleSetLoopEnd(); });
  const abLoopHandlers = usePointerActionGuard(() => { if (hasMedia) toggleABLoop(); });
  const clearLoopHandlers = usePointerActionGuard(() => { if (hasMedia) clearLoop(); });
  const zoomHandlers = usePointerActionGuard(() => { if (hasMedia) handleZoomToggle(); });
  const tapTempoHandlers = usePointerActionGuard(() => { if (hasMedia) handleTapTempo(); });

  // Hold-to-repeat for precise nudging
  const nudgeStartLeftHold = useHoldToRepeat({ onAction: () => { if (hasMedia && loopStart !== null) handleNudgeLoopStart('left'); } });
  const nudgeStartRightHold = useHoldToRepeat({ onAction: () => { if (hasMedia && loopStart !== null) handleNudgeLoopStart('right'); } });
  const nudgeEndLeftHold = useHoldToRepeat({ onAction: () => { if (hasMedia && loopEnd !== null) handleNudgeLoopEnd('left'); } });
  const nudgeEndRightHold = useHoldToRepeat({ onAction: () => { if (hasMedia && loopEnd !== null) handleNudgeLoopEnd('right'); } });
  return <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <ConditionalTooltip content={tooltipContent.infoToggle}>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "w-8 h-8 rounded-full transition-colors duration-200",
                isTooltipModeActive 
                  ? "text-yellow-500 bg-yellow-500/10 active:bg-yellow-500/20" 
                  : "text-gray-600 active:text-gray-800 active:bg-gray-100"
              )}
              onClick={() => setIsTooltipModeActive(!isTooltipModeActive)}
            >
              <Info size={16} className="italic" />
            </Button>
          </ConditionalTooltip>
          <h1 className="text-xl font-bold text-primary">🎸FretLoop</h1>
        </div>
        <ConditionalTooltip content={tooltipContent.import}>
          <Button variant="outline" size="sm" {...fileImportHandlers} className="gap-2">
            <Upload size={16} />
            Import Video
          </Button>
        </ConditionalTooltip>
      </div>

      {/* Main Player Area */}
      <div className="flex-1 p-4">
        <div className="space-y-4">
          {/* Upload Card - Show when no media */}
          {!hasMedia && (
            <Card className="h-64 bg-gradient-card border-border shadow-card">
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mb-6">
                  <Upload className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-2xl font-bold mb-4">Import Your Media</h2>
                <p className="text-muted-foreground mb-6 max-w-md">
                  Upload a video file or drag and drop here. Supports MP4, MOV, MP3, WAV, and more.
                </p>
                <Button {...fileImportHandlers} className="bg-gradient-primary transition-all duration-300 active:brightness-95">
                  <Upload className="w-4 h-4 mr-2" />
                  Choose Media File
                </Button>
              </div>
            </Card>
          )}

          {/* Video/Audio Display Area - Show when media loaded */}
          {hasMedia && (
            <Card className="aspect-video bg-gradient-card border-border shadow-card relative overflow-hidden" ref={videoContainerRef}>
              {mediaUrl && !isAudio && (
                <video
                  ref={mediaRef as React.RefObject<HTMLVideoElement>}
                  src={mediaUrl}
                  className="w-full h-full object-contain"
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  preload="metadata"
                  controls={false}
                  playsInline
                  webkit-playsinline="true"
                />
              )}
              
              {/* Fullscreen Toggle Button */}
              {mediaUrl && !isAudio && (
                <ConditionalTooltip content={tooltipContent.fullscreen}>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute top-2 right-2 bg-black/50 active:bg-black/70 text-white border-none"
                    {...fullscreenHandlers}
                  >
                    {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
                  </Button>
                </ConditionalTooltip>
              )}
              {mediaUrl && isAudio && (
                <>
                  <audio
                    ref={mediaRef as React.RefObject<HTMLAudioElement>}
                    src={mediaUrl}
                    className="hidden"
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    preload="metadata"
                    controls={false}
                  />
                </>
              )}
              {mediaUrl && isAudio && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Play className="w-8 h-8 text-primary" />
                    </div>
                    <p className="text-muted-foreground">Audio loaded - Ready to practice</p>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Unified Waveform + Progress Display */}
          <Card className="p-4 bg-gradient-card border-border">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{formatTime(currentTime)}</span>
                <span>Waveform & Progress</span>
                <span>{formatTime(duration)}</span>
              </div>
              <WaveformProgressDisplay
                audioBuffer={audioBuffer}
                currentTime={currentTime}
                duration={duration}
                loopStart={loopStart}
                loopEnd={loopEnd}
                onSeek={hasMedia ? (time) => {
                  if (isAudio) {
                    const activeLooper = useWorkletAudio ? workletLooper.current : webAudioLooper.current;
                    if (activeLooper) {
                      activeLooper.seek(time);
                    }
                  } else if (mediaRef.current) {
                    mediaRef.current.currentTime = time;
                    setCurrentTime(time);
                  }
                } : undefined}
                onMarkerDrag={hasMedia ? (type, time) => {
                  // Handle marker dragging
                  if (type === 'start') {
                    const maxTime = loopEnd !== null ? loopEnd : duration;
                    setLoopStart(Math.max(0, Math.min(time, maxTime)));
                  } else if (type === 'end') {
                    const minTime = loopStart !== null ? loopStart : 0;
                    setLoopEnd(Math.max(minTime, Math.min(time, duration)));
                  }
                  
                  // Real-time scrubbing
                  if (isAudio) {
                    const activeLooper = useWorkletAudio ? workletLooper.current : webAudioLooper.current;
                    if (activeLooper) {
                      activeLooper.seek(time);
                    }
                  } else if (mediaRef.current) {
                    mediaRef.current.currentTime = time;
                    setCurrentTime(time);
                  }
                } : undefined}
                zoomToLoop={isWaveformZoomed}
                isZoomed={isWaveformZoomed}
              />
            </div>
          </Card>

          {/* Main Controls */}
          <Card className="p-4 bg-gradient-card border-border">
            <div className="flex items-center justify-center gap-4 mb-4">
              <ConditionalTooltip content={tooltipContent.restart}>
                <Button variant="outline" size="icon" className="w-12 h-12" disabled={!hasMedia}>
                  <RotateCcw size={20} />
                </Button>
              </ConditionalTooltip>
              
              <ConditionalTooltip content={tooltipContent.playPause}>
                  <Button 
                    {...playPauseHandlers}
                    className={cn(
                      "w-16 h-16 transition-all duration-300 active:brightness-95",
                      hasMedia 
                        ? "bg-gradient-primary" 
                        : "bg-gradient-primary/50 cursor-not-allowed"
                    )}
                    disabled={!hasMedia}
                  >
                  {isPlaying ? <Pause size={24} /> : <Play size={24} />}
                </Button>
              </ConditionalTooltip>
              
              <ConditionalTooltip content={tooltipContent.looping}>
                <Button 
                  variant={isLooping ? "default" : "outline"} 
                  size="icon" 
                  className={cn(
                    "w-12 h-12", 
                    isLooping && hasMedia && "bg-gradient-primary shadow-glow"
                  )} 
                  {...loopToggleHandlers}
                  disabled={!hasMedia}
                >
                  <Repeat size={20} />
                </Button>
              </ConditionalTooltip>
            </div>

            {/* Loop Controls */}
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex flex-col items-center gap-4">
                <span className="font-medium text-sm">Loop Controls</span>
                
                {/* Centered Loop Controls */}
                <div className="flex items-center justify-center gap-4">
                  {/* Loop Start (A) with Nudge Controls */}
                  <div className="flex items-center gap-1">
                    <ConditionalTooltip content={tooltipContent.nudgeStartLeft}>
                      <Button 
                        variant="outline" 
                        size="icon"
                        {...nudgeStartLeftHold}
                        disabled={!hasMedia || loopStart === null}
                        className="w-8 h-8"
                      >
                        <ChevronLeft size={14} />
                      </Button>
                    </ConditionalTooltip>
                    <ConditionalTooltip content={tooltipContent.loopStart}>
                      <Button 
                        variant={loopStart !== null ? "default" : "outline"} 
                        size="sm"
                        {...setLoopStartHandlers}
                        disabled={!hasMedia}
                        className={cn(
                          "transition-colors duration-200 active:brightness-95",
                          loopStart !== null && hasMedia
                            ? "bg-primary text-primary-foreground" 
                            : "bg-black text-white active:bg-gray-800"
                        )}
                      >
                        A
                      </Button>
                    </ConditionalTooltip>
                    <ConditionalTooltip content={tooltipContent.nudgeStartRight}>
                      <Button 
                        variant="outline" 
                        size="icon"
                        {...nudgeStartRightHold}
                        disabled={!hasMedia || loopStart === null}
                        className="w-8 h-8"
                      >
                        <ChevronRight size={14} />
                      </Button>
                    </ConditionalTooltip>
                  </div>

                  {/* Loop End (B) with Nudge Controls */}
                  <div className="flex items-center gap-1">
                    <ConditionalTooltip content={tooltipContent.nudgeEndLeft}>
                      <Button 
                        variant="outline" 
                        size="icon"
                        {...nudgeEndLeftHold}
                        disabled={!hasMedia || loopEnd === null}
                        className="w-8 h-8"
                      >
                        <ChevronLeft size={14} />
                      </Button>
                    </ConditionalTooltip>
                    <ConditionalTooltip content={tooltipContent.loopEnd}>
                      <Button 
                        variant={loopEnd !== null ? "default" : "outline"} 
                        size="sm"
                        {...setLoopEndHandlers}
                        disabled={!hasMedia}
                        className={cn(
                          "transition-colors duration-200 active:brightness-95",
                          loopEnd !== null && hasMedia
                            ? "bg-primary text-primary-foreground" 
                            : "bg-black text-white active:bg-gray-800"
                        )}
                      >
                        B
                      </Button>
                    </ConditionalTooltip>
                    <ConditionalTooltip content={tooltipContent.nudgeEndRight}>
                      <Button 
                        variant="outline" 
                        size="icon"
                        {...nudgeEndRightHold}
                        disabled={!hasMedia || loopEnd === null}
                        className="w-8 h-8"
                      >
                        <ChevronRight size={14} />
                      </Button>
                    </ConditionalTooltip>
                  </div>

                  {/* Toggle A-B Loop */}
                  <ConditionalTooltip content={tooltipContent.abLoop}>
                    <Button 
                      variant={isABLooping ? "default" : "outline"}
                      size="sm"
                      {...abLoopHandlers}
                      disabled={!hasMedia || loopStart === null || loopEnd === null}
                      className={cn(
                        "transition-colors duration-200",
                        isABLooping && hasMedia && (loopStart !== null && loopEnd !== null)
                          ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                          : "bg-black text-white hover:bg-gray-800"
                      )}
                    >
                      A-B Loop
                    </Button>
                  </ConditionalTooltip>

                  {/* Clear Loop */}
                  <ConditionalTooltip content={tooltipContent.clearLoop}>
                    <Button 
                      variant="outline" 
                      size="sm"
                      {...clearLoopHandlers}
                      disabled={!hasMedia || (loopStart === null && loopEnd === null)}
                      className="bg-black text-white active:bg-gray-800 transition-colors duration-200"
                    >
                      <X size={14} className="mr-1" />
                      Clear
                    </Button>
                  </ConditionalTooltip>

                  {/* Zoom to Loop */}
                  <ConditionalTooltip content={loopStart === null || loopEnd === null ? "Zoom to loop region (requires A and B points)" : "Zoom waveform to show loop region"}>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={hasMedia ? handleZoomToggle : undefined}
                      disabled={!hasMedia || loopStart === null || loopEnd === null}
                      className={cn(
                        "transition-colors duration-200",
                        isWaveformZoomed && hasMedia && (loopStart !== null && loopEnd !== null)
                          ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/30 active:bg-yellow-500/20" 
                          : "bg-black text-white active:bg-gray-800"
                      )}
                    >
                      <ZoomIn size={14} />
                    </Button>
                  </ConditionalTooltip>
                </div>
                
                {loopCount > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Loop count: {loopCount}
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Speed and Volume Controls */}
          <Card className="p-4 bg-gradient-card border-border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Speed</label>
                  <div className="flex items-center gap-1">
                    <ConditionalTooltip content={tooltipContent.speedInput}>
                      <Input
                        value={speedInput}
                        onChange={hasMedia ? handleSpeedInputChange : undefined}
                        onBlur={hasMedia ? handleSpeedInputBlur : undefined}
                        onKeyPress={hasMedia ? handleSpeedInputKeyPress : undefined}
                        className="w-16 h-8 text-center text-primary font-bold px-1"
                        type="text"
                        disabled={!hasMedia}
                      />
                    </ConditionalTooltip>
                    <span className="text-primary font-bold">%</span>
                  </div>
                </div>
                <ConditionalTooltip content={tooltipContent.speed}>
                  <DraggableSlider
                    value={speed[0]}
                    onChange={hasMedia ? (v) => setSpeed([Math.round(v)]) : () => {}}
                    min={25}
                    max={200}
                    step={1}
                    className="w-full"
                    disabled={!hasMedia}
                    aria-label="Speed"
                  />
                </ConditionalTooltip>
                <div className="flex gap-2">
                  {speedPresets.map(preset => (
                    <ConditionalTooltip key={preset.value} content={tooltipContent.speedPreset}>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={hasMedia ? () => setSpeed([preset.value]) : undefined} 
                        disabled={!hasMedia}
                        className={cn(
                          "flex-1", 
                          speed[0] === preset.value && hasMedia && "bg-primary/20 border-primary"
                        )}
                      >
                        {preset.label}
                      </Button>
                    </ConditionalTooltip>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Volume</label>
                  <span className="text-primary font-bold">{volume[0]}%</span>
                </div>
                <ConditionalTooltip content={tooltipContent.volume}>
                  <DraggableSlider
                    value={volume[0]}
                    onChange={hasMedia ? (v) => setVolume([Math.round(v)]) : () => {}}
                    min={0}
                    max={100}
                    step={5}
                    className="w-full"
                    disabled={!hasMedia}
                    aria-label="Volume"
                  />
                </ConditionalTooltip>
              </div>
            </div>

            {/* Auto-SpeedRamp Controls */}
            <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-start gap-3 mb-4">
              <ConditionalTooltip content={tooltipContent.autoSpeedRamp}>
                <Switch
                  id="auto-speed-ramp"
                  checked={autoSpeedRampEnabled}
                  onCheckedChange={setAutoSpeedRampEnabled}
                  disabled={!hasMedia}
                  className="data-[state=unchecked]:bg-gray-600"
                />
              </ConditionalTooltip>
              <Label htmlFor="auto-speed-ramp" className="text-sm font-medium">
                Auto-SpeedRamp
              </Label>
            </div>
              
              <div className="grid grid-cols-4 gap-4 transition-opacity duration-200">
                {/* Tap Tempo - Now First Column and Independent */}
                <div className="text-center">
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    Tap Tempo
                  </Label>
                  <div className="flex flex-col items-center gap-2">
                    <ConditionalTooltip content="Tap to set target BPM tempo - works independently of AutoSpeedRamp">
                      <Button
                        {...tapTempoHandlers}
                        variant="outline"
                        size="icon"
                        className={cn(
                          "w-8 h-8 transition-all duration-150",
                          isTapping && "bg-yellow-500/20 border-yellow-500 shadow-lg scale-105",
                          !hasMedia && "opacity-40 pointer-events-none"
                        )}
                        disabled={!hasMedia}
                      >
                        <Clock className="h-4 w-4" />
                      </Button>
                    </ConditionalTooltip>
                    {tapTimes.length > 0 && tapTimes.length < 4 && (
                      <div className="text-xs text-muted-foreground">
                        {tapTimes.length}/4
                      </div>
                    )}
                  </div>
                </div>

                {/* AutoSpeedRamp Controls - Columns 2-4 */}
                <div className={cn(
                  !autoSpeedRampEnabled && "opacity-40 pointer-events-none"
                )}>
                  <SpeedRampControl
                    label="Loops Before Increase"
                    value={loopsBeforeIncrease}
                    onChange={setLoopsBeforeIncrease}
                    min={1}
                    max={50}
                    step={1}
                    disabled={!hasMedia || !autoSpeedRampEnabled}
                  />
                </div>
                
                <div className={cn(
                  !autoSpeedRampEnabled && "opacity-40 pointer-events-none"
                )}>
                  <SpeedRampControl
                    label="Speed Increase %"
                    value={speedIncreasePercent}
                    onChange={setSpeedIncreasePercent}
                    min={0.5}
                    max={25}
                    step={0.5}
                    disabled={!hasMedia || !autoSpeedRampEnabled}
                  />
                </div>
                
                <div className={cn(
                  !autoSpeedRampEnabled && "opacity-40 pointer-events-none"
                )}>
                  <SpeedRampControl
                    label="Max Speed %"
                    value={maxSpeedPercent}
                    onChange={setMaxSpeedPercent}
                    min={75}
                    max={200}
                    step={1}
                    disabled={!hasMedia || !autoSpeedRampEnabled}
                  />
                </div>
              </div>
            </div>

            {/* BPM and Stats */}
            <div className="mt-4 pt-4 border-t border-border grid grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-sm text-muted-foreground">Current BPM</div>
                <div className="text-lg font-bold text-primary">{displayBpm}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Loops</div>
                <div className="text-lg font-bold text-primary">{loopCount}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Time</div>
                <div className="text-lg font-bold text-primary">{formatCumulativeTime(totalPlaybackTime + currentSessionTime)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Streak</div>
                <div className="text-lg font-bold text-primary">0 🔥</div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept="video/*,audio/*" onChange={handleFileUpload} className="hidden" />
    </div>;
}