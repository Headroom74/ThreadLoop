import React, { useRef, useEffect, useState, useCallback } from 'react';

interface WaveformDisplayProps {
  audioBuffer: AudioBuffer | null;
  currentTime: number;
  duration: number;
  loopStart: number | null;
  loopEnd: number | null;
  onSeek: (time: number) => void;
  className?: string;
}

const WaveformDisplay: React.FC<WaveformDisplayProps> = ({
  audioBuffer,
  currentTime,
  duration,
  loopStart,
  loopEnd,
  onSeek,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);

  // Generate waveform data from audio buffer
  useEffect(() => {
    if (!audioBuffer) {
      setWaveformData([]);
      return;
    }

    const targetSamples = 1500; // High-resolution waveform
    const downsampleFactor = Math.floor(audioBuffer.length / targetSamples);
    const data: number[] = [];

    // Mix down to mono and find peaks
    for (let i = 0; i < audioBuffer.length; i += downsampleFactor) {
      let peak = 0;
      for (let j = 0; j < downsampleFactor && i + j < audioBuffer.length; j++) {
        let sample = 0;
        // Average all channels for mono mixdown
        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
          sample += Math.abs(audioBuffer.getChannelData(channel)[i + j]);
        }
        sample /= audioBuffer.numberOfChannels;
        peak = Math.max(peak, sample);
      }
      data.push(peak);
    }

    setWaveformData(data);
  }, [audioBuffer]);

  // Render waveform on canvas
  const renderWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveformData.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    const centerY = height / 2;
    const barWidth = width / waveformData.length;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw waveform
    ctx.fillStyle = 'hsl(43, 96%, 65%)';
    waveformData.forEach((peak, index) => {
      const x = index * barWidth;
      const barHeight = peak * centerY * 0.8;
      
      // Draw bar from center outward
      ctx.fillRect(x, centerY - barHeight, Math.max(barWidth - 0.5, 0.5), barHeight * 2);
    });

    // Draw loop start indicator
    if (loopStart !== null && duration > 0) {
      const x = (loopStart / duration) * width;
      ctx.strokeStyle = 'hsl(43, 96%, 75%)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Draw loop end indicator
    if (loopEnd !== null && duration > 0) {
      const x = (loopEnd / duration) * width;
      ctx.strokeStyle = 'hsl(43, 100%, 70%)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Draw current playhead
    if (duration > 0) {
      const x = (currentTime / duration) * width;
      ctx.strokeStyle = 'hsl(var(--foreground))';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
  }, [waveformData, currentTime, duration, loopStart, loopEnd]);

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      canvas.width = rect.width * dpr;
      canvas.height = 80 * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = '80px';
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
      
      renderWaveform();
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [renderWaveform]);

  // Re-render when dependencies change
  useEffect(() => {
    renderWaveform();
  }, [renderWaveform]);

  // Handle mouse events
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!duration) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = (x / rect.width) * duration;
    
    setHoverTime(time);
    setHoverPosition({ x: e.clientX, y: e.clientY });
  };

  const handleMouseLeave = () => {
    setHoverTime(null);
    setHoverPosition(null);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!duration) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = (x / rect.width) * duration;
    
    onSeek(time);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = (time % 60).toFixed(1);
    return `${minutes}:${seconds.padStart(4, '0')}`;
  };

  if (!audioBuffer || waveformData.length === 0) {
    return (
      <div className={`h-20 bg-secondary/20 rounded-lg flex items-center justify-center ${className}`}>
        <span className="text-muted-foreground text-sm">No waveform data</span>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <canvas
        ref={canvasRef}
        className="w-full h-20 cursor-default rounded-lg bg-secondary/10"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      />
      
      {/* Hover tooltip */}
      {hoverTime !== null && hoverPosition && (
        <div
          className="fixed z-50 bg-popover text-popover-foreground px-2 py-1 rounded shadow-lg text-xs pointer-events-none"
          style={{
            left: hoverPosition.x + 10,
            top: hoverPosition.y - 30
          }}
        >
          {formatTime(hoverTime)}
        </div>
      )}
    </div>
  );
};

export default WaveformDisplay;