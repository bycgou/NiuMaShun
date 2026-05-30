import React, { useState, useEffect } from 'react';

interface TickerData {
  currentScore: number;
  changePercent: number;
  changeAbsolute: number;
  ath: number;
  atl: number;
  volume24h: number;
  activeFiles: number;
  connectionStatus: string;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: 24,
    padding: '8px 16px',
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border)',
  },
  price: {
    fontSize: 24,
    fontWeight: 700,
  },
  change: {
    fontSize: 14,
    fontWeight: 600,
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
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    color: 'var(--text-secondary)',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
  },
};

export default function TickerBar({ projectId }: { projectId: number | null }) {
  const [data, setData] = useState<TickerData | null>(null);

  useEffect(() => {
    if (!projectId) return;
    window.api.ticker.get(projectId).then(setData);
    window.api.onUpdate('ticker:update', setData);
  }, [projectId]);

  if (!data) return <div style={styles.container}>等待项目选择...</div>;

  const isPositive = data.changeAbsolute >= 0;
  const color = isPositive ? 'var(--accent-green)' : 'var(--accent-red)';

  return (
    <div style={styles.container}>
      <div>
        <div style={{ ...styles.price, color }}>
          {data.currentScore.toLocaleString()}
        </div>
        <div style={{ ...styles.change, color }}>
          {isPositive ? '+' : ''}{data.changeAbsolute.toFixed(2)} ({isPositive ? '+' : ''}{data.changePercent.toFixed(2)}%)
        </div>
      </div>
      <div style={styles.stat}>
        <span style={styles.statLabel}>24H Vol</span>
        <span style={styles.statValue}>{data.volume24h}</span>
      </div>
      <div style={styles.stat}>
        <span style={styles.statLabel}>ATH</span>
        <span style={{ ...styles.statValue, color: 'var(--accent-green)' }}>{data.ath.toLocaleString()}</span>
      </div>
      <div style={styles.stat}>
        <span style={styles.statLabel}>ATL</span>
        <span style={{ ...styles.statValue, color: 'var(--accent-red)' }}>{data.atl.toLocaleString()}</span>
      </div>
      <div style={styles.stat}>
        <span style={styles.statLabel}>Files</span>
        <span style={styles.statValue}>{data.activeFiles}</span>
      </div>
      <div style={styles.status}>
        <div style={{ ...styles.dot, background: data.connectionStatus === 'connected' ? 'var(--accent-green)' : 'var(--accent-red)' }} />
        {data.connectionStatus}
      </div>
    </div>
  );
}
