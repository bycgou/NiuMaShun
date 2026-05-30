import React, { useState, useEffect, useCallback } from 'react';
import TitleBar from './components/TitleBar';
import TickerBar from './components/TickerBar';
import IntervalBar from './components/IntervalBar';
import StockList from './components/StockList';
import KlineChart from './components/KlineChart';
import BottomPanel from './components/BottomPanel';
import StartupScreen from './components/StartupScreen';
import { Granularity, KlineData, EventRecord, FileStock } from '../shared/types';

export default function App() {
  const [projectId, setProjectId] = useState<number | null>(null);
  const [hasProjects, setHasProjects] = useState(false);
  const [granularity, setGranularity] = useState<Granularity>('event');
  const [showSessions, setShowSessions] = useState(true);
  const [stocks, setStocks] = useState<FileStock[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [klineData, setKlineData] = useState<KlineData[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [tokenRanking, setTokenRanking] = useState<{ filePath: string; tokens: number }[]>([]);
  const [dailyStats, setDailyStats] = useState<any>(null);

  useEffect(() => {
    window.api.project.list().then(projects => {
      setHasProjects(projects.length > 0);
      if (projects.length > 0) {
        setProjectId(projects[0].id);
      }
    });
  }, []);

  // 获取股票列表
  const refreshStocks = useCallback(async () => {
    if (!projectId) return;
    const stocksData = await window.api.stocks.get(projectId);
    setStocks(stocksData);
    // 如果没有选中文件，选中第一个
    if (!selectedFile && stocksData.length > 0) {
      setSelectedFile(stocksData[0].filePath);
    }
  }, [projectId, selectedFile]);

  // 获取选中文件的 K 线数据
  const refreshKlineData = useCallback(async () => {
    if (!projectId || !selectedFile) return;
    const [klines, tokens, stats] = await Promise.all([
      window.api.fileKline.get(projectId, selectedFile, granularity),
      window.api.tokenRanking.get(projectId),
      window.api.dailyStats.get(projectId),
    ]);
    setKlineData(klines);
    setTokenRanking(tokens);
    setDailyStats(stats);
  }, [projectId, selectedFile, granularity]);

  useEffect(() => {
    refreshStocks();
  }, [refreshStocks]);

  useEffect(() => {
    refreshKlineData();
  }, [refreshKlineData]);

  // 监听实时更新
  useEffect(() => {
    window.api.onUpdate('stocks:update', (newStocks: FileStock[]) => {
      setStocks(newStocks);
    });
    window.api.onUpdate('event:new', (event: EventRecord) => {
      setEvents(prev => [event, ...prev].slice(0, 50));
    });
  }, []);

  const handleProjectSwitch = async (id: number) => {
    await window.api.project.switch(id);
    setProjectId(id);
    setSelectedFile(null); // 切换项目时清除选中文件
  };

  const handleGranularityChange = async (g: Granularity) => {
    await window.api.granularity.set(g);
    setGranularity(g);
  };

  const handleProjectAdded = (id: number) => {
    setHasProjects(true);
    handleProjectSwitch(id);
  };

  const handleFileSelect = (filePath: string) => {
    setSelectedFile(filePath);
  };

  // 获取选中文件的股票信息
  const selectedStock = stocks.find(s => s.filePath === selectedFile) || null;

  if (!hasProjects) {
    return <StartupScreen onProjectAdded={handleProjectAdded} />;
  }

  return (
    <>
      <TitleBar onProjectAdded={handleProjectAdded} onProjectSwitch={handleProjectSwitch} />
      <TickerBar stock={selectedStock} />
      <IntervalBar
        current={granularity}
        onChange={handleGranularityChange}
        showSessions={showSessions}
        onToggleSessions={() => setShowSessions(!showSessions)}
      />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <StockList
          stocks={stocks}
          selectedFile={selectedFile}
          onSelect={handleFileSelect}
        />
        <KlineChart
          data={klineData}
          focusedFile={selectedFile}
          onClearFocus={() => setSelectedFile(null)}
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
