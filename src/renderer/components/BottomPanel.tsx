// src/renderer/components/BottomPanel.tsx
import React, { useState } from 'react';
import EventStream from './EventStream';
import TokenRanking from './TokenRanking';
import DailyStats from './DailyStats';
import { EventRecord } from '../../shared/types';

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: 200,
    background: 'var(--bg-secondary)',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
  },
  tabBar: {
    display: 'flex',
    borderBottom: '1px solid var(--border)',
  },
  tab: {
    padding: '6px 16px',
    fontSize: 12,
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
  },
  tabActive: {
    color: 'var(--text-primary)',
    borderBottomColor: 'var(--accent-blue)',
  },
};

type Tab = 'events' | 'tokens' | 'daily';

export default function BottomPanel({
  events,
  tokenRanking,
  dailyStats,
}: {
  events: EventRecord[];
  tokenRanking: { filePath: string; tokens: number }[];
  dailyStats: any;
}) {
  const [tab, setTab] = useState<Tab>('events');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'events', label: '实时活动' },
    { key: 'tokens', label: 'Token 排行' },
    { key: 'daily', label: '今日概况' },
  ];

  return (
    <div style={styles.container}>
      <div style={styles.tabBar}>
        {tabs.map(t => (
          <button
            key={t.key}
            style={{ ...styles.tab, ...(tab === t.key ? styles.tabActive : {}) }}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'events' && <EventStream events={events} />}
      {tab === 'tokens' && <TokenRanking data={tokenRanking} />}
      {tab === 'daily' && <DailyStats stats={dailyStats} />}
    </div>
  );
}
