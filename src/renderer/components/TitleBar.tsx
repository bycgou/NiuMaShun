import React, { useState, useEffect } from 'react';

interface Project {
  id: number;
  name: string;
  path: string;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    height: 36,
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border)',
    WebkitAppRegion: 'drag',
    padding: '0 8px',
  },
  logo: {
    fontWeight: 700,
    fontSize: 13,
    color: 'var(--accent-green)',
    marginRight: 16,
  },
  selector: {
    WebkitAppRegion: 'no-drag',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 12,
    cursor: 'pointer',
  },
  controls: {
    marginLeft: 'auto',
    display: 'flex',
    gap: 8,
    WebkitAppRegion: 'no-drag',
  },
  btn: {
    width: 12,
    height: 12,
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
  },
};

export default function TitleBar() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentId, setCurrentId] = useState<number | null>(null);

  useEffect(() => {
    window.api.project.list().then(setProjects);
  }, []);

  const handleAdd = async () => {
    const project = await window.api.project.add();
    if (project) {
      setProjects(prev => [...prev, project]);
      setCurrentId(project.id);
    }
  };

  const handleSwitch = async (id: number) => {
    await window.api.project.switch(id);
    setCurrentId(id);
  };

  return (
    <div style={styles.container}>
      <span style={styles.logo}>ClaudeCode Tracker</span>
      <select
        style={styles.selector}
        value={currentId ?? ''}
        onChange={e => handleSwitch(Number(e.target.value))}
      >
        {projects.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <button style={{ ...styles.selector, marginLeft: 4 }} onClick={handleAdd}>
        + 添加项目
      </button>
      <div style={styles.controls}>
        <button style={{ ...styles.btn, background: '#d29922' }} onClick={() => window.api.window.minimize()} />
        <button style={{ ...styles.btn, background: '#3fb950' }} onClick={() => window.api.window.maximize()} />
        <button style={{ ...styles.btn, background: '#f85149' }} onClick={() => window.api.window.close()} />
      </div>
    </div>
  );
}
