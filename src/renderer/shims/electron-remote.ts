// Shim for @electron/remote in Vite dev mode.
const remote = (globalThis as any).require('@electron/remote');
export const { getCurrentWindow, screen, BrowserWindow, dialog, app } = remote;
export default remote;
