import { useEffect, useState, useCallback } from 'react';
import TopBar from '../components/TopBar';
import DataTable from '../components/DataTable';
import type { Column } from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import Button from '../components/Button';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import api from '../api';
import type { Camera, Department } from '../types';
import { Download, Search } from 'lucide-react';
import './RegistryPage.css';

export default function RegistryPage() {
  const { hasRole } = useAuth();
  const { showToast } = useToast();
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterType, setFilterType] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);

  useEffect(() => {
    api.get('/departments').then(res => setDepartments(res.data.data || res.data)).catch(() => {});
  }, []);

  const fetchCameras = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      sortBy,
      sortOrder,
    });
    if (search) params.set('search', search);
    if (filterStatus) params.set('status', filterStatus);
    if (filterDept) params.set('departmentId', filterDept);
    if (filterType) params.set('cameraType', filterType);

    api.get(`/cameras?${params.toString()}`)
      .then(res => {
        setCameras(res.data.data || []);
        setTotal(res.data.total || 0);
      })
      .catch(() => showToast('error', 'Failed to load cameras.'))
      .finally(() => setLoading(false));
  }, [page, pageSize, sortBy, sortOrder, search, filterStatus, filterDept, filterType]);

  useEffect(() => { fetchCameras(); }, [fetchCameras]);

  const handleSort = (key: string) => {
    if (sortBy === key) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortOrder('asc');
    }
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (filterStatus) params.set('status', filterStatus);
    if (filterDept) params.set('departmentId', filterDept);
    window.open(`${api.defaults.baseURL}/cameras/export?${params.toString()}`, '_blank');
  };

  const columns: Column<Camera>[] = [
    { key: 'id', label: 'Camera ID', sortable: true, width: '160px',
      render: (row) => <span className="mono">{row.id}</span> },
    { key: 'name', label: 'Name', sortable: true, width: '200px' },
    { key: 'department_id', label: 'Department', sortable: true, width: '100px' },
    { key: 'district_id', label: 'District', sortable: true, width: '100px' },
    { key: 'status', label: 'Status', sortable: true, width: '120px',
      render: (row) => <StatusBadge status={row.status} /> },
    { key: 'camera_type', label: 'Type', sortable: true, width: '80px' },
    { key: 'connectivity', label: 'Connectivity', sortable: true, width: '100px' },
    { key: 'onboarding_status', label: 'Onboarding', sortable: true, width: '120px',
      render: (row) => <StatusBadge status={row.onboarding_status} /> },
    { key: 'ownership', label: 'Ownership', width: '80px' },
  ];

  return (
    <div className="registry-page">
      <TopBar
        title="Camera Registry"
        actions={
          hasRole('state_nodal_officer', 'department_officer', 'auditor') && (
            <Button variant="secondary" size="sm" icon={<Download size={14} />} onClick={handleExport}>
              Export CSV
            </Button>
          )
        }
      />
      <div className="registry-page__content">
        <div className="registry-page__filters" id="registry-filters">
          <div className="filter-bar">
            <div className="filter-bar__search">
              <Search size={14} className="filter-bar__search-icon" />
              <input
                type="text"
                placeholder="Search cameras..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                id="filter-search"
              />
            </div>
            <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }} id="filter-status">
              <option value="">All Statuses</option>
              <option value="Online">Online</option>
              <option value="Offline">Offline</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Pending">Pending</option>
            </select>
            <select value={filterDept} onChange={(e) => { setFilterDept(e.target.value); setPage(1); }} id="filter-department">
              <option value="">All Departments</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select value={filterType} onChange={(e) => { setFilterType(e.target.value); setPage(1); }} id="filter-type">
              <option value="">All Types</option>
              <option value="IP">IP</option>
              <option value="Analog">Analog</option>
              <option value="PTZ">PTZ</option>
              <option value="ANPR">ANPR</option>
            </select>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={cameras}
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
          onRowClick={(row) => setSelectedCamera(row)}
          loading={loading}
          emptyMessage="No cameras match these filters. Try adjusting department or status."
          id="camera-registry-table"
        />
      </div>

      <Modal
        open={!!selectedCamera}
        onClose={() => setSelectedCamera(null)}
        title="Camera Detail"
        width="560px"
      >
        {selectedCamera && (
          <div className="camera-detail">
            <div className="camera-detail__id mono">{selectedCamera.id}</div>
            <div className="camera-detail__grid">
              <DetailRow label="Name" value={selectedCamera.name} />
              <DetailRow label="Status" value={<StatusBadge status={selectedCamera.status} />} />
              <DetailRow label="Department" value={selectedCamera.department_id} />
              <DetailRow label="District" value={selectedCamera.district_id} />
              <DetailRow label="Type" value={selectedCamera.camera_type} />
              <DetailRow label="Connectivity" value={selectedCamera.connectivity} />
              <DetailRow label="Storage" value={selectedCamera.storage_type} />
              <DetailRow label="Retention" value={`${selectedCamera.retention_days} days`} />
              <DetailRow label="Ownership" value={selectedCamera.ownership} />
              <DetailRow label="Onboarding" value={<StatusBadge status={selectedCamera.onboarding_status} />} />
              <DetailRow label="Coordinates" value={
                <span className="mono">{selectedCamera.latitude.toFixed(6)}, {selectedCamera.longitude.toFixed(6)}</span>
              } />
              <DetailRow label="Onboarded" value={selectedCamera.onboarded_at ? new Date(selectedCamera.onboarded_at).toLocaleDateString() : '–'} />
              <DetailRow label="Last Verified" value={selectedCamera.last_verified_at ? new Date(selectedCamera.last_verified_at).toLocaleDateString() : 'Never'} />
              {selectedCamera.notes && <DetailRow label="Notes" value={selectedCamera.notes} />}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="camera-detail__row">
      <span className="camera-detail__label">{label}</span>
      <span className="camera-detail__value">{value}</span>
    </div>
  );
}
