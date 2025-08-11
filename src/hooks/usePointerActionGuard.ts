import { useCallback, useRef } from "react";

// Provides pointer-first handlers with a guarded click fallback to avoid double-firing
export function usePointerActionGuard<T extends HTMLElement = HTMLElement>(
  action: () => void
) {
  const handledRef = useRef(false);

  const onPointerDown = useCallback((e: React.PointerEvent<T>) => {
    e.preventDefault();
    e.stopPropagation();
    handledRef.current = true;
    action();
  }, [action]);

  const onPointerUp = useCallback(() => {
    handledRef.current = false;
  }, []);

  const onPointerCancel = useCallback(() => {
    handledRef.current = false;
  }, []);

  const onClick = useCallback(() => {
    if (!handledRef.current) action();
    handledRef.current = false;
  }, [action]);

  return { onPointerDown, onPointerUp, onPointerCancel, onClick };
}
