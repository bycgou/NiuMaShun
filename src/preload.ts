import { contextBridge, ipcRenderer } from 'electron';

// Inline IPC channels to avoid module resolution issues in Electron preload sandbox
const IPC_CHANNELS = {
  PROJECT_ADD: 'project:add',
  PROJECT_REMOVE: 'project:remove',
  PROJECT_LIST: 'project:list',
  PROJECT_SWITCH: 'project:switch',
  KLINE_GET: 'kline:get',
  KLINE_UPDATE: 'kline:update',
  EVENTS_GET: 'events:get',
  EVENT_NEW: 'event:new',
  TICKER_GET: 'ticker:get',
  TICKER_UPDATE: 'ticker:update',
  FILE_TREE_GET: 'file-tree:get',
  FILE_TREE_UPDATE: 'file-tree:update',
  TOKEN_RANKING_GET: 'token-ranking:get',
  DAILY_STATS_GET: 'daily-stats:get',
  SESSION_TOGGLE: 'session:toggle',
  SESSION_GET: 'session:get',
  GRANULARITY_SET: 'granularity:set',
  GRANULARITY_GET: 'granularity:get',
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  STATUS_GET: 'status:get',
};

type Granularity = 'event' | '3min' | '5min' | '15min' | '1h' | '1d';

const api = {
  project: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_LIST),
    add: () => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_ADD),
    switch: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_SWITCH, id),
    remove: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_REMOVE, id),
  },
  kline: {
    get: (projectId: number, granularity: Granularity) =>
      ipcRenderer.invoke(IPC_CHANNELS.KLINE_GET, projectId, granularity),
  },
  events: {
    get: (projectId: number, limit?: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.EVENTS_GET, projectId, limit),
  },
  ticker: {
    get: (projectId: number) => ipcRenderer.invoke(IPC_CHANNELS.TICKER_GET, projectId),
  },
  tokenRanking: {
    get: (projectId: number) => ipcRenderer.invoke(IPC_CHANNELS.TOKEN_RANKING_GET, projectId),
  },
  dailyStats: {
    get: (projectId: number) => ipcRenderer.invoke(IPC_CHANNELS.DAILY_STATS_GET, projectId),
  },
  granularity: {
    set: (g: Granularity) => ipcRenderer.invoke(IPC_CHANNELS.GRANULARITY_SET, g),
    get: () => ipcRenderer.invoke(IPC_CHANNELS.GRANULARITY_GET),
  },
  window: {
    minimize: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MINIMIZE),
    maximize: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MAXIMIZE),
    close: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CLOSE),
  },
  onUpdate: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args));
  },
};

contextBridge.exposeInMainWorld('api', api);

export type ElectronApi = typeof api;
