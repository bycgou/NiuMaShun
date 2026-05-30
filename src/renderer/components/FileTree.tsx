import React, { useState, useMemo } from 'react';
import { FileTreeNode, StatusBadge } from '../../shared/types';

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
  search: {
    padding: 8,
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
  tree: {
    flex: 1,
    overflow: 'auto',
    padding: '4px 0',
  },
  footer: {
    padding: '6px 12px',
    borderTop: '1px solid var(--border)',
    fontSize: 11,
    color: 'var(--text-secondary)',
  },
  node: {
    display: 'flex',
    alignItems: 'center',
    padding: '3px 12px',
    cursor: 'pointer',
    fontSize: 12,
    gap: 4,
  },
  nodeHover: {
    background: 'var(--bg-tertiary)',
  },
  icon: {
    width: 16,
    textAlign: 'center',
    fontSize: 11,
  },
  badge: {
    marginLeft: 'auto',
    padding: '1px 6px',
    borderRadius: 3,
    fontSize: 10,
    fontWeight: 600,
  },
};

const STATUS_COLORS: Record<StatusBadge, string> = {
  active: 'transparent',
  ipo: 'var(--accent-green)',
  delisted: 'var(--accent-red)',
  hot: 'var(--accent-yellow)',
};

const STATUS_LABELS: Record<StatusBadge, string> = {
  active: '',
  ipo: 'IPO',
  delisted: '退市',
  hot: '🔥',
};

function TreeNode({
  node,
  depth,
  search,
  onSelect,
}: {
  node: FileTreeNode;
  depth: number;
  search: string;
  onSelect: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const [hovered, setHovered] = useState(false);

  const matchesSearch = !search || node.name.toLowerCase().includes(search.toLowerCase());

  if (!matchesSearch && node.type === 'file') return null;

  return (
    <div>
      <div
        style={{
          ...styles.node,
          paddingLeft: 12 + depth * 16,
          ...(hovered ? styles.nodeHover : {}),
          opacity: matchesSearch ? 1 : 0.5,
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => {
          if (node.type === 'directory') setExpanded(!expanded);
          else onSelect(node.path);
        }}
      >
        <span style={styles.icon}>
          {node.type === 'directory' ? (expanded ? '▼' : '▶') : '📄'}
        </span>
        <span>{node.name}</span>
        {node.tokens !== undefined && (
          <span style={{ ...styles.badge, background: 'var(--bg-tertiary)', color: 'var(--accent-yellow)' }}>
            {node.tokens.toLocaleString()}
          </span>
        )}
        {node.status && node.status !== 'active' && (
          <span style={{ ...styles.badge, background: STATUS_COLORS[node.status], color: '#fff' }}>
            {STATUS_LABELS[node.status]}
          </span>
        )}
      </div>
      {expanded && node.children?.map(child => (
        <TreeNode
          key={child.path}
          node={child}
          depth={depth + 1}
          search={search}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

export default function FileTree({
  nodes,
  onSelect,
}: {
  nodes: FileTreeNode[];
  onSelect: (path: string) => void;
}) {
  const [search, setSearch] = useState('');

  const fileCount = useMemo(() => {
    const count = (items: FileTreeNode[]): number =>
      items.reduce((acc, n) => acc + (n.type === 'file' ? 1 : 0) + (n.children ? count(n.children) : 0), 0);
    return count(nodes);
  }, [nodes]);

  return (
    <div style={styles.container}>
      <div style={styles.search}>
        <input
          style={styles.input}
          placeholder="搜索文件..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      <div style={styles.tree}>
        {nodes.map(node => (
          <TreeNode
            key={node.path}
            node={node}
            depth={0}
            search={search}
            onSelect={onSelect}
          />
        ))}
      </div>
      <div style={styles.footer}>{fileCount} 个文件</div>
    </div>
  );
}
