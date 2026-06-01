import { setSpriteImage, setPetAction, getPetElement } from './pet-sprite';
import { showBubble, showAiBubble, hideBubble } from './bubble';
import { initClickThrough } from './click-through';
import { initDrag } from './drag';
import { ipcRenderer } from 'electron';
import { getCurrentWindow, screen as remoteScreen } from '@electron/remote';
import { LEVEL_COLORS } from '../../shared/pet-types';

const WINDOW_W = 300;
const WINDOW_H = 320;
const MARGIN = 20;

const petEl = document.getElementById('pet-sprite') as HTMLElement;
const bubbleEl = document.getElementById('bubble') as HTMLElement;
const containerEl = document.getElementById('pet-container') as HTMLElement;

function getPetWindow(): Electron.BrowserWindow {
  return getCurrentWindow();
}

function positionBottomRight(): void {
  try {
    const display = remoteScreen.getPrimaryDisplay();
    const { x, y, width, height } = display.workArea;
    const win = getPetWindow();
    win.setPosition(
      x + width - WINDOW_W - MARGIN,
      y + height - WINDOW_H - MARGIN
    );
  } catch {
    const win = getPetWindow();
    win.setPosition(
      window.screen.width - WINDOW_W - MARGIN,
      window.screen.height - WINDOW_H - MARGIN
    );
  }
}

function init() {
  if (!petEl) return;

  positionBottomRight();
  initClickThrough(getPetWindow(), petEl);
  initDrag(petEl, getPetWindow());
  setPetAction('idle');

  petEl.addEventListener('contextmenu', (e: MouseEvent) => {
    e.preventDefault();
    ipcRenderer.send('pet:show-context-menu');
  });

  ipcRenderer.on('pet:action', (_event, action: { stateId: string; bubbleText: string }) => {
    if (action.stateId) setPetAction(action.stateId);
    if (action.bubbleText) showBubble(action.bubbleText);
  });

  ipcRenderer.on('pet:ai-speech', (_event, data: { text: string }) => {
    if (data.text) showAiBubble(data.text);
  });

  ipcRenderer.on('pet:level-up', (_event, data: { level: number; levelName: string }) => {
    showBubble(`升级啦！${data.levelName}！`);
    updateLevelEffects(data.level);
  });

  ipcRenderer.on('pet:switched', (_event, slug: string) => {
    loadPetSprite(slug);
  });

  ipcRenderer.on('pet:state', (_event, state: { petSlug: string; level: number; levelName: string }) => {
    loadPetSprite(state.petSlug);
    updateLevelEffects(state.level);
  });

  ipcRenderer.on('pet:token-update', (_event, data: { total_tokens: number; cost_usd: number }) => {
    updateTokenBadge(data.total_tokens);
  });

  ipcRenderer.on('pet:download-start', (_event, slug: string) => {
    showBubble(`正在下载 ${slug}...`, 10000);
    setPetAction('waiting');
  });

  ipcRenderer.on('pet:download-done', (_event, data: { slug: string; ok: boolean; error?: string }) => {
    if (data.ok) {
      showBubble('下载完成！切换中...', 3000);
      setPetAction('jumping');
    } else {
      showBubble(`下载失败: ${data.error || '未知错误'}`, 5000);
      setPetAction('failed');
    }
  });

  ipcRenderer.send('pet:get-state');
}

function loadPetSprite(slug: string) {
  if (!slug) return;
  const exts = ['webp', 'png'];
  for (const ext of exts) {
    const spritePath = `pet-sprite://${slug}/spritesheet.${ext}`;
    setSpriteImage(spritePath);
    break;
  }
}

const LEVEL_NAMES: Record<number, string> = {
  1: 'Byte', 2: 'Process', 3: 'Thread', 4: 'Module',
  5: 'Kernel', 6: 'Neural', 7: 'Quantum', 8: 'Singularity',
};

function updateTokenBadge(totalTokens: number) {
  const badge = document.getElementById('token-badge');
  if (!badge) return;
  let text: string;
  if (totalTokens < 1000) {
    text = `${totalTokens}`;
  } else if (totalTokens < 1_000_000) {
    text = `${(totalTokens / 1000).toFixed(1)}K`;
  } else {
    text = `${(totalTokens / 1_000_000).toFixed(2)}M`;
  }
  badge.textContent = text;
  badge.style.display = 'block';
}

function updateLevelEffects(level: number) {
  document.documentElement.style.setProperty('--lv-color', LEVEL_COLORS[level] ?? '#94a3b8');

  const badge = document.getElementById('level-badge');
  if (badge) {
    badge.textContent = `Lv${level} ${LEVEL_NAMES[level] ?? ''}`;
    badge.style.display = 'block';
  }

  const glow = document.getElementById('level-glow');
  if (glow) glow.classList.toggle('active', level >= 2);

  const aura = document.getElementById('level-aura');
  if (aura) aura.classList.toggle('active', level >= 3);

  document.querySelectorAll('.level-particle').forEach((p) => {
    (p as HTMLElement).classList.toggle('active', level >= 5);
  });

  const halo = document.getElementById('level-halo');
  if (halo) halo.classList.toggle('active', level >= 8);
}

init();
