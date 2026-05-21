import { useEffect, useState } from 'react';
import { animate, useReducedMotion } from 'motion/react';

type AnimatedCounterProps = {
  value: number;
  format?: (n: number) => string;
  durationMs?: number;
  className?: string;
};

export function AnimatedCounter({
  value,
  format = (n) => Math.round(n).toLocaleString(),
  durationMs = 800,
  className,
}: AnimatedCounterProps) {
  const prefersReducedMotion = useReducedMotion();
  const [display, setDisplay] = useState<number>(prefersReducedMotion ? value : 0);

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplay(value);
      return;
    }
    const controls = animate(display, value, {
      duration: durationMs / 1000,
      ease: [0.2, 0.65, 0.3, 0.9],
      onUpdate: (latest) => setDisplay(latest),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, prefersReducedMotion]);

  return (
    <span className={className} aria-live="polite">
      <span className="tabular-nums">{format(display)}</span>
    </span>
  );
}
