import { Outlet } from 'react-router-dom';
import LeftNav from './LeftNav';
import './AppLayout.css';

export default function AppLayout() {
  return (
    <div className="app-layout">
      <LeftNav />
      <main className="app-layout__main">
        <Outlet />
      </main>
    </div>
  );
}
