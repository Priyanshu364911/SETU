import { useEffect, useState, useCallback } from 'react';
import TopBar from '../components/TopBar';
import DataTable from '../components/DataTable';
import type { Column } from '../components/DataTable';
import api from '../api';
import type { AuditLog } from '../types';
import { useAuth } from '../context/AuthContext';
import { Search } from 'lucide-react';
import './AuditTrailPage.css';

const ACTION_LABELS: Record<string, string> = {
  ONBOARD_SUBMIT: 'Onboard Submit',
  ONBOARD_APPROVE: 'Onboard Approve',
  ONBOARD_REJECT: 'Onboard Reject',
  STATUS_CHANGE: 'Status Change',
  CAMERA_UPDATE: 'Camera Update',
  CAMERA_DELETE: 'Camera Delete',
  BULK_UPLOAD: 'Bulk Upload',
  EXPORT: 'Export',
  LOGIN: 'Login',
  USER_CREATE: 'User Create',
  USER_UPDATE: 'User Update',
};

export default function AuditTrailPage() {
  const { hasRole } = useAuth();
  const [entries, setEntries] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('');
  const [filterActor, setFilterActor] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchAudit = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: '50', sortBy, sortOrder });
    if (filterAction) params.set('action', filterAction);
    if (filterActor) params.set('actorId', filterActor);

    api.get(`/audit?${params.toString()}`)
      .then(res => {
        setEntries(res.data.data || []);
        setTotal(res.data.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, filterAction, filterActor, sortBy, sortOrder]);

  useEffect(() => { fetchAudit(); }, [fetchAudit]);

  const handleSort = (key: string) => {
    if (sortBy === key) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortOrder('desc'); }
  };

  const columns: Column<AuditLog>[] = [
    { key: 'created_at', label: 'Timestamp', sortable: true, width: '180px',
      render: (row) => <span className="mono">{new Date(row.created_at).toLocaleString()}</span> },
    { key: 'action', label: 'Action', sortable: true, width: '140px',
      render: (row) => ACTION_LABELS[row.action] || row.action },
    { key: 'actor_id', label: 'Actor', width: '140px',
      render: (row) => <span className="mono">{row.actor_id?.slice(0, 8)}...</span> },
    { key: 'actor_role', label: 'Role', width: '140px',
      render: (row) => row.actor_role?.replace(/_/g, ' ') },
    { key: 'target_id', label: 'Target ID', width: '160px',
      render: (row) => row.target_id ? <span className="mono">{row.target_id}</span> : '–' },
    { key: 'target_type', label: 'Target', width: '80px',
      render: (row) => row.target_type || '–' },
    { key: 'ip_address', label: 'IP', width: '120px',
      render: (row) => row.ip_address ? <span className="mono">{row.ip_address}</span> : '–' },
  ];

  return (
    <div className="audit-page">
      <TopBar title="Audit Trail" />
      <div className="audit-page__content">
        <div className="filter-bar">
          <select value={filterAction} onChange={(e) => { setFilterAction(e.target.value); setPage(1); }} id="audit-filter-action">
            <option value="">All Actions</option>
            {Object.entries(ACTION_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          {hasRole('state_nodal_officer', 'auditor') && (
            <div className="filter-bar__search">
              <Search size={14} className="filter-bar__search-icon" />
              <input
                type="text"
                placeholder="Filter by actor ID..."
                value={filterActor}
                onChange={(e) => { setFilterActor(e.target.value); setPage(1); }}
                id="audit-filter-actor"
              />
            </div>
          )}
        </div>

        <DataTable
          columns={columns}
          data={entries}
          total={total}
          page={page}
          pageSize={50}
          onPageChange={setPage}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
          loading={loading}
          emptyMessage="No audit entries found."
          id="audit-table"
        />
      </div>
    </div>
  );
}
