// Platform detection — true when running inside the Electron desktop shell.
//
// Two complementary signals:
//
// 1. window.__CEDAR_IS_DESKTOP__ — set by apps/desktop/preload.cjs via
//    contextBridge. Authoritative at runtime in the renderer.
//
// 2. import.meta.env.VITE_DESKTOP_BUILD — set by the desktop build script
//    ('build:desktop-web') at compile time. Useful for tree-shaking and as a
//    fallback if a module reads isDesktop before the preload has injected the
//    global (rare, but possible during early module init).
//
// Either signal being truthy means we're in desktop mode. Web build sees
// neither, so isDesktop === false everywhere.

declare global {
  interface Window {
    __CEDAR_IS_DESKTOP__?: boolean;
  }
}

const windowFlag =
  typeof window !== 'undefined' && window.__CEDAR_IS_DESKTOP__ === true;

const buildFlag =
  typeof import.meta !== 'undefined' &&
  (import.meta as any).env?.VITE_DESKTOP_BUILD === '1';

export const isDesktop: boolean = windowFlag || buildFlag;
