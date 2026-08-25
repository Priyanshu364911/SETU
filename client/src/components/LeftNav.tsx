import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Map, Database, Upload, BarChart3, Building2, Activity,
  FileText, BookOpen, Settings, LogOut
} from 'lucide-react';
import './LeftNav.css';

const NAV_ITEMS = [
  { label: 'Overview', items: [
    { to: '/', icon: Map, label: 'GIS Dashboard' },
  ]},
  { label: 'Registry', items: [
    { to: '/cameras', icon: Database, label: 'Camera Registry' },
    { to: '/onboarding', icon: Upload, label: 'Onboarding Queue' },
    { to: '/gap-analysis', icon: BarChart3, label: 'Gap Analysis' },
    { to: '/departments', icon: Building2, label: 'Departments' },
    { to: '/health', icon: Activity, label: 'Health Monitor' },
  ]},
  { label: 'System', items: [
    { to: '/audit', icon: FileText, label: 'Audit Trail' },
    { to: '/registry-api-docs', icon: BookOpen, label: 'Registry API' },
    { to: '/settings', icon: Settings, label: 'Settings', roles: ['state_nodal_officer'] as string[] },
  ]},
];

export default function LeftNav() {
  const { user, logout } = useAuth();

  return (
    <nav className="left-nav" id="left-nav">
      <div className="left-nav__header">
        <div className="left-nav__logo">
          <span className="left-nav__logo-icon">S</span>
          <div>
            <div className="left-nav__title">SETU</div>
            <div className="left-nav__subtitle">Registry</div>
          </div>
        </div>
      </div>

      <div className="left-nav__sections">
        {NAV_ITEMS.map((section) => (
          <div key={section.label} className="left-nav__section">
            <div className="left-nav__section-label">{section.label}</div>
            {section.items
              .filter(item => !('roles' in item) || !item.roles || (user && item.roles.includes(user.role)))
              .map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `left-nav__item ${isActive ? 'left-nav__item--active' : ''}`
                  }
                  id={`nav-${item.to.replace(/\//g, '') || 'dashboard'}`}
                >
                  <item.icon size={16} strokeWidth={1.75} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
          </div>
        ))}
      </div>

      <div className="left-nav__footer">
        <div className="left-nav__user">
          <div className="left-nav__user-avatar">
            {user?.username?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="left-nav__user-info">
            <div className="left-nav__user-name">{user?.username || 'User'}</div>
            <div className="left-nav__user-role">
              {user?.role?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown'}
            </div>
          </div>
        </div>
        <button className="left-nav__logout" onClick={logout} id="btn-logout" title="Log out">
          <LogOut size={16} strokeWidth={1.75} />
        </button>
      </div>
    </nav>
  );
}
