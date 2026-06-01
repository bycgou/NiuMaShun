import { BrowserWindow, ipcMain, Menu, dialog, app } from 'electron';
import path from 'path';
import fs from 'fs';
import { initialize as remoteInit, enable as remoteEnable } from '@electron/remote/main';
import Database from '../database';
import { mapEventToAction } from './event-mapper';
import { getRandomGreeting, getLevelName } from './pet-state';
import { generateAiSpeech, getPresetLine, isAiOnCooldown } from './ai-speech';
import { PetAction } from '../../shared/pet-types';
import { fetchManifest, downloadPet, getLocalPets, PetManifestEntry } from './pet-downloader';

let petWindow: BrowserWindow | null = null;
let db: Database;
let lastEventAt = Date.now();
let greetingInterval: ReturnType<typeof setInterval> | null = null;

function getAvailablePets(): string[] {
  const homeDir = process.env.USERPROFILE || process.env.HOME || '';
  const petsDir = path.join(homeDir, '.petdex-cc', 'pets');
  try {
    return fs.readdirSync(petsDir).filter(name => {
      const spritePath = path.join(petsDir, name, 'spritesheet.webp');
      const spritePathPng = path.join(petsDir, name, 'spritesheet.png');
      return fs.existsSync(spritePath) || fs.existsSync(spritePathPng);
    });
  } catch {
    return [];
  }
}

async function loadWithRetry(win: BrowserWindow, url: string, maxRetries = 20, delayMs = 500): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await win.loadURL(url);
      return;
    } catch {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

export function createPetWindow(database: Database): BrowserWindow {
  db = database;
  remoteInit();

  petWindow = new BrowserWindow({
    width: 300,
    height: 320,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    focusable: true,
    show: false,
    x: 100,
    y: 100,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
    },
  });

  petWindow.on('ready-to-show', () => {
    petWindow?.show();
  });

  // 加载宠物 HTML
  if (process.env.NODE_ENV === 'development') {
    loadWithRetry(petWindow, 'http://localhost:5173/pet/pet.html');
  } else {
    const htmlPath = path.join(__dirname, '../../../renderer/pet/pet.html');
    petWindow.loadFile(htmlPath);
  }
  remoteEnable(petWindow.webContents);

  petWindow.setVisibleOnAllWorkspaces(true);
  petWindow.setAlwaysOnTop(true, 'screen-saver');
  petWindow.setIgnoreMouseEvents(true, { forward: true });

  // 窗口失焦时重新置顶
  petWindow.on('blur', () => {
    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.setAlwaysOnTop(true, 'screen-saver');
    }
  });

  // 注册 IPC 处理
  registerIpcHandlers();

  // 启动时间问候
  greetingInterval = setInterval(showTimeGreeting, 30 * 60 * 1000);

  return petWindow;
}

