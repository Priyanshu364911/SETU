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
import type { Camera, Department, CameraInput } from '../types';
import { Plus, Upload, Check, X } from 'lucide-react';
import './OnboardingPage.css';

export default function OnboardingPage() {
  const { hasRole } = useAuth();
  const { showToast } = useToast();
  const [queue, setQueue] = useState<Camera[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showCSVUpload, setShowCSVUpload] = useState(false);
  const [rejectModal, setRejectModal] = useState<{ id: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);

  useEffect(() => {
    api.get('/departments').then(res => setDepartments(res.data.data || res.data)).catch(() => {});
  }, []);

  const fetchQueue = useCallback(() => {
    setLoading(true);
    api.get(`/onboarding?page=${page}&pageSize=50`)
      .then(res => {
        setQueue(res.data.data || []);
        setTotal(res.data.total || 0);
      })
      .catch(() => showToast('error', 'Failed to load onboarding queue.'))
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  const handleApprove = async (id: string) => {
    try {
      await api.patch(`/onboarding/${id}/approve`);
      showToast('success', `Camera ${id} approved.`);
      fetchQueue();
    } catch {
      showToast('error', 'Failed to approve camera.');
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    try {
      await api.patch(`/onboarding/${rejectModal.id}/reject`, { reason: rejectReason });
      showToast('success', `Camera ${rejectModal.id} rejected.`);
      setRejectModal(null);
      setRejectReason('');
      fetchQueue();
    } catch {
      showToast('error', 'Failed to reject camera.');
    }
  };

  const columns: Column<Camera>[] = [
    { key: 'id', label: 'Camera ID', sortable: true, width: '160px',
      render: (row) => <span className="mono">{row.id}</span> },
    { key: 'name', label: 'Name', sortable: true, width: '200px' },
    { key: 'department_id', label: 'Department', width: '100px' },
    { key: 'district_id', label: 'District', width: '100px' },
    { key: 'onboarding_status', label: 'Status', width: '120px',
      render: (row) => <StatusBadge status={row.onboarding_status} /> },
    { key: 'onboarding_method', label: 'Method', width: '100px' },
    { key: 'onboarded_at', label: 'Submitted', width: '120px',
      render: (row) => row.onboarded_at ? new Date(row.onboarded_at).toLocaleDateString() : '–' },
  ];

  if (hasRole('state_nodal_officer', 'department_officer')) {
    columns.push({
      key: 'actions', label: 'Actions', width: '160px',
      render: (row) => (
        row.onboarding_status === 'Pending' || row.onboarding_status === 'Validation' ? (
          <div className="onboarding-actions">
            <Button size="sm" onClick={(e) => { e.stopPropagation(); handleApprove(row.id); }}
              icon={<Check size={12} />}>Approve</Button>
            <Button size="sm" variant="danger" onClick={(e) => { e.stopPropagation(); setRejectModal({ id: row.id }); }}
              icon={<X size={12} />}>Reject</Button>
          </div>
        ) : null
      ),
    });
  }

  return (
    <div className="onboarding-page">
      <TopBar
        title="Onboarding Queue"
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowAddForm(true)}>
              Add Camera
            </Button>
            {hasRole('state_nodal_officer', 'department_officer') && (
              <Button size="sm" variant="secondary" icon={<Upload size={14} />} onClick={() => setShowCSVUpload(true)}>
                Bulk CSV
              </Button>
            )}
          </div>
        }
      />
      <div className="onboarding-page__content">
        <DataTable
          columns={columns}
          data={queue}
          total={total}
          page={page}
          pageSize={50}
          onPageChange={setPage}
          loading={loading}
          emptyMessage="No pending onboarding entries."
          id="onboarding-queue-table"
        />
      </div>

      {/* Manual Onboarding Form */}
      <Modal open={showAddForm} onClose={() => setShowAddForm(false)} title="Add Camera" width="520px">
        <ManualOnboardingForm
          departments={departments}
          onSuccess={() => { setShowAddForm(false); fetchQueue(); }}
        />
      </Modal>

      {/* CSV Upload */}
      <Modal open={showCSVUpload} onClose={() => setShowCSVUpload(false)} title="Bulk CSV Upload" width="480px">
        <CSVUploader onSuccess={() => { setShowCSVUpload(false); fetchQueue(); }} />
      </Modal>

      {/* Reject Reason */}
      <Modal
        open={!!rejectModal}
        onClose={() => { setRejectModal(null); setRejectReason(''); }}
        title="Reject Camera"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setRejectModal(null); setRejectReason(''); }}>Cancel</Button>
            <Button variant="danger" onClick={handleReject}>Reject</Button>
          </>
        }
      >
        <div className="form-field">
          <label className="form-label">Rejection reason</label>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Provide a reason for rejection..."
            rows={3}
            style={{ width: '100%' }}
          />
        </div>
      </Modal>
    </div>
  );
}

