import { useCallback, useRef, useEffect } from 'react';

interface UseAnimationFrameOptions {
  fps?: number; // Limit to specific FPS (e.g., 30fps instead of 60fps)
}

export const useAnimationFrame = (
  callback: (deltaTime: number) => void,
  options: UseAnimationFrameOptions = {}
) => {
  const requestRef = useRef<number>();
  const previousTimeRef = useRef<number>();
  const lastFrameTimeRef = useRef<number>(0);
  const isRunningRef = useRef<boolean>(false);

  const { fps } = options;
  const frameInterval = fps ? 1000 / fps : 0; // ms between frames

  const animate = useCallback((time: number) => {
    if (previousTimeRef.current !== undefined) {
      const deltaTime = time - previousTimeRef.current;
      
      // If FPS limit is set, only run callback at specified intervals
      if (fps && time - lastFrameTimeRef.current < frameInterval) {
        if (isRunningRef.current) {
          requestRef.current = requestAnimationFrame(animate);
        }
        return;
      }
      
      lastFrameTimeRef.current = time;
      callback(deltaTime);
    }
    
    previousTimeRef.current = time;
    
    if (isRunningRef.current) {
      requestRef.current = requestAnimationFrame(animate);
    }
  }, [callback, fps, frameInterval]);

  const start = useCallback(() => {
    if (!isRunningRef.current) {
      isRunningRef.current = true;
      requestRef.current = requestAnimationFrame(animate);
    }
  }, [animate]);

  const stop = useCallback(() => {
    isRunningRef.current = false;
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
  }, []);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return { start, stop, isRunning: () => isRunningRef.current };
};