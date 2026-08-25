import { useEffect, useState } from 'react';
import api from '../api';
import type { CameraStats } from '../types';
import './TopBar.css';

interface TopBarProps {
  title: string;
  actions?: React.ReactNode;
}

export default function TopBar({ title, actions }: TopBarProps) {
  const [stats, setStats] = useState<CameraStats | null>(null);

  useEffect(() => {
    api.get('/cameras/stats')
      .then(res => setStats(res.data))
      .catch(() => {});
  }, []);

  return (
    <header className="topbar" id="topbar">
      <div className="topbar__left">
        <h1 className="topbar__title">{title}</h1>
      </div>
      <div className="topbar__center">
        {stats && (
          <div className="stat-strip">
            <div className="stat-strip__item">
              <span className="stat-strip__value">{stats.total.toLocaleString()}</span>
              <span className="stat-strip__label">Total</span>
            </div>
            <div className="stat-strip__divider" />
            <div className="stat-strip__item">
              <span className="stat-strip__value stat-strip__value--online">{stats.online.toLocaleString()}</span>
              <span className="stat-strip__label">Online</span>
            </div>
            <div className="stat-strip__divider" />
            <div className="stat-strip__item">
              <span className="stat-strip__value stat-strip__value--offline">{stats.offline.toLocaleString()}</span>
              <span className="stat-strip__label">Offline</span>
            </div>
            <div className="stat-strip__divider" />
            <div className="stat-strip__item">
              <span className="stat-strip__value stat-strip__value--warning">{stats.maintenance.toLocaleString()}</span>
              <span className="stat-strip__label">Maintenance</span>
            </div>
          </div>
        )}
      </div>
      <div className="topbar__right">
        {actions}
      </div>
    </header>
  );
}
