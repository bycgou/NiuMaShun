export type Granularity = 'event' | '3min' | '5min' | '15min' | '1h' | '1d';
export type StatusBadge = 'active' | 'ipo' | 'delisted' | 'hot';

export interface Project {
  id: number;
  name: string;
  path: string;
  isGitRepo: boolean;
  createdAt: string;
}

export interface KlineData {
  id: number;
  projectId: number;
  timestamp: string;
  granularity: Granularity;
  openScore: number;
  closeScore: number;
  highScore: number;
  lowScore: number;
  openLoc: number;
  closeLoc: number;
  volume: number;
  tokens: number;
  filesCreated: number;
  filesDeleted: number;
}

export interface EventRecord {
  id: number;
  projectId: number;
  filePath: string;
  timestamp: string;
  linesAdded: number;
  linesDeleted: number;
  fileCreated: boolean;
  fileDeleted: boolean;
  scoreDelta: number;
  tokens: number;
  sessionId: number | null;
}

export interface Session {
  id: number;
  projectId: number;
  startedAt: string;
  endedAt: string | null;
  totalTokens: number;
}

export interface FileTokenRecord {
  id: number;
  projectId: number;
  filePath: string;
  tokens: number;
  cumulativeTokens: number;
  timestamp: string;
}

export interface DailySummary {
  id: number;
  projectId: number;
  date: string;
  totalLoc: number;
  activeMinutes: number;
  totalTokens: number;
}

export interface TickerData {
  currentScore: number;
  changePercent: number;
  changeAbsolute: number;
  ath: number;
  atl: number;
  volume24h: number;
  activeFiles: number;
  connectionStatus: 'connected' | 'disconnected' | 'listening';
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
  tokens?: number;
  status?: StatusBadge;
  lineCount?: number;
}

export interface IntervalOption {
  label: string;
  value: Granularity;
}

export const INTERVALS: IntervalOption[] = [
  { label: '实时', value: 'event' },
  { label: '3min', value: '3min' },
  { label: '5min', value: '5min' },
  { label: '15min', value: '15min' },
  { label: '1h', value: '1h' },
  { label: '1d', value: '1d' },
];
