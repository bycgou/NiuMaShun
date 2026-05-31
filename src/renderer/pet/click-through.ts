import { BrowserWindow } from 'electron';

export function initClickThrough(
  win: BrowserWindow,
  petEl: HTMLElement,
): void {
  win.setIgnoreMouseEvents(true, { forward: true });

  petEl.addEventListener('mouseenter', () => {
    win.setIgnoreMouseEvents(false);
  });

  petEl.addEventListener('mouseleave', () => {
    win.setIgnoreMouseEvents(true, { forward: true });
  });
}
