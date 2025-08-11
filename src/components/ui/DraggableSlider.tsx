import React, { useCallback, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface DraggableSliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function snapToStep(val: number, min: number, step: number) {
  const snapped = Math.round((val - min) / step) * step + min;
  const fixed = Number(snapped.toFixed(6));
  return fixed;
}

const DraggableSlider: React.FC<DraggableSliderProps> = ({
  value,
  min,
  max,
  step = 1,
  onChange,
  disabled = false,
  className,
  "aria-label": ariaLabel,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const percent = useMemo(() => {
    const ratio = (value - min) / (max - min);
    return clamp(ratio, 0, 1) * 100;
  }, [value, min, max]);

  const valueFromEvent = useCallback((e: React.PointerEvent) => {
    const el = containerRef.current;
    if (!el) return value;
    const rect = el.getBoundingClientRect();
    const ratio = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const raw = min + ratio * (max - min);
    return snapToStep(raw, min, step);
  }, [min, max, step, value]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch {}
    setIsDragging(true);
    const next = valueFromEvent(e);
    onChange(next);
  }, [disabled, onChange, valueFromEvent]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || disabled) return;
    e.preventDefault();
    const next = valueFromEvent(e);
    onChange(next);
  }, [isDragging, disabled, onChange, valueFromEvent]);

  const endDrag = useCallback((e?: React.PointerEvent) => {
    if (e) {
      try { (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId); } catch {}
    }
    setIsDragging(false);
  }, []);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    let delta = 0;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") delta = -step;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") delta = step;
    if (e.key === "PageDown") delta = -step * 10;
    if (e.key === "PageUp") delta = step * 10;
    if (e.key === "Home") { onChange(min); return; }
    if (e.key === "End") { onChange(max); return; }
    if (delta !== 0) {
      e.preventDefault();
      const next = clamp(snapToStep(value + delta, min, step), min, max);
      onChange(next);
    }
  }, [disabled, max, min, onChange, step, value]);

  return (
    <div
      ref={containerRef}
      role="slider"
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      tabIndex={disabled ? -1 : 0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
      className={cn(
        "relative w-full h-5 flex items-center select-none cursor-default touch-none",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      {/* Track */}
      <div className="relative h-2 w-full rounded-full bg-secondary">
        {/* Range */}
        <div className="absolute left-0 top-0 h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>

      {/* Thumb */}
      <div
        className={cn(
          "absolute top-1/2 -translate-y-1/2",
          "w-5 h-5 rounded-full border-2 border-primary bg-background",
          "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        )}
        style={{ left: `${percent}%`, transform: `translate(-50%, -50%)` }}
        aria-hidden
      />
    </div>
  );
};

export default DraggableSlider;
