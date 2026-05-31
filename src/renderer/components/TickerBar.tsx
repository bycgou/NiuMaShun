import React from 'react';
import { FileStock } from '../../shared/types';

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: 24,
    padding: '8px 16px',
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border)',
  },
  fileInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  fileName: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  filePath: {
    fontSize: 11,
    color: 'var(--text-secondary)',
    maxWidth: 300,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  priceSection: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
  },
  price: {
    fontSize: 24,
    fontWeight: 700,
  },
  change: {
    fontSize: 14,
    fontWeight: 600,
  },
  divider: {
    width: 1,
    height: 30,
    background: 'var(--border)',
  },
  stats: {
    display: 'flex',
    gap: 16,
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 13,
    fontWeight: 600,
  },
  status: {
    marginLeft: 'auto',
    padding: '4px 8px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
  },
  noSelection: {
    flex: 1,
    textAlign: 'center',
    color: 'var(--text-secondary)',
    fontSize: 13,
  },
};

const STATUS_STYLES: Record<string, { background: string; color: string }> = {
  ipo: { background: 'var(--accent-green)', color: '#fff' },
  delisted: { background: 'var(--accent-red)', color: '#fff' },
  hot: { background: 'var(--accent-yellow)', color: '#000' },
  active: { background: 'transparent', color: 'var(--text-secondary)' },
};

export default function TickerBar({ stock }: { stock: FileStock | null }) {
  if (!stock) {
    return (
      <div style={styles.container}>
        <div style={styles.noSelection}>← 选择一个文件查看行情</div>
      </div>
    );
  }

  const isPositive = stock.changeAbsolute >= 0;
  const color = isPositive ? 'var(--accent-green)' : 'var(--accent-red)';
  const arrow = isPositive ? '▲' : stock.changeAbsolute < 0 ? '▼' : '─';
  const statusStyle = STATUS_STYLES[stock.status] || STATUS_STYLES.active;

  return (
    <div style={styles.container}>
      <div style={styles.fileInfo}>
        <span style={styles.fileName}>{stock.fileName}</span>
        <span style={styles.filePath}>{stock.filePath}</span>
      </div>

      <div style={styles.divider} />

      <div style={styles.priceSection}>
        <span style={{ ...styles.price, color }}>
          {stock.currentLines}
        </span>
        <span style={{ ...styles.change, color }}>
          {arrow} {Math.abs(stock.changeAbsolute).toFixed(1)} ({isPositive ? '+' : ''}{stock.changePercent.toFixed(2)}%)
        </span>
      </div>

      <div style={styles.divider} />

      <div style={styles.stats}>
        <div style={styles.stat}>
          <span style={styles.statLabel}>开盘</span>
          <span style={styles.statValue}>{stock.openLines}</span>
        </div>
        <div style={styles.stat}>
          <span style={styles.statLabel}>当前</span>
          <span style={{ ...styles.statValue, color }}>{stock.currentLines}</span>
        </div>
        <div style={styles.stat}>
          <span style={styles.statLabel}>编辑</span>
          <span style={styles.statValue}>{stock.editCount}</span>
        </div>
        <div style={styles.stat}>
          <span style={styles.statLabel}>净增</span>
          <span style={{ ...styles.statValue, color }}>
            {stock.changeAbsolute > 0 ? '+' : ''}{stock.changeAbsolute}
          </span>
        </div>
      </div>

      <div style={styles.divider} />

      <div style={styles.stats}>
        <div style={styles.stat}>
          <span style={styles.statLabel}>Token</span>
          <span style={styles.statValue}>{stock.tokens.toLocaleString()}</span>
        </div>
        <div style={styles.stat}>
          <span style={styles.statLabel}>输入</span>
          <span style={styles.statValue}>{stock.inputTokens.toLocaleString()}</span>
        </div>
        <div style={styles.stat}>
          <span style={styles.statLabel}>输出</span>
          <span style={styles.statValue}>{stock.outputTokens.toLocaleString()}</span>
        </div>
        <div style={styles.stat}>
          <span style={styles.statLabel}>缓存读</span>
          <span style={styles.statValue}>{stock.cacheReadTokens.toLocaleString()}</span>
        </div>
        <div style={styles.stat}>
          <span style={styles.statLabel}>缓存写</span>
          <span style={styles.statValue}>{stock.cacheCreationTokens.toLocaleString()}</span>
        </div>
      </div>

      {stock.status !== 'active' && (
        <div style={{ ...styles.status, ...statusStyle }}>
          {stock.status === 'ipo' ? '🆕 IPO' :
           stock.status === 'delisted' ? '📉 退市' :
           stock.status === 'hot' ? '🔥 活跃' : ''}
        </div>
      )}
    </div>
  );
}
