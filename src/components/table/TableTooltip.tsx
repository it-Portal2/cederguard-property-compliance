import { useState, useRef, useEffect, useLayoutEffect, cloneElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import clsx from 'clsx';

interface TableTooltipProps {
  content: ReactNode;
  children: ReactElement<{
    onMouseEnter?: (e: React.MouseEvent) => void;
    onMouseLeave?: (e: React.MouseEvent) => void;
    onFocus?: (e: React.FocusEvent) => void;
    onBlur?: (e: React.FocusEvent) => void;
    onPointerDown?: (e: React.PointerEvent) => void;
    onClick?: (e: React.MouseEvent) => void;
    ref?: React.Ref<HTMLElement>;
  }>;
  variant?: 'cell' | 'action';
  align?: 'start' | 'center';
  delay?: number;
}

type Pos = { top: number; left: number; placement: 'top' | 'bottom' };

const MARGIN = 8;
const ARROW_SIZE = 5;

export default function TableTooltip({
  content,
  children,
  variant = 'cell',
  align = 'start',
  delay = 120,
}: TableTooltipProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const openTimer = useRef<number | null>(null);

  const compute = () => {
    const trigger = triggerRef.current;
    const tip = tooltipRef.current;
    if (!trigger || !tip) return;

    const rect = trigger.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let placement: 'top' | 'bottom' = 'top';
    let top = rect.top - tipRect.height - MARGIN;
    if (top < MARGIN) {
      placement = 'bottom';
      top = rect.bottom + MARGIN;
    }

    let left: number;
    if (align === 'center') {
      left = rect.left + rect.width / 2 - tipRect.width / 2;
    } else {
      left = rect.left;
    }

    if (left < MARGIN) left = MARGIN;
    if (left + tipRect.width > vw - MARGIN) left = vw - MARGIN - tipRect.width;
    if (placement === 'bottom' && top + tipRect.height > vh - MARGIN) {
      top = vh - MARGIN - tipRect.height;
    }

    setPos({ top, left, placement });
  };

  useLayoutEffect(() => {
    if (open) compute();
  }, [open, content]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => setOpen(false);
    const onResize = () => compute();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  useEffect(() => () => {
    if (openTimer.current) window.clearTimeout(openTimer.current);
  }, []);

  const show = () => {
    if (openTimer.current) window.clearTimeout(openTimer.current);
    openTimer.current = window.setTimeout(() => setOpen(true), delay);
  };
  const hide = () => {
    if (openTimer.current) window.clearTimeout(openTimer.current);
    setOpen(false);
  };

  const trigger = cloneElement(children, {
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node;
      const originalRef = (children as any).ref;
      if (typeof originalRef === 'function') originalRef(node);
      else if (originalRef) (originalRef as { current: HTMLElement | null }).current = node;
    },
    onMouseEnter: (e: React.MouseEvent) => {
      children.props.onMouseEnter?.(e);
      show();
    },
    onMouseLeave: (e: React.MouseEvent) => {
      children.props.onMouseLeave?.(e);
      hide();
    },
    onFocus: (e: React.FocusEvent) => {
      children.props.onFocus?.(e);
      const el = e.currentTarget as HTMLElement;
      try {
        if (typeof el.matches === 'function' && !el.matches(':focus-visible')) return;
      } catch {
        return;
      }
      show();
    },
    onBlur: (e: React.FocusEvent) => {
      children.props.onBlur?.(e);
      hide();
    },
    onPointerDown: (e: React.PointerEvent) => {
      children.props.onPointerDown?.(e);
      hide();
    },
    onClick: (e: React.MouseEvent) => {
      children.props.onClick?.(e);
      hide();
    },
  });

  // Arrow position relative to tooltip box
  const arrowStyle: React.CSSProperties | undefined = (() => {
    if (!pos || !triggerRef.current || !tooltipRef.current) return undefined;
    const rect = triggerRef.current.getBoundingClientRect();
    const tipRect = tooltipRef.current.getBoundingClientRect();
    const triggerCenterX = rect.left + rect.width / 2;
    const arrowLeft = Math.max(10, Math.min(tipRect.width - 18, triggerCenterX - pos.left - ARROW_SIZE));
    if (pos.placement === 'top') {
      return { left: arrowLeft, top: '100%' };
    }
    return { left: arrowLeft, bottom: '100%' };
  })();

  const origin = pos?.placement === 'top' ? 'bottom center' : 'top center';
  const initialY = pos?.placement === 'top' ? 4 : -4;

  const classes = variant === 'action'
    ? 'text-[10px] font-semibold uppercase tracking-wider rounded-md px-2.5 py-1.5 whitespace-nowrap'
    : 'text-[11px] leading-relaxed rounded-lg px-3 py-2 max-w-xs whitespace-pre-wrap break-words';

  return (
    <>
      {trigger}
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={tooltipRef}
              role="tooltip"
              initial={{ opacity: 0, scale: 0.92, y: initialY }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: initialY, transition: { duration: 0.1 } }}
              transition={{ type: 'spring', stiffness: 500, damping: 32, mass: 0.5 }}
              style={{
                position: 'fixed',
                top: pos?.top ?? -9999,
                left: pos?.left ?? -9999,
                zIndex: 2147483647,
                pointerEvents: 'none',
                transformOrigin: origin,
              }}
              className={clsx(
                'bg-slate-900 dark:bg-slate-800 text-white shadow-2xl ring-1 ring-white/10 w-max',
                classes
              )}
            >
              {content}
              {arrowStyle && (
                <div
                  className="absolute w-0 h-0"
                  style={{
                    ...arrowStyle,
                    borderLeft: `${ARROW_SIZE}px solid transparent`,
                    borderRight: `${ARROW_SIZE}px solid transparent`,
                    borderTop: pos?.placement === 'top' ? `${ARROW_SIZE}px solid` : undefined,
                    borderBottom: pos?.placement === 'bottom' ? `${ARROW_SIZE}px solid` : undefined,
                    borderTopColor: pos?.placement === 'top' ? 'rgb(15 23 42)' : undefined,
                    borderBottomColor: pos?.placement === 'bottom' ? 'rgb(15 23 42)' : undefined,
                  }}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
