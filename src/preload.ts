import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from './shared/ipc-channels';
import { Granularity } from './shared/types';

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
