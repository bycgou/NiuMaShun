import React from 'react';

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 700,
    color: 'var(--accent-green)',
  },
  subtitle: {
    fontSize: 16,
    color: 'var(--text-secondary)',
    textAlign: 'center',
    maxWidth: 400,
  },
  btn: {
    padding: '12px 32px',
    background: 'var(--accent-green)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
  },
};

export default function StartupScreen({
  onProjectAdded,
}: {
  onProjectAdded: (id: number) => void;
}) {
  const handleAdd = async () => {
    const project = await window.api.project.add();
    if (project) onProjectAdded(project.id);
  };

  return (
    <div style={styles.container}>
      <div style={styles.title}>ClaudeCode Tracker</div>
      <div style={styles.subtitle}>
        用 K 线图可视化 Claude Code 对项目的每次修改
      </div>
      <button style={styles.btn} onClick={handleAdd}>
        选择一个 Git 项目目录
      </button>
    </div>
  );
}
