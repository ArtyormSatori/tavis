/**
 * Minimal replacement for `@radix-ui/react-use-controllable-state`, which the
 * upstream AI Elements sources import directly. This repo takes Radix through
 * the unified `radix-ui` package only, and that package does not re-export the
 * hook, so it is reimplemented here with the same call signature.
 */
import { useCallback, useRef, useState } from 'react';

export interface UseControllableStateParams<T> {
  /** The controlled value. When defined, the caller owns the state. */
  prop?: T;
  /** Initial value used while uncontrolled. */
  defaultProp: T;
  /** Called with the next value on every change, controlled or not. */
  onChange?: (value: T) => void;
}

export function useControllableState<T>({
  prop,
  defaultProp,
  onChange,
}: UseControllableStateParams<T>): [T, (value: T) => void] {
  const [uncontrolled, setUncontrolled] = useState<T>(defaultProp);
  const isControlled = prop !== undefined;
  const value = isControlled ? (prop as T) : uncontrolled;

  // Keep the latest of both in refs so the returned setter is referentially
  // stable — callers put it in effect dependency arrays.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const isControlledRef = useRef(isControlled);
  isControlledRef.current = isControlled;
  const valueRef = useRef(value);
  valueRef.current = value;

  const setValue = useCallback((next: T) => {
    if (!isControlledRef.current) setUncontrolled(next);
    if (!Object.is(valueRef.current, next)) onChangeRef.current?.(next);
  }, []);

  return [value, setValue];
}
