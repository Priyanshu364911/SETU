import { useEffect, useState } from 'react';
import TopBar from '../components/TopBar';
import DataTable from '../components/DataTable';
import type { Column } from '../components/DataTable';
import api from '../api';
import type { Department } from '../types';
import Modal from '../components/Modal';
import './DepartmentsPage.css';

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Department | null>(null);

  useEffect(() => {
    api.get('/departments')
      .then(res => setDepartments(res.data.data || res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const columns: Column<Department>[] = [
    { key: 'id', label: 'Code', width: '80px',
      render: (row) => <span className="mono">{row.id}</span> },
    { key: 'name', label: 'Department Name', sortable: true, width: '260px' },
    { key: 'nodal_officer_name', label: 'Nodal Officer', width: '180px' },
    { key: 'nodal_officer_email', label: 'Email', width: '220px',
      render: (row) => <span className="mono">{row.nodal_officer_email}</span> },
    { key: 'camera_count', label: 'Cameras', width: '100px',
      render: (row) => <span className="mono">{row.camera_count ?? 0}</span> },
  ];

  return (
    <div className="departments-page">
      <TopBar title="Departments" />
      <div className="departments-page__content">
        <DataTable
          columns={columns}
          data={departments}
          total={departments.length}
          loading={loading}
          onRowClick={(row) => setSelected(row)}
          emptyMessage="No departments found."
          id="departments-table"
        />
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Department Detail" width="480px">
        {selected && (
          <div className="dept-detail">
            <div className="dept-detail__row">
              <span className="dept-detail__label">Code</span>
              <span className="mono">{selected.id}</span>
            </div>
            <div className="dept-detail__row">
              <span className="dept-detail__label">Name</span>
              <span>{selected.name}</span>
            </div>
            <div className="dept-detail__row">
              <span className="dept-detail__label">Nodal Officer</span>
              <span>{selected.nodal_officer_name}</span>
            </div>
            <div className="dept-detail__row">
              <span className="dept-detail__label">Email</span>
              <span className="mono">{selected.nodal_officer_email}</span>
            </div>
            <div className="dept-detail__row">
              <span className="dept-detail__label">Cameras</span>
              <span className="mono">{selected.camera_count ?? 0}</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
