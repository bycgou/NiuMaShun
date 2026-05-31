// src/renderer/utils/format.ts

/**
 * 格式化时间为本地时间
 * @param isoString ISO 格式的时间字符串
 * @returns 格式化的本地时间字符串
 */
export function formatLocalTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      return '--:--';
    }
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return '--:--';
  }
}

/**
 * 格式化日期为本地日期
 * @param isoString ISO 格式的时间字符串
 * @returns 格式化的本地日期字符串
 */
export function formatLocalDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      return '----/--/--';
    }
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return '----/--/--';
  }
}

/**
 * 格式化完整的本地日期时间
 * @param isoString ISO 格式的时间字符串
 * @returns 格式化的本地日期时间字符串
 */
export function formatLocalDateTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      return '----/--/-- --:--';
    }
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return '----/--/-- --:--';
  }
}

/**
 * 格式化数字为千分位
 * @param num 数字
 * @returns 格式化后的字符串
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('zh-CN');
}

/**
 * 格式化 token 数量
 * @param tokens token 数量
 * @returns 格式化后的字符串
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1000000) {
    return (tokens / 1000000).toFixed(1) + 'M';
  }
  if (tokens >= 1000) {
    return (tokens / 1000).toFixed(1) + 'K';
  }
  return tokens.toString();
}
