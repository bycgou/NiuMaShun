import React, { useState, useEffect, useCallback } from 'react';
import TitleBar from './components/TitleBar';
import TickerBar from './components/TickerBar';
import IntervalBar from './components/IntervalBar';
import FileTree from './components/FileTree';
import KlineChart from './components/KlineChart';
import BottomPanel from './components/BottomPanel';
import StartupScreen from './components/StartupScreen';
import { Granularity, KlineData, EventRecord, FileTreeNode } from '../shared/types';

export default function App() {
  const [projectId, setProjectId] = useState<number | null>(null);
  const [hasProjects, setHasProjects] = useState(false);
  const [granularity, setGranularity] = useState<Granularity>('event');
  const [showSessions, setShowSessions] = useState(true);
  const [klineData, setKlineData] = useState<KlineData[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [tokenRanking, setTokenRanking] = useState<{ filePath: string; tokens: number }[]>([]);
  const [dailyStats, setDailyStats] = useState<any>(null);
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
  const [focusedFile, setFocusedFile] = useState<string | null>(null);

  useEffect(() => {
    window.api.project.list().then(projects => {
      setHasProjects(projects.length > 0);
      if (projects.length > 0) {
        setProjectId(projects[0].id);
      }
    });
  }, []);

  const refreshData = useCallback(async () => {
    if (!projectId) return;
    const [klines, evts, tokens, stats, tree] = await Promise.all([
      window.api.kline.get(projectId, granularity),
      window.api.events.get(projectId),
      window.api.tokenRanking.get(projectId),
      window.api.dailyStats.get(projectId),
      window.api.fileTree.get(projectId),
    ]);
    setKlineData(klines);
    setEvents(evts);
    setTokenRanking(tokens);
    setDailyStats(stats);
    setFileTree(tree);
  }, [projectId, granularity]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  useEffect(() => {
    window.api.onUpdate('kline:update', setKlineData);
    window.api.onUpdate('event:new', (event: EventRecord) => {
      setEvents(prev => [event, ...prev].slice(0, 50));
    });
  }, []);

  const handleProjectSwitch = async (id: number) => {
    await window.api.project.switch(id);
    setProjectId(id);
  };

  const handleGranularityChange = async (g: Granularity) => {
    await window.api.granularity.set(g);
    setGranularity(g);
  };

  const handleProjectAdded = (id: number) => {
    setHasProjects(true);
    handleProjectSwitch(id);
  };

  if (!hasProjects) {
    return <StartupScreen onProjectAdded={handleProjectAdded} />;
  }

  return (
    <>
      <TitleBar onProjectAdded={handleProjectAdded} />
      <TickerBar projectId={projectId} />
      <IntervalBar
        current={granularity}
        onChange={handleGranularityChange}
        showSessions={showSessions}
        onToggleSessions={() => setShowSessions(!showSessions)}
      />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <FileTree nodes={fileTree} onSelect={setFocusedFile} />
        <KlineChart
          data={klineData}
          focusedFile={focusedFile}
          onClearFocus={() => setFocusedFile(null)}
        />
      </div>
      <BottomPanel
        events={events}
        tokenRanking={tokenRanking}
        dailyStats={dailyStats}
      />
    </>
  );
}
