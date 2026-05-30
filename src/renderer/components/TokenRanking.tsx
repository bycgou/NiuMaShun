// src/renderer/components/TokenRanking.tsx
import React from 'react';

interface TokenEntry {
  filePath: string;
  tokens: number;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    overflow: 'auto',
    padding: 12,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  rank: {
    width: 20,
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--accent-yellow)',
    textAlign: 'center',
  },
  barContainer: {
    flex: 1,
    height: 20,
    background: 'var(--bg-tertiary)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    background: 'linear-gradient(90deg, var(--accent-blue), var(--accent-green))',
    borderRadius: 4,
    transition: 'width 0.3s',
  },
  filePath: {
    fontSize: 12,
    marginBottom: 2,
  },
  count: {
    fontSize: 11,
    color: 'var(--text-secondary)',
    minWidth: 60,
    textAlign: 'right',
  },
};

export default function TokenRanking({ data }: { data: TokenEntry[] }) {
  const maxTokens = Math.max(...data.map(d => d.tokens), 1);

  return (
    <div style={styles.container}>
      {data.map((entry, i) => (
        <div key={entry.filePath} style={styles.item}>
          <span style={styles.rank}>{i + 1}</span>
          <div style={{ flex: 1 }}>
            <div style={styles.filePath}>{entry.filePath}</div>
            <div style={styles.barContainer}>
              <div style={{ ...styles.bar, width: `${(entry.tokens / maxTokens) * 100}%` }} />
            </div>
          </div>
          <span style={styles.count}>{entry.tokens.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}
