import { useState, useCallback, useRef } from 'react';

interface UseThrottledStateOptions {
  throttleMs: number;
}

export const useThrottledState = <T>(
  initialValue: T,
  options: UseThrottledStateOptions
) => {
  const [state, setState] = useState<T>(initialValue);
  const lastUpdateRef = useRef<number>(0);
  const pendingUpdateRef = useRef<T | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const setThrottledState = useCallback((newValue: T) => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateRef.current;

    if (timeSinceLastUpdate >= options.throttleMs) {
      // Update immediately if enough time has passed
      setState(newValue);
      lastUpdateRef.current = now;
      
      // Clear any pending update
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      pendingUpdateRef.current = null;
    } else {
      // Store the pending update
      pendingUpdateRef.current = newValue;
      
      // Set a timeout to update later if no timeout is already set
      if (!timeoutRef.current) {
        const remainingTime = options.throttleMs - timeSinceLastUpdate;
        timeoutRef.current = setTimeout(() => {
          if (pendingUpdateRef.current !== null) {
            setState(pendingUpdateRef.current);
            lastUpdateRef.current = Date.now();
            pendingUpdateRef.current = null;
          }
          timeoutRef.current = null;
        }, remainingTime);
      }
    }
  }, [options.throttleMs]);

  return [state, setThrottledState] as const;
};