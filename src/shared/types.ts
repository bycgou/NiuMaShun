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
  filePath: string;  // 每个文件独立的 K 线
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
  linesAdded: number;
  linesDeleted: number;
}

// 文件股票信息
export interface FileStock {
  filePath: string;
  fileName: string;
  currentLines: number;
  openLines: number;       // IPO 时的行数
  changePercent: number;   // 涨跌幅
  changeAbsolute: number;  // 涨跌绝对值
  editCount: number;       // 编辑次数
  status: StatusBadge;     // active | ipo | delisted | hot
  lastEditTime: string;
  tokens: number;          // 该文件消耗的总 token
  inputTokens: number;     // 输入 token
  outputTokens: number;    // 输出 token
  cacheReadTokens: number; // 缓存读取 token
  cacheCreationTokens: number; // 缓存创建 token
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
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
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

export interface DailyStats {
  filesChanged: number;
  linesAdded: number;
  linesDeleted: number;
  operations: number;
  tokensUsed: number;
}

export const INTERVALS: IntervalOption[] = [
  { label: '实时', value: 'event' },
  { label: '3min', value: '3min' },
  { label: '5min', value: '5min' },
  { label: '15min', value: '15min' },
  { label: '1h', value: '1h' },
  { label: '1d', value: '1d' },
];

// 宠物相关类型导出
export type { PetState, PetEvent, PetAction, PetSpriteState, LevelConfig } from './pet-types';
export { LEVEL_THRESHOLDS, LEVEL_COLORS, PET_SPRITE_STATES } from './pet-types';
