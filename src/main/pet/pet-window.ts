import { BrowserWindow, ipcMain, Menu, dialog, app } from 'electron';
import path from 'path';
import electronRemote from '@electron/remote/main';
import Database from '../database';
import { mapEventToAction } from './event-mapper';
import { getRandomGreeting, getLevelName } from './pet-state';
import { generateAiSpeech, getPresetLine, isAiOnCooldown } from './ai-speech';
import { PetAction } from '../../shared/pet-types';

let petWindow: BrowserWindow | null = null;
let db: Database;
let lastEventAt = Date.now();
let greetingInterval: ReturnType<typeof setInterval> | null = null;

export function createPetWindow(database: Database): BrowserWindow {
  db = database;
  electronRemote.initialize();

  petWindow = new BrowserWindow({
    width: 300,
    height: 320,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
    },
  });

  // 加载宠物 HTML
  if (process.env.NODE_ENV === 'development') {
    petWindow.loadURL('http://localhost:5173/pet/pet.html');
  } else {
    const htmlPath = path.join(__dirname, '../../renderer/pet/pet.html');
    petWindow.loadFile(htmlPath);
  }
  electronRemote.enable(petWindow.webContents);

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

  ipcMain.on('pet:show-context-menu', () => {
    if (!petWindow || petWindow.isDestroyed()) return;
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
