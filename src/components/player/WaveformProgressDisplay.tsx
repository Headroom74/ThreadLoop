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

const WaveformProgressDisplay: React.FC<WaveformProgressDisplayProps> = ({
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
    }, []),
    onError: useCallback((error: string) => {
      console.error('Waveform generation error:', error);
      setWaveformData([]);
    }, [])
  });

  // Generate waveform data using Web Worker
  useEffect(() => {
    if (!audioBuffer) {
      setWaveformData([]);
      return;
    }

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

    const blockSize = Math.floor((endSample - startSample) / samples);
    const newWaveformData: number[] = [];

    for (let i = 0; i < samples; i++) {
      const start = startSample + i * blockSize;
      const end = Math.min(start + blockSize, endSample);
      let peak = 0;

      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const channelData = audioBuffer.getChannelData(channel);
        for (let j = start; j < end; j++) {
          peak = Math.max(peak, Math.abs(channelData[j]));
        }
      }

      newWaveformData.push(peak);
    }

    setWaveformData(newWaveformData);
  }, [audioBuffer, zoomToLoop, loopStart, loopEnd, duration]);

  // Render waveform and progress
  const renderDisplay = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !duration) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    // Draw waveform background
    ctx.fillStyle = 'hsl(240, 10%, 15%)';
    ctx.fillRect(0, 0, width, WAVEFORM_HEIGHT);

    // Draw waveform bars
    if (waveformData.length > 0) {
      const barWidth = width / waveformData.length;
      const centerY = WAVEFORM_HEIGHT / 2;

      ctx.fillStyle = 'hsl(43, 96%, 65%)';
      waveformData.forEach((peak, index) => {
        const x = index * barWidth;
        const barHeight = peak * centerY * 0.8;
        ctx.fillRect(x, centerY - barHeight / 2, barWidth - 1, barHeight);
      });
    }

    // Draw progress bar background (rounded)
    const progressY = WAVEFORM_HEIGHT;
    const progressCenterY = progressY + PROGRESS_HEIGHT / 2;
    const trackHeight = 8; // Match volume slider height
    const trackRadius = trackHeight / 2;
    
    ctx.fillStyle = 'hsl(240, 10%, 20%)';
    ctx.beginPath();
    ctx.roundRect(0, progressCenterY - trackRadius, width, trackHeight, trackRadius);
    ctx.fill();

    // Calculate display times and positions based on zoom state
    const displayDuration = zoomToLoop && loopStart !== null && loopEnd !== null ? loopEnd - loopStart : duration;
    const displayStartTime = zoomToLoop && loopStart !== null ? loopStart : 0;
    const displayCurrentTime = zoomToLoop ? currentTime - displayStartTime : currentTime;
    
    // Draw progress fill (rounded)
    const progressWidth = Math.max(0, Math.min(width, (displayCurrentTime / displayDuration) * width));
    if (progressWidth > 0) {
      ctx.fillStyle = 'hsl(43, 96%, 65%)';
      ctx.beginPath();
      ctx.roundRect(0, progressCenterY - trackRadius, progressWidth, trackHeight, trackRadius);
      ctx.fill();
    }

    // Draw loop region in progress bar (rounded) - only in normal view
    if (!zoomToLoop && loopStart !== null && loopEnd !== null) {
      const startX = (loopStart / duration) * width;
      const endX = (loopEnd / duration) * width;
      
      // Loop region highlight
      ctx.fillStyle = 'hsl(43, 96%, 75%, 0.3)';
      ctx.beginPath();
      ctx.roundRect(startX, progressCenterY - trackRadius, endX - startX, trackHeight, trackRadius);
      ctx.fill();
    }

    // Draw loop markers with vertical arms - adjust for zoom
    if (loopStart !== null) {
      let x;
      if (zoomToLoop) {
        // In zoom mode, loop start is at the left edge
        x = 0;
      } else {
        x = (loopStart / duration) * width;
      }
      
      // Vertical arm extending from progress bar to waveform
      ctx.strokeStyle = 'hsl(43, 96%, 75%)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, progressY);
      ctx.lineTo(x, 0);
      ctx.stroke();

      // Loop start marker (A) - positioned at top of waveform
      drawLoopMarker(ctx, x, 10, 'A', 'hsl(43, 96%, 75%)');
    }

    if (loopEnd !== null) {
      let x;
      if (zoomToLoop) {
        // In zoom mode, loop end is at the right edge
        x = width;
      } else {
        x = (loopEnd / duration) * width;
      }
      
      // Vertical arm extending from progress bar to waveform
      ctx.strokeStyle = 'hsl(43, 100%, 70%)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, progressY);
      ctx.lineTo(x, 0);
      ctx.stroke();

      // Loop end marker (B) - positioned at top of waveform
      drawLoopMarker(ctx, x, 10, 'B', 'hsl(43, 100%, 70%)');
    }

    // Draw playhead (black circle)
    const playheadX = (displayCurrentTime / displayDuration) * width;
    drawPlayhead(ctx, playheadX, progressCenterY);

  }, [waveformData, currentTime, duration, loopStart, loopEnd, zoomToLoop]);

  // Draw loop marker
  const drawLoopMarker = (ctx: CanvasRenderingContext2D, x: number, y: number, label: string, color: string) => {
    const radius = 8;
    
    // Circle background
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fill();

    // Label text
    ctx.fillStyle = 'black';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y);
  };

  // Draw playhead
  const drawPlayhead = (ctx: CanvasRenderingContext2D, x: number, centerY: number) => {
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
  };

  // Canvas setup and resize handling
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = TOTAL_HEIGHT;
      renderDisplay();
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [renderDisplay]);

  // Render on state changes
  useEffect(() => {
    renderDisplay();
  }, [renderDisplay]);

  // Calculate time from mouse position
  const getTimeFromMouseEvent = (event: React.MouseEvent) => {
    if (!containerRef.current || !duration) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    
    if (zoomToLoop && loopStart !== null && loopEnd !== null) {
      // In zoom mode, map to the loop region
      return loopStart + ratio * (loopEnd - loopStart);
    }
    
    return ratio * duration;
  };

  // Check if click is on a marker
  const getMarkerAtPosition = (event: React.MouseEvent): 'start' | 'end' | null => {
    if (!containerRef.current || !duration) return null;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Check if click is in the top area of the waveform (where markers are positioned)
    if (y < 0 || y > 20) return null;
    
    const tolerance = 12;
    
    if (loopStart !== null) {
      let startX;
      if (zoomToLoop) {
        startX = 0; // Loop start is at left edge when zoomed
      } else {
        startX = (loopStart / duration) * rect.width;
      }
      if (Math.abs(x - startX) <= tolerance) return 'start';
    }
    
    if (loopEnd !== null) {
      let endX;
      if (zoomToLoop) {
        endX = rect.width; // Loop end is at right edge when zoomed
      } else {
        endX = (loopEnd / duration) * rect.width;
      }
      if (Math.abs(x - endX) <= tolerance) return 'end';
    }
    
    return null;
  };

  // Pointer event handlers
  const handlePointerDown = (event: React.PointerEvent) => {
    try { (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId); } catch {}
    const marker = getMarkerAtPosition(event as unknown as React.MouseEvent);
    
    if (marker) {
      setIsDragging(true);
      setDragType(marker);
    } else {
      setIsDragging(true);
      setDragType('playhead');
      const time = getTimeFromMouseEvent(event as unknown as React.MouseEvent);
      onSeek(time);
    }
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    const time = getTimeFromMouseEvent(event as unknown as React.MouseEvent);
    setHoverTime(time);
    setHoverX(event.clientX);

    if (isDragging && dragType) {
      if (dragType === 'playhead') {
        onSeek(time);
      } else {
        onMarkerDrag(dragType, time);
      }
    }
  };

  const handlePointerUp = (event?: React.PointerEvent) => {
    try { if (event) (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId); } catch {}
    setIsDragging(false);
    setDragType(null);
  };

  const handlePointerLeave = () => {
    setHoverTime(null);
    if (isDragging) {
      handlePointerUp();
    }
  };
  // Global mouse event listeners for dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleGlobalMouseMove = (event: MouseEvent) => {
      if (!containerRef.current || !duration) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, x / rect.width));
      
      let time;
      if (zoomToLoop && loopStart !== null && loopEnd !== null) {
        // In zoom mode, map to the loop region
        time = loopStart + ratio * (loopEnd - loopStart);
      } else {
        time = ratio * duration;
      }

      if (dragType === 'playhead') {
        onSeek(time);
      } else if (dragType) {
        onMarkerDrag(dragType, time);
      }
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);
      setDragType(null);
    };

    document.addEventListener('pointermove', handleGlobalMouseMove as any, { passive: true });
    document.addEventListener('pointerup', handleGlobalMouseUp as any);

    return () => {
      document.removeEventListener('pointermove', handleGlobalMouseMove as any);
      document.removeEventListener('pointerup', handleGlobalMouseUp as any);
    };
  }, [isDragging, dragType, duration, onSeek, onMarkerDrag]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
};

export default WaveformProgressDisplay;