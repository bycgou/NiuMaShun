import { ipcMain, BrowserWindow, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import Database from './database';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import { Granularity, FileTreeNode } from '../shared/types';
import { EXCLUDED_DIRS } from '../shared/constants';

export default class IpcHandlers {
  private db: Database;
  private currentProjectId: number | null = null;
  private currentGranularity: Granularity = 'event';
  private mainWindow: BrowserWindow;
  private onProjectAdded: ((id: number, path: string) => void) | null = null;
  private onProjectSwitched: ((id: number) => void) | null = null;

  constructor(db: Database, mainWindow: BrowserWindow) {
    this.db = db;
    this.mainWindow = mainWindow;
    this.registerHandlers();
  }

  setOnProjectAdded(callback: (id: number, path: string) => void): void {
    this.onProjectAdded = callback;
  }

  setOnProjectSwitched(callback: (id: number) => void): void {
    this.onProjectSwitched = callback;
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
      // 通知主进程开始监控新项目
      this.onProjectSwitched?.(projectId);
      return this.db.getProject(projectId);
    });

    ipcMain.handle(IPC_CHANNELS.PROJECT_REMOVE, (_event, projectId: number) => {
      this.db.removeProject(projectId);
      if (this.currentProjectId === projectId) {
        const projects = this.db.getProjects();
        this.currentProjectId = projects[0]?.id ?? null;
      }
    });

    ipcMain.handle(IPC_CHANNELS.EVENTS_GET, (_event, projectId: number, limit: number) => {
      return this.db.getRecentEvents(projectId, limit || 50);
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

    ipcMain.handle(IPC_CHANNELS.FILE_TREE_GET, (_event, projectId: number) => {
      const project = this.db.getProject(projectId);
      if (!project) return [];
      return this.scanFileTree(project.path);
    });

    // 获取文件股票列表
    ipcMain.handle('stocks:get', (_event, projectId: number) => {
      return this.db.getFileStocks(projectId);
    });

    // 获取单个文件的 K 线数据
    ipcMain.handle('kline:file:get', (_event, projectId: number, filePath: string, granularity: Granularity) => {
      return this.db.getFileKlines(projectId, filePath, granularity);
    });

    // 获取单个文件的股票信息
    ipcMain.handle('stock:file:get', (_event, projectId: number, filePath: string) => {
      return this.db.getFileStock(projectId, filePath);
    });
  }

  private scanFileTree(dirPath: string, relativePath = ''): FileTreeNode[] {
    const nodes: FileTreeNode[] = [];
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      // Sort: directories first, then files
      const sorted = entries.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

      for (const entry of sorted) {
        // Skip excluded directories
        if (EXCLUDED_DIRS.includes(entry.name)) continue;
        // Skip hidden files/dirs (starting with .)
        if (entry.name.startsWith('.')) continue;

        const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          const children = this.scanFileTree(path.join(dirPath, entry.name), entryRelativePath);
          if (children.length > 0) {
            nodes.push({
              name: entry.name,
              path: entryRelativePath,
              type: 'directory',
              children,
            });
          }
        } else {
          nodes.push({
            name: entry.name,
            path: entryRelativePath,
            type: 'file',
          });
        }
      }
    } catch {
      // Ignore permission errors
    }
    return nodes;
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
