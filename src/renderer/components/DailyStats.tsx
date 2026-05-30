// src/renderer/components/DailyStats.tsx
import React from 'react';

interface Stats {
  filesChanged: number;
  linesAdded: number;
  linesDeleted: number;
  operations: number;
  tokensUsed: number;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 12,
    padding: 12,
    overflow: 'auto',
  },
  card: {
    background: 'var(--bg-tertiary)',
    borderRadius: 8,
    padding: 12,
    textAlign: 'center',
  },
  label: {
    fontSize: 11,
    color: 'var(--text-secondary)',
    marginBottom: 4,
  },
  value: {
    fontSize: 20,
    fontWeight: 700,
  },
};

export default function DailyStats({ stats }: { stats: Stats | null }) {
  if (!stats) return <div style={{ padding: 12, color: 'var(--text-secondary)' }}>加载中...</div>;

  const items = [
    { label: '变更文件', value: stats.filesChanged, color: 'var(--accent-blue)' },
    { label: '新增行数', value: `+${stats.linesAdded}`, color: 'var(--accent-green)' },
    { label: '删除行数', value: `-${stats.linesDeleted}`, color: 'var(--accent-red)' },
    { label: '操作次数', value: stats.operations, color: 'var(--text-primary)' },
    { label: 'Token 消耗', value: stats.tokensUsed.toLocaleString(), color: 'var(--accent-yellow)' },
    { label: '净变更', value: `${stats.linesAdded - stats.linesDeleted > 0 ? '+' : ''}${stats.linesAdded - stats.linesDeleted}`, color: stats.linesAdded >= stats.linesDeleted ? 'var(--accent-green)' : 'var(--accent-red)' },
  ];

  return (
    <div style={styles.container}>
      {items.map(item => (
        <div key={item.label} style={styles.card}>
          <div style={styles.label}>{item.label}</div>
          <div style={{ ...styles.value, color: item.color }}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}
