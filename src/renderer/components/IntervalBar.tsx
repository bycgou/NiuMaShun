import React from 'react';
import { INTERVALS, Granularity } from '../../shared/types';

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 16px',
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border)',
  },
  btn: {
    padding: '4px 12px',
    borderRadius: 4,
    border: 'none',
    background: 'transparent',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 500,
  },
  btnActive: {
    background: 'var(--accent-blue)',
    color: '#fff',
  },
  toggle: {
    marginLeft: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
};

export default function IntervalBar({
  current,
  onChange,
  showSessions,
  onToggleSessions,
}: {
  current: Granularity;
  onChange: (g: Granularity) => void;
  showSessions: boolean;
  onToggleSessions: () => void;
}) {
  return (
    <div style={styles.container}>
      {INTERVALS.map(interval => (
        <button
          key={interval.value}
          style={{
            ...styles.btn,
            ...(current === interval.value ? styles.btnActive : {}),
          }}
          onClick={() => onChange(interval.value)}
        >
          {interval.label}
        </button>
      ))}
      <label style={styles.toggle}>
        <input
          type="checkbox"
          checked={showSessions}
          onChange={onToggleSessions}
        />
        会话色块
      </label>
    </div>
  );
}
