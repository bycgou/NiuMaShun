// 宠物状态
export interface PetState {
  id: number;
  petSlug: string;
  level: number;
  totalEvents: number;
  updatedAt: string;
}

// 宠物事件
export interface PetEvent {
  id: number;
  eventType: string;
  petAction: string | null;
  bubbleText: string | null;
  timestamp: string;
}

// 宠物动作
export interface PetAction {
  stateId: string;
  bubbleText: string;
  triggerAi?: boolean;
  aiScene?: string;
}

// 宠物精灵状态
export interface PetSpriteState {
  id: string;
  label: string;
  row: number;
  frames: number;
  durationMs: number;
}

// 等级配置
export interface LevelConfig {
  level: number;
  name: string;
  threshold: number;
}

// 等级阈值
export const LEVEL_THRESHOLDS: LevelConfig[] = [
  { level: 1, name: 'Byte', threshold: 0 },
  { level: 2, name: 'Process', threshold: 50 },
  { level: 3, name: 'Thread', threshold: 200 },
  { level: 4, name: 'Module', threshold: 500 },
  { level: 5, name: 'Kernel', threshold: 1000 },
  { level: 6, name: 'Neural', threshold: 2000 },
  { level: 7, name: 'Quantum', threshold: 5000 },
  { level: 8, name: 'Singularity', threshold: 10000 },
];

// 等级颜色
export const LEVEL_COLORS: Record<number, string> = {
  1: '#94a3b8',
  2: '#4ade80',
  3: '#60a5fa',
  4: '#a78bfa',
  5: '#f59e0b',
  6: '#ec4899',
  7: '#06b6d4',
  8: '#fbbf24',
};

// 宠物精灵状态定义
export const PET_SPRITE_STATES: PetSpriteState[] = [
  { id: 'idle', label: 'Idle', row: 0, frames: 6, durationMs: 1100 },
  { id: 'running-right', label: 'Running Right', row: 1, frames: 8, durationMs: 1060 },
  { id: 'running-left', label: 'Running Left', row: 2, frames: 8, durationMs: 1060 },
  { id: 'waving', label: 'Waving', row: 3, frames: 4, durationMs: 700 },
  { id: 'jumping', label: 'Jumping', row: 4, frames: 5, durationMs: 840 },
  { id: 'failed', label: 'Failed', row: 5, frames: 8, durationMs: 1220 },
  { id: 'waiting', label: 'Waiting', row: 6, frames: 6, durationMs: 1010 },
  { id: 'running', label: 'Running', row: 7, frames: 6, durationMs: 820 },
  { id: 'review', label: 'Review', row: 8, frames: 6, durationMs: 1030 },
];
