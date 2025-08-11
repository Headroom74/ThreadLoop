import { useCallback, useRef } from "react";

interface UseHoldToRepeatOptions {
  onAction: () => void;
  delay?: number;
  interval?: number;
}

export const useHoldToRepeat = ({ onAction, delay = 300, interval = 100 }: UseHoldToRepeatOptions) => {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const handledRef = useRef(false);

  const start = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();

    handledRef.current = true;
    // Execute once immediately
    onAction();

    // Set up delayed continuous execution
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(onAction, interval);
    }, delay);
  }, [onAction, delay, interval]);

  const stop = useCallback((e?: React.PointerEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    handledRef.current = false;
  }, []);

  const click = useCallback(() => {
    if (!handledRef.current) onAction();
    handledRef.current = false;
  }, [onAction]);

  return {
    onPointerDown: start,
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    onClick: click,
  };
};