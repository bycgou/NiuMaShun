import React, { useState } from 'react';
import { FileStock } from '../../shared/types';

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '22%',
    minWidth: 200,
    background: 'var(--bg-secondary)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    padding: '8px 12px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  count: {
    fontSize: 10,
    color: 'var(--text-secondary)',
  },
  search: {
    padding: '4px 8px',
    borderBottom: '1px solid var(--border)',
  },
  input: {
    width: '100%',
    padding: '4px 8px',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    color: 'var(--text-primary)',
    fontSize: 12,
    outline: 'none',
  },
  list: {
    flex: 1,
    overflow: 'auto',
  },
  stockItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 12px',
    cursor: 'pointer',
    borderBottom: '1px solid var(--border)',
    transition: 'background 0.1s',
  },
  stockItemHover: {
    background: 'var(--bg-tertiary)',
  },
  stockItemSelected: {
    background: 'var(--accent-blue)',
    opacity: 0.2,
  },
  stockInfo: {
    flex: 1,
    minWidth: 0,
  },
  stockName: {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  stockMeta: {
    fontSize: 10,
    color: 'var(--text-secondary)',
    marginTop: 2,
  },
  priceInfo: {
    textAlign: 'right',
    minWidth: 60,
  },
  price: {
    fontSize: 12,
    fontWeight: 600,
  },
  change: {
    fontSize: 10,
    marginTop: 2,
  },
  statusBadge: {
    marginLeft: 8,
    padding: '1px 4px',
    borderRadius: 2,
    fontSize: 9,
    fontWeight: 600,
  },
};

const STATUS_COLORS: Record<string, string> = {
  ipo: 'var(--accent-green)',
  delisted: 'var(--accent-red)',
  hot: 'var(--accent-yellow)',
  active: 'transparent',
};

const STATUS_LABELS: Record<string, string> = {
  ipo: 'IPO',
  delisted: '退市',
  hot: '🔥',
  active: '',
};

export default function StockList({
  stocks,
  selectedFile,
  onSelect,
}: {
  stocks: FileStock[];
  selectedFile: string | null;
  onSelect: (filePath: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [hoveredFile, setHoveredFile] = useState<string | null>(null);

  const filteredStocks = stocks.filter(stock =>
    stock.fileName.toLowerCase().includes(search.toLowerCase()) ||
    stock.filePath.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>📈 股票列表</span>
        <span style={styles.count}>{stocks.length} 只</span>
      </div>
      <div style={styles.search}>
        <input
          style={styles.input}
          placeholder="搜索文件..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      <div style={styles.list}>
        {filteredStocks.map(stock => {
          const isSelected = stock.filePath === selectedFile;
          const isHovered = stock.filePath === hoveredFile;
          const isPositive = stock.changeAbsolute >= 0;
          const color = isPositive ? 'var(--accent-green)' : 'var(--accent-red)';
          const arrow = isPositive ? '▲' : stock.changeAbsolute < 0 ? '▼' : '─';

          return (
            <div
              key={stock.filePath}
              style={{
                ...styles.stockItem,
                ...(isHovered ? styles.stockItemHover : {}),
                ...(isSelected ? styles.stockItemSelected : {}),
              }}
              onMouseEnter={() => setHoveredFile(stock.filePath)}
              onMouseLeave={() => setHoveredFile(null)}
              onClick={() => onSelect(stock.filePath)}
            >
              <div style={styles.stockInfo}>
                <div style={styles.stockName}>{stock.fileName}</div>
                <div style={styles.stockMeta}>
                  {stock.currentLines} 行 · {stock.editCount} 次编辑
                </div>
              </div>
              <div style={styles.priceInfo}>
                <div style={{ ...styles.price, color }}>
                  {stock.currentLines}
                </div>
                <div style={{ ...styles.change, color }}>
                  {arrow} {Math.abs(stock.changePercent).toFixed(1)}%
                </div>
              </div>
              {stock.status !== 'active' && (
                <span style={{
                  ...styles.statusBadge,
                  background: STATUS_COLORS[stock.status],
                  color: '#fff',
                }}>
                  {STATUS_LABELS[stock.status]}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
