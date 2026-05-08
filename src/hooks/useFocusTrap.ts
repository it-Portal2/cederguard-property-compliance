import { useEffect, useRef } from "react";

// Workspace-wide modal focus-trap (WCAG 2.2 AA — Success Criterion 2.4.3
// Focus Order). When `active` is true:
//   1. Stores the previously-focused element on activation
//   2. Moves focus into the container (first focusable child)
//   3. Listens for Tab + Shift+Tab — wraps focus to first / last focusable
//      element, never letting focus escape into the page beneath
//   4. On deactivation, restores focus to the originally-focused element
//
// Usage:
//   const ref = useFocusTrap<HTMLDivElement>(open);
//   return open ? <div ref={ref}>...</div> : null;
//
// Notes:
// - Skipped entirely when `active === false`. Safe to call unconditionally.
// - Uses the standard focusable selector. Does NOT trap inside iframes
//   (those have their own keyboard contexts) — pragma for the EmbedPDF /
//   PDFViewer cases where we'd otherwise lose focus into the iframe.
// - Restores focus best-effort. If the previous element was removed from
//   the DOM (e.g. user closed the workspace via a router navigation) the
//   restore is a no-op rather than throwing.

const FOCUSABLE_SELECTOR = [
  "a[href]:not([disabled])",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1']):not([disabled])",
].join(",");

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const nodes = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
  // Filter out hidden / aria-hidden elements + ones inside an aria-hidden
  // ancestor (e.g. when motion's `<AnimatePresence>` mid-exit).
  return Array.from(nodes).filter((el) => {
    if (el.hasAttribute("aria-hidden") && el.getAttribute("aria-hidden") === "true") {
      return false;
    }
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    return true;
  });
}

export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const containerRef = useRef<T | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    // 1. Capture currently-focused element so we can restore later.
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

    // 2. Move focus into the container.
    const focusables = getFocusableElements(container);
    const initialTarget = focusables[0] ?? container;
    // requestAnimationFrame ensures the modal has rendered before we focus
    // — without this, motion's enter animation can race and steal focus.
    const raf = requestAnimationFrame(() => {
      try {
        initialTarget.focus({ preventScroll: false });
      } catch {
        // ignore — focusable detection is best-effort
      }
    });

    // 3. Trap Tab / Shift+Tab.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const currentFocusables = getFocusableElements(container);
      if (currentFocusables.length === 0) {
        // Nothing focusable inside — keep focus on the container.
        e.preventDefault();
        container.focus();
        return;
      }
      const first = currentFocusables[0];
      const last = currentFocusables[currentFocusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !container.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !container.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);

    // 4. Restore on deactivation.
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKeyDown);
      const previous = previouslyFocusedRef.current;
      if (previous && document.contains(previous)) {
        try {
          previous.focus({ preventScroll: true });
        } catch {
          // ignore
        }
      }
    };
  }, [active]);

  return containerRef;
}
