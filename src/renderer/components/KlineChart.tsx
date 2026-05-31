import React, { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, HistogramData, ColorType, UTCTimestamp } from 'lightweight-charts';
import { KlineData } from '../../shared/types';

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    position: 'relative',
  },
  focusBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: '6px 12px',
    background: 'var(--accent-blue)',
    color: '#fff',
    fontSize: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
};

export default function KlineChart({
  data,
  focusedFile,
  onClearFocus,
}: {
  data: KlineData[];
  focusedFile: string | null;
  onClearFocus: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0d1117' },
        textColor: '#8b949e',
      },
      grid: {
        vertLines: { color: '#21262d' },
        horzLines: { color: '#21262d' },
      },
      crosshair: {
        mode: 0,
        vertLine: {
          labelBackgroundColor: '#58a6ff',
        },
        horzLine: {
          labelBackgroundColor: '#58a6ff',
        },
      },
      timeScale: {
        borderColor: '#30363d',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#30363d',
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      // A 股配色：红涨绿跌
      upColor: '#f85149',
      downColor: '#3fb950',
      borderDownColor: '#3fb950',
      borderUpColor: '#f85149',
      wickDownColor: '#3fb950',
      wickUpColor: '#f85149',
    });

    const volumeSeries = chart.addHistogramSeries({
      color: '#58a6ff',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });

    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return;

    const sorted = data.slice().reverse();

    // Deduplicate timestamps by bumping duplicates by 1 second
    const seenTimes = new Set<number>();
    const dedupedTimes: UTCTimestamp[] = sorted.map(d => {
      let time = Math.floor(new Date(d.timestamp).getTime() / 1000) as UTCTimestamp;
      while (seenTimes.has(time)) {
        time = (time + 1) as UTCTimestamp;
      }
      seenTimes.add(time);
      return time;
    });

    const candleData: CandlestickData[] = sorted.map((d, i) => ({
      time: dedupedTimes[i],
      open: d.openScore,
      high: d.highScore,
      low: d.lowScore,
      close: d.closeScore,
    }));

    const volumeData: HistogramData[] = sorted.map((d, i) => ({
      time: dedupedTimes[i],
      value: d.volume,
      // A 股配色：红涨绿跌
      color: d.closeScore >= d.openScore ? '#f8514966' : '#3fb95066',
    }));

    candleSeriesRef.current.setData(candleData);
    volumeSeriesRef.current.setData(volumeData);
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  return (
    <div style={styles.container}>
      {focusedFile && (
        <div style={styles.focusBar}>
          <span>正在查看: {focusedFile}</span>
          <button
            onClick={onClearFocus}
            style={{
              background: 'transparent',
              border: '1px solid #fff',
              color: '#fff',
              padding: '2px 8px',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            返回全局视图
          </button>
        </div>
      )}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
