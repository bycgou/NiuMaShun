import { LEVEL_THRESHOLDS } from '../../shared/pet-types';

export function detectLevelUp(oldEvents: number, newEvents: number): boolean {
  const oldLevel = calculateLevel(oldEvents);
  const newLevel = calculateLevel(newEvents);
  return newLevel > oldLevel;
}

export function calculateLevel(totalEvents: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalEvents >= LEVEL_THRESHOLDS[i].threshold) {
      return LEVEL_THRESHOLDS[i].level;
    }
  }
  return 1;
}

export function getLevelName(level: number): string {
  const config = LEVEL_THRESHOLDS.find(l => l.level === level);
  return config?.name ?? 'Byte';
}

export function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h >= 6 && h < 11) return 'morning';
  if (h >= 11 && h < 13) return 'lunch';
  if (h >= 13 && h < 18) return 'afternoon';
  if (h >= 18 && h < 23) return 'evening';
  if (h >= 23 || h < 1) return 'night';
  return 'midnight';
}

export const TIME_GREETINGS: Record<string, string[]> = {
  morning:   ['早上好！新的一天开始啦', '早安，今天也要加油哦'],
  lunch:     ['该吃午饭了，别饿着肚子写代码', '午饭时间！吃饭了吗？'],
  afternoon: ['下午好，喝杯水吧', '下午容易犯困，动动身体~'],
  evening:   ['下班啦，辛苦了！', '今天的工作完成了吗？'],
  night:     ['这么晚了，早点休息吧', '夜深了，注意身体哦'],
  midnight:  ['都凌晨了！真的不睡吗？', '熬夜写代码...精神可嘉'],
};

export function getRandomGreeting(): string | null {
  const tod = getTimeOfDay();
  const pool = TIME_GREETINGS[tod];
  if (!pool) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}
