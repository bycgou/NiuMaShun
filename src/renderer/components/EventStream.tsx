// src/renderer/components/EventStream.tsx
import React from 'react';
import { EventRecord } from '../../shared/types';

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    overflow: 'auto',
    padding: 8,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 8px',
    fontSize: 12,
    borderBottom: '1px solid var(--border)',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    flexShrink: 0,
  },
  time: {
    color: 'var(--text-secondary)',
    fontSize: 11,
    minWidth: 50,
  },
  path: {
    color: 'var(--text-primary)',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  change: {
    fontWeight: 600,
    minWidth: 60,
    textAlign: 'right',
  },
};

export default function EventStream({ events }: { events: EventRecord[] }) {
  return (
    <div style={styles.container}>
      {events.map(event => {
        const isCreate = event.fileCreated;
        const isDelete = event.fileDeleted;
        const color = isCreate ? 'var(--accent-green)' : isDelete ? 'var(--accent-red)' : 'var(--accent-blue)';
        const label = isCreate ? 'IPO' : isDelete ? '退市' : `${event.linesAdded > 0 ? '+' : ''}${event.linesAdded - event.linesDeleted}`;

        return (
          <div key={event.id} style={styles.item}>
            <div style={{ ...styles.dot, background: color }} />
            <span style={styles.time}>
              {new Date(event.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span style={styles.path}>{event.filePath}</span>
            <span style={{ ...styles.change, color }}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}
