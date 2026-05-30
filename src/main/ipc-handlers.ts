import { ipcMain, BrowserWindow, dialog } from 'electron';
import Database from './database';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import { Granularity } from '../shared/types';

export default class IpcHandlers {
  private db: Database;
  private currentProjectId: number | null = null;
  private currentGranularity: Granularity = 'event';
  private mainWindow: BrowserWindow;
  private onProjectAdded: ((id: number, path: string) => void) | null = null;

  constructor(db: Database, mainWindow: BrowserWindow) {
    this.db = db;
    this.mainWindow = mainWindow;
    this.registerHandlers();
  }

  setOnProjectAdded(callback: (id: number, path: string) => void): void {
    this.onProjectAdded = callback;
  }

  private registerHandlers(): void {
    ipcMain.handle(IPC_CHANNELS.PROJECT_LIST, () => {
      return this.db.getProjects();
    });

    ipcMain.handle(IPC_CHANNELS.PROJECT_ADD, async () => {
      const result = await dialog.showOpenDialog(this.mainWindow, {
        properties: ['openDirectory'],
      });
      if (result.canceled || result.filePaths.length === 0) return null;

      const projectPath = result.filePaths[0];
      const name = projectPath.split(/[\\/]/).pop() || 'Unknown';

      try {
        const id = this.db.addProject(name, projectPath);
        this.currentProjectId = id;
        // Notify main process to start monitoring
        this.onProjectAdded?.(id, projectPath);
        return { id, name, path: projectPath };
      } catch {
        return null;
      }
    });

    ipcMain.handle(IPC_CHANNELS.PROJECT_SWITCH, (_event, projectId: number) => {
      this.currentProjectId = projectId;
      return this.db.getProject(projectId);
    });

    ipcMain.handle(IPC_CHANNELS.PROJECT_REMOVE, (_event, projectId: number) => {
      this.db.removeProject(projectId);
      if (this.currentProjectId === projectId) {
        const projects = this.db.getProjects();
        this.currentProjectId = projects[0]?.id ?? null;
      }
    });

    ipcMain.handle(IPC_CHANNELS.KLINE_GET, (_event, projectId: number, granularity: Granularity) => {
      return this.db.getKlines(projectId, granularity);
    });

    ipcMain.handle(IPC_CHANNELS.EVENTS_GET, (_event, projectId: number, limit: number) => {
      return this.db.getRecentEvents(projectId, limit || 50);
    });

    ipcMain.handle(IPC_CHANNELS.TICKER_GET, (_event, projectId: number) => {
      return this.db.getTickerData(projectId);
    });

    ipcMain.handle(IPC_CHANNELS.TOKEN_RANKING_GET, (_event, projectId: number) => {
      return this.db.getTokenRanking(projectId);
    });

    ipcMain.handle(IPC_CHANNELS.DAILY_STATS_GET, (_event, projectId: number) => {
      return this.db.getDailyStats(projectId);
    });

    ipcMain.handle(IPC_CHANNELS.GRANULARITY_SET, (_event, granularity: Granularity) => {
      this.currentGranularity = granularity;
    });

    ipcMain.handle(IPC_CHANNELS.GRANULARITY_GET, () => {
      return this.currentGranularity;
    });

    ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, () => {
      this.mainWindow.minimize();
    });

    ipcMain.handle(IPC_CHANNELS.WINDOW_MAXIMIZE, () => {
      if (this.mainWindow.isMaximized()) {
        this.mainWindow.unmaximize();
      } else {
        this.mainWindow.maximize();
      }
    });

    ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, () => {
      this.mainWindow.close();
    });
  }

  getCurrentProjectId(): number | null {
    return this.currentProjectId;
  }

  getCurrentGranularity(): Granularity {
    return this.currentGranularity;
  }

  sendToRenderer(channel: string, data: any): void {
    this.mainWindow.webContents.send(channel, data);
  }
}