function registerIpcHandlers(): void {
  ipcMain.on('pet:get-state', (event) => {
    const state = db.getPetState();
    event.reply('pet:state', state);
  });

  ipcMain.on('pet:show-context-menu', async () => {
    if (!petWindow || petWindow.isDestroyed()) return;
    const currentState = db.getPetState();
    const currentSlug = currentState?.petSlug || 'boba';
    const localPets = getAvailablePets();

    const petMenuItems = localPets.map(slug => ({
      label: slug === currentSlug ? `✓ ${slug}` : `    ${slug}`,
      click: () => {
        db.updatePetState({ petSlug: slug });
        petWindow?.webContents.send('pet:switched', slug);
      },
    }));

    // Fetch remote manifest for "download" submenu
    let downloadMenuItems: Electron.MenuItemConstructorOptions[] = [{ label: '加载中...', enabled: false }];
    try {
      const manifest = await fetchManifest();
      const remoteOnly = manifest.filter(p => !localPets.includes(p.slug)).slice(0, 30);
      if (remoteOnly.length === 0) {
        downloadMenuItems = [{ label: '所有宠物已下载', enabled: false }];
      } else {
        downloadMenuItems = remoteOnly.map(entry => ({
          label: entry.displayName,
          click: async () => {
            petWindow?.webContents.send('pet:download-start', entry.slug);
            try {
              await downloadPet(entry);
              db.updatePetState({ petSlug: entry.slug });
              petWindow?.webContents.send('pet:switched', entry.slug);
              petWindow?.webContents.send('pet:download-done', { slug: entry.slug, ok: true });
            } catch (err: any) {
              petWindow?.webContents.send('pet:download-done', { slug: entry.slug, ok: false, error: err.message });
            }
          },
        }));
      }
    } catch {
      downloadMenuItems = [{ label: '获取列表失败', enabled: false }];
    }

    const menu = Menu.buildFromTemplate([
      {
        label: petWindow.isVisible() ? '隐藏宠物' : '显示宠物',
        click: () => {
          if (petWindow!.isVisible()) {
            petWindow!.hide();
          } else {
            petWindow!.showInactive();
          }
        },
      },
      { type: 'separator' },
      {
        label: '切换宠物',
        type: 'submenu',
        submenu: petMenuItems,
      },
      {
        label: '下载新宠物',
        type: 'submenu',
        submenu: downloadMenuItems,
      },
      { type: 'separator' },
      {
        label: '关于',
        click: async () => {
          dialog.showMessageBox({
            type: 'info',
            title: '牛马顺宠物',
            message: '牛马顺桌面宠物',
            detail: '基于 petdex-cc 的桌面宠物伴侣',
          });
        },
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => app.quit(),
      },
    ]);
    menu.popup({ window: petWindow! });
  });

  ipcMain.on('pet:switch', (_event, slug: string) => {
    db.updatePetState({ petSlug: slug });
    petWindow?.webContents.send('pet:switched', slug);
  });

  ipcMain.handle('pet:manifest', async () => {
    return fetchManifest();
  });

  ipcMain.handle('pet:local-pets', () => {
    return getLocalPets();
  });

  ipcMain.handle('pet:download', async (event, slug: string) => {
    const manifest = await fetchManifest();
    const entry = manifest.find(p => p.slug === slug);
    if (!entry) throw new Error(`Pet "${slug}" not found in manifest`);

    await downloadPet(entry, (loaded, total) => {
      petWindow?.webContents.send('pet:download-progress', { slug, loaded, total });
    });
    return { ok: true };
  });
}

export async function handlePetEvent(event: Record<string, unknown>): Promise<void> {
  lastEventAt = Date.now();
  const action = mapEventToAction(event);

  // 更新宠物状态
  const oldState = db.getPetState();
  const newState = db.incrementPetEvents(1);
  const leveledUp = newState && oldState && newState.level > oldState.level;

  // 记录宠物事件
  db.insertPetEvent({
    eventType: (event.hook_event_name as string) || 'unknown',
    petAction: action.stateId,
    bubbleText: action.bubbleText,
  });

  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.webContents.send('pet:action', action);

    if (leveledUp) {
      petWindow.webContents.send('pet:level-up', {
        level: newState!.level,
        levelName: getLevelName(newState!.level),
      });
    }

    // AI 语音
    if (action.triggerAi && action.aiScene) {
      let speech: string | null = null;
      if (!isAiOnCooldown() || leveledUp) {
        const state = db.getPetState();
        speech = await generateAiSpeech({
          petName: state?.petSlug || 'boba',
          vibes: [],
          levelName: getLevelName(state?.level || 1),
          scene: action.aiScene,
          skipCooldown: leveledUp,
        });
      }
      if (!speech) {
        speech = getPresetLine(action.aiScene);
      }
      petWindow.webContents.send('pet:ai-speech', { text: speech });
    }
  }
}

function showTimeGreeting(): void {
  const idleMs = Date.now() - lastEventAt;
  if (idleMs < 10 * 60 * 1000) return;

  const greeting = getRandomGreeting();
  if (!greeting) return;

  petWindow?.webContents.send('pet:action', {
    stateId: 'waving',
    bubbleText: greeting,
    triggerAi: false,
  });
}

export function sendTokenUpdate(data: { total_tokens: number; cost_usd: number }): void {
  petWindow?.webContents.send('pet:token-update', data);
}

export function getPetWindow(): BrowserWindow | null {
  return petWindow;
}

export function destroyPetWindow(): void {
  if (greetingInterval) {
    clearInterval(greetingInterval);
    greetingInterval = null;
  }
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.destroy();
  }
  petWindow = null;
}
