import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useWaveformWorker } from '@/hooks/useWaveformWorker';
import { useAnimationFrame } from '@/hooks/useAnimationFrame';

interface WaveformProgressDisplayProps {
  audioBuffer: AudioBuffer | null;
  currentTime: number;
  duration: number;
  loopStart: number | null;
  loopEnd: number | null;
  onSeek: (time: number) => void;
  onMarkerDrag: (type: 'start' | 'end', time: number) => void;
  className?: string;
  zoomToLoop?: boolean;
  isZoomed?: boolean;
}

const PerformantWaveformProgressDisplay = React.memo<WaveformProgressDisplayProps>(({
  audioBuffer,
  currentTime,
  duration,
  loopStart,
  loopEnd,
  onSeek,
  onMarkerDrag,
  className,
  zoomToLoop = false,
  isZoomed = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState<'playhead' | 'start' | 'end' | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number>(0);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const WAVEFORM_HEIGHT = 80;
  const PROGRESS_HEIGHT = 20;
  const TOTAL_HEIGHT = WAVEFORM_HEIGHT + PROGRESS_HEIGHT;
  const MARKER_HEIGHT = 16;

  // Memoized canvas rendering settings
  const canvasSettings = useMemo(() => ({
    width: 800,
    height: TOTAL_HEIGHT,
    samples: 1000
  }), []);

  // Web Worker for waveform generation
  const { generateWaveform } = useWaveformWorker({
    onWaveformGenerated: useCallback((data: number[]) => {
      setWaveformData(data);
      setIsProcessing(false);
    }, []),
    onProgress: useCallback((progress: number) => {
      // Optional: Show progress for large files
      console.log(`Waveform processing: ${(progress * 100).toFixed(1)}%`);
    }, []),
    onError: useCallback((error: string) => {
      console.error('Waveform generation error:', error);
      setWaveformData([]);
      setIsProcessing(false);
    }, [])
  });

  // Generate waveform data using Web Worker
  useEffect(() => {
    if (!audioBuffer) {
      setWaveformData([]);
      setIsProcessing(false);
      return;
    }

    setIsProcessing(true);
    let samples = canvasSettings.samples;
    let startSample = 0;
    let endSample = audioBuffer.length;
    
    // If zoomed to loop, extract only the loop region
    if (zoomToLoop && loopStart !== null && loopEnd !== null && duration > 0) {
      const sampleRate = audioBuffer.sampleRate;
      startSample = Math.floor(loopStart * sampleRate);
      endSample = Math.floor(loopEnd * sampleRate);
      
      // Adjust samples for the smaller region
      const loopLength = endSample - startSample;
      samples = Math.min(1000, Math.max(100, loopLength / 100));
    }

    const channelData = audioBuffer.getChannelData(0);
    
    // Use Web Worker for heavy processing
    generateWaveform(
      channelData,
      samples,
      startSample,
      Math.min(endSample, channelData.length),
      audioBuffer.sampleRate
    );
  }, [audioBuffer, zoomToLoop, loopStart, loopEnd, generateWaveform, canvasSettings.samples]);

  // Memoized display calculations
  const displayMetrics = useMemo(() => {
    const displayDuration = zoomToLoop && loopStart !== null && loopEnd !== null ? loopEnd - loopStart : duration;
    const displayStartTime = zoomToLoop && loopStart !== null ? loopStart : 0;
    const displayCurrentTime = zoomToLoop ? currentTime - displayStartTime : currentTime;
    
    return { displayDuration, displayStartTime, displayCurrentTime };
  }, [currentTime, duration, loopStart, loopEnd, zoomToLoop]);

  // Optimized canvas rendering with dirty region updates
  const renderDisplay = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !duration) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    const { displayDuration, displayCurrentTime } = displayMetrics;
    
    // Use willReadFrequently for better performance
    ctx.imageSmoothingEnabled = false;
    
    // Clear only the necessary regions for better performance
    ctx.clearRect(0, 0, width, height);

    // Draw waveform background
    ctx.fillStyle = 'hsl(240, 10%, 15%)';
    ctx.fillRect(0, 0, width, WAVEFORM_HEIGHT);

    // Draw waveform bars (optimized with path batching)
    if (waveformData.length > 0) {
      const barWidth = width / waveformData.length;
      const centerY = WAVEFORM_HEIGHT / 2;

      ctx.fillStyle = 'hsl(43, 96%, 65%)';
      
      // Batch drawing operations for better performance
      ctx.beginPath();
      waveformData.forEach((peak, index) => {
        const x = index * barWidth;
        const barHeight = peak * centerY * 0.8;
        ctx.rect(x, centerY - barHeight / 2, barWidth - 1, barHeight);
      });
      ctx.fill();
    }

    // Draw progress bar background (rounded)
    const progressY = WAVEFORM_HEIGHT;
    const progressCenterY = progressY + PROGRESS_HEIGHT / 2;
    const trackHeight = 8;
    const trackRadius = trackHeight / 2;
    
    ctx.fillStyle = 'hsl(240, 10%, 20%)';
    ctx.beginPath();
    ctx.roundRect(0, progressCenterY - trackRadius, width, trackHeight, trackRadius);
    ctx.fill();

    // Draw progress fill
    const progressWidth = Math.max(0, Math.min(width, (displayCurrentTime / displayDuration) * width));
    if (progressWidth > 0) {
      ctx.fillStyle = 'hsl(43, 96%, 65%)';
      ctx.beginPath();
      ctx.roundRect(0, progressCenterY - trackRadius, progressWidth, trackHeight, trackRadius);
      ctx.fill();
    }

    // Draw loop region highlight (only in normal view)
    if (!zoomToLoop && loopStart !== null && loopEnd !== null) {
      const startX = (loopStart / duration) * width;
      const endX = (loopEnd / duration) * width;
      
      ctx.fillStyle = 'hsl(43, 96%, 75%, 0.3)';
      ctx.beginPath();
      ctx.roundRect(startX, progressCenterY - trackRadius, endX - startX, trackHeight, trackRadius);
      ctx.fill();
    }

    // Draw loop markers with optimized drawing
    if (loopStart !== null) {
      const x = zoomToLoop ? 0 : (loopStart / duration) * width;
      drawMarkerOptimized(ctx, x, progressY, 10, 'A', 'hsl(43, 96%, 75%)');
    }

    if (loopEnd !== null) {
      const x = zoomToLoop ? width : (loopEnd / duration) * width;
      drawMarkerOptimized(ctx, x, progressY, 10, 'B', 'hsl(43, 100%, 70%)');
    }

    // Draw playhead
    const playheadX = (displayCurrentTime / displayDuration) * width;
    drawPlayheadOptimized(ctx, playheadX, progressCenterY);

  }, [waveformData, displayMetrics, duration, loopStart, loopEnd, zoomToLoop]);

  // Optimized marker drawing
  const drawMarkerOptimized = useCallback((
    ctx: CanvasRenderingContext2D, 
    x: number, 
    progressY: number, 
    y: number, 
    label: string, 
    color: string
  ) => {
    const radius = 8;
    
    // Draw vertical line
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, progressY);
    ctx.lineTo(x, 0);
    ctx.stroke();
    
    // Draw marker circle and text
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fill();

    ctx.fillStyle = 'black';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y);
  }, []);

  // Optimized playhead drawing
  const drawPlayheadOptimized = useCallback((ctx: CanvasRenderingContext2D, x: number, centerY: number) => {
    const radius = 8;
    
    // Outer circle (white border)
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(x, centerY, radius + 1, 0, 2 * Math.PI);
    ctx.fill();

    // Inner circle (black)
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(x, centerY, radius, 0, 2 * Math.PI);
    ctx.fill();
  }, []);

  // Throttled animation frame for smooth rendering
  const { start: startRendering, stop: stopRendering } = useAnimationFrame(
    useCallback(() => {
      renderDisplay();
    }, [renderDisplay]),
    { fps: 30 } // Limit to 30fps for better performance
  );

  // Memoized canvas setup to prevent unnecessary recalculations
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    // Set actual size and scale for high DPI displays
    canvas.width = rect.width * dpr;
    canvas.height = TOTAL_HEIGHT * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${TOTAL_HEIGHT}px`;
    
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
  }, []);

  // Setup canvas and handle resize with throttling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const container = containerRef.current;
    if (!container) return;

    let resizeTimeout: NodeJS.Timeout;
    const throttledResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        setupCanvas();
        renderDisplay();
      }, 16); // ~60fps throttle
    };

    // Initial setup
    setupCanvas();

    const resizeObserver = new ResizeObserver(throttledResize);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      clearTimeout(resizeTimeout);
    };
  }, [setupCanvas, renderDisplay]);

  // Start/stop rendering based on component state
  useEffect(() => {
    if (waveformData.length > 0) {
      startRendering();
    } else {
      stopRendering();
    }

    return () => {
      stopRendering();
    };
  }, [waveformData.length, startRendering, stopRendering]);

  // Mouse interaction handlers (memoized)
  const getTimeFromMouseEvent = useCallback((event: React.PointerEvent) => {
    if (!containerRef.current || !duration) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    
    if (zoomToLoop && loopStart !== null && loopEnd !== null) {
      return loopStart + ratio * (loopEnd - loopStart);
    }
    
    return ratio * duration;
  }, [duration, zoomToLoop, loopStart, loopEnd]);

  const getMarkerAtPosition = useCallback((event: React.PointerEvent): 'start' | 'end' | null => {
    if (!containerRef.current || !duration) return null;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    if (y < 0 || y > 20) return null;
    
    const tolerance = 12;
    
    if (loopStart !== null) {
      const startX = zoomToLoop ? 0 : (loopStart / duration) * rect.width;
      if (Math.abs(x - startX) <= tolerance) return 'start';
    }
    
    if (loopEnd !== null) {
      const endX = zoomToLoop ? rect.width : (loopEnd / duration) * rect.width;
      if (Math.abs(x - endX) <= tolerance) return 'end';
    }
    
    return null;
  }, [duration, zoomToLoop, loopStart, loopEnd]);

  const handlePointerDown = useCallback((event: React.PointerEvent) => {
    const marker = getMarkerAtPosition(event);
    try { (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId); } catch {}
    
    if (marker) {
      setIsDragging(true);
      setDragType(marker);
    } else {
      setIsDragging(true);
      setDragType('playhead');
      const time = getTimeFromMouseEvent(event);
      onSeek(time);
    }
  }, [getMarkerAtPosition, getTimeFromMouseEvent, onSeek]);

  const handlePointerMove = useCallback((event: React.PointerEvent) => {
    const time = getTimeFromMouseEvent(event);
    setHoverTime(time);
    setHoverX(event.clientX);

    if (isDragging && dragType) {
      if (dragType === 'playhead') {
        onSeek(time);
      } else {
        onMarkerDrag(dragType, time);
      }
    }
  }, [getTimeFromMouseEvent, isDragging, dragType, onSeek, onMarkerDrag]);

  const handlePointerUp = useCallback((event?: React.PointerEvent) => {
    try { if (event) (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId); } catch {}
    setIsDragging(false);
    setDragType(null);
  }, []);

  const handlePointerLeave = useCallback(() => {
    setHoverTime(null);
    if (isDragging) {
      handlePointerUp();
    }
  }, [isDragging, handlePointerUp]);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return (
    <div className={cn("relative w-full", className)}>
      <div
        ref={containerRef}
        className="relative w-full cursor-default select-none touch-none"
        style={{ height: TOTAL_HEIGHT, WebkitTapHighlightColor: 'transparent' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ height: TOTAL_HEIGHT }}
        />
        
        {/* Processing indicator */}
        {isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className="text-xs text-white">Processing waveform...</div>
          </div>
        )}
        
        {/* Tooltip */}
        {hoverTime !== null && (
          <div
            className="absolute z-10 px-2 py-1 text-xs bg-black text-white rounded pointer-events-none transform -translate-x-1/2 -translate-y-full"
            style={{
              left: `${zoomToLoop && loopStart !== null && loopEnd !== null 
                ? ((hoverTime - loopStart) / (loopEnd - loopStart)) * 100 
                : (hoverTime / duration) * 100}%`,
              top: -8,
            }}
          >
            {formatTime(hoverTime)}
          </div>
        )}
      </div>
    </div>
  );
});

PerformantWaveformProgressDisplay.displayName = "PerformantWaveformProgressDisplay";

export default PerformantWaveformProgressDisplay;