function ManualOnboardingForm({ departments, onSuccess }: { departments: Department[]; onSuccess: () => void }) {
  const { showToast } = useToast();
  const [formData, setFormData] = useState<Partial<CameraInput>>({
    camera_type: 'IP',
    connectivity: 'Fiber',
    storage_type: 'Cloud',
    ownership: 'Govt',
    retention_days: 30,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const update = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => { const copy = { ...prev }; delete copy[field]; return copy; });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!formData.name) errs.name = 'Name is required.';
    if (!formData.department_id) errs.department_id = 'Department is required.';
    if (!formData.district_id) errs.district_id = 'District is required.';
    if (!formData.latitude || formData.latitude < 20.1 || formData.latitude > 24.7) errs.latitude = 'Latitude must be 20.1–24.7.';
    if (!formData.longitude || formData.longitude < 68.2 || formData.longitude > 74.5) errs.longitude = 'Longitude must be 68.2–74.5.';
    if (!formData.retention_days || formData.retention_days < 1 || formData.retention_days > 365) errs.retention_days = 'Must be 1–365.';

    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSubmitting(true);
    try {
      const res = await api.post('/onboarding', formData);
      showToast('success', `Camera submitted. ID: ${res.data.id || res.data.camera_id}`);
      onSuccess();
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Failed to submit camera.';
      showToast('error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="onboard-form" onSubmit={handleSubmit}>
      <div className="form-row">
        <div className="form-field">
          <label className="form-label">Camera Name *</label>
          <input value={formData.name || ''} onChange={(e) => update('name', e.target.value)} placeholder="e.g., Ring Road Junction Cam" />
          {errors.name && <span className="form-error">{errors.name}</span>}
        </div>
      </div>
      <div className="form-row form-row--2col">
        <div className="form-field">
          <label className="form-label">Department *</label>
          <select value={formData.department_id || ''} onChange={(e) => update('department_id', e.target.value)}>
            <option value="">Select...</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          {errors.department_id && <span className="form-error">{errors.department_id}</span>}
        </div>
        <div className="form-field">
          <label className="form-label">District *</label>
          <input value={formData.district_id || ''} onChange={(e) => update('district_id', e.target.value)} placeholder="e.g., AHM" />
          {errors.district_id && <span className="form-error">{errors.district_id}</span>}
        </div>
      </div>
      <div className="form-row form-row--2col">
        <div className="form-field">
          <label className="form-label">Latitude *</label>
          <input type="number" step="0.000001" value={formData.latitude || ''} onChange={(e) => update('latitude', parseFloat(e.target.value))} placeholder="20.1 – 24.7" />
          {errors.latitude && <span className="form-error">{errors.latitude}</span>}
        </div>
        <div className="form-field">
          <label className="form-label">Longitude *</label>
          <input type="number" step="0.000001" value={formData.longitude || ''} onChange={(e) => update('longitude', parseFloat(e.target.value))} placeholder="68.2 – 74.5" />
          {errors.longitude && <span className="form-error">{errors.longitude}</span>}
        </div>
      </div>
      <div className="form-row form-row--2col">
        <div className="form-field">
          <label className="form-label">Camera Type</label>
          <select value={formData.camera_type} onChange={(e) => update('camera_type', e.target.value)}>
            <option value="IP">IP</option>
            <option value="Analog">Analog</option>
            <option value="PTZ">PTZ</option>
            <option value="ANPR">ANPR</option>
          </select>
        </div>
        <div className="form-field">
          <label className="form-label">Connectivity</label>
          <select value={formData.connectivity} onChange={(e) => update('connectivity', e.target.value)}>
            <option value="Fiber">Fiber</option>
            <option value="4G">4G</option>
            <option value="Microwave">Microwave</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>
      <div className="form-row form-row--2col">
        <div className="form-field">
          <label className="form-label">Storage Type</label>
          <select value={formData.storage_type} onChange={(e) => update('storage_type', e.target.value)}>
            <option value="Local NVR">Local NVR</option>
            <option value="Cloud">Cloud</option>
            <option value="Hybrid">Hybrid</option>
          </select>
        </div>
        <div className="form-field">
          <label className="form-label">Ownership</label>
          <select value={formData.ownership} onChange={(e) => update('ownership', e.target.value)}>
            <option value="Govt">Govt</option>
            <option value="Private">Private</option>
          </select>
        </div>
      </div>
      <div className="form-row form-row--2col">
        <div className="form-field">
          <label className="form-label">Retention Days</label>
          <input type="number" min={1} max={365} value={formData.retention_days || ''} onChange={(e) => update('retention_days', parseInt(e.target.value))} />
          {errors.retention_days && <span className="form-error">{errors.retention_days}</span>}
        </div>
      </div>
      <div className="form-field">
        <label className="form-label">Notes</label>
        <textarea value={formData.notes || ''} onChange={(e) => update('notes', e.target.value)} placeholder="Optional notes..." rows={2} style={{ width: '100%' }} />
      </div>
      <div className="form-actions">
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Submitting...' : 'Add Camera'}
        </Button>
      </div>
    </form>
  );
}

function CSVUploader({ onSuccess }: { onSuccess: () => void }) {
  const { showToast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ accepted: number; rejected: number; errors: Array<{ row: number; field: string; message: string }> } | null>(null);

  const handleUpload = async () => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('error', 'File size exceeds 5 MB limit.');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    setUploading(true);
    try {
      const res = await api.post('/onboarding/bulk', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data);
      if (res.data.rejected === 0) {
        showToast('success', `All ${res.data.accepted} cameras accepted.`);
        onSuccess();
      } else {
        showToast('error', `${res.data.rejected} rows rejected. See details below.`);
      }
    } catch {
      showToast('error', 'CSV upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="csv-uploader">
      <div className="form-field">
        <label className="form-label">Select CSV file (max 5 MB)</label>
        <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      </div>
      <div className="form-actions">
        <Button onClick={handleUpload} disabled={!file || uploading}>
          {uploading ? 'Uploading...' : 'Upload CSV'}
        </Button>
      </div>
      {result && (
        <div className="csv-result">
          <p><strong>Accepted:</strong> {result.accepted} | <strong>Rejected:</strong> {result.rejected}</p>
          {result.errors.length > 0 && (
            <div className="csv-errors">
              <div className="csv-errors__header">Errors:</div>
              {result.errors.map((err, i) => (
                <div key={i} className="csv-errors__row">
                  Row {err.row}: <code>{err.field}</code> — {err.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
