// Shim for electron module in Vite dev mode.
// With nodeIntegration: true, Electron's require is available on globalThis.
const electron = (globalThis as any).require('electron');
export const { ipcRenderer, shell, clipboard, nativeImage } = electron;
export default electron;
