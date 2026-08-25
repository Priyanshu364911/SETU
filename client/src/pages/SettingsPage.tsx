import { useEffect, useState } from 'react';
import TopBar from '../components/TopBar';
import DataTable from '../components/DataTable';
import type { Column } from '../components/DataTable';
import Button from '../components/Button';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import api from '../api';
import type { User, Department, Role } from '../types';
import { Plus } from 'lucide-react';
import './SettingsPage.css';

export default function SettingsPage() {
  const { hasRole } = useAuth();
  const { showToast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateUser, setShowCreateUser] = useState(false);

  if (!hasRole('state_nodal_officer')) {
    return (
      <div className="settings-page">
        <TopBar title="Settings" />
        <div className="settings-page__content">
          <div className="settings-page__forbidden">
            You do not have permission to access this page.
          </div>
        </div>
      </div>
    );
  }

  useEffect(() => {
    Promise.all([
      api.get('/users'),
      api.get('/departments'),
    ]).then(([usersRes, deptRes]) => {
      setUsers(usersRes.data.data || usersRes.data || []);
      setDepartments(deptRes.data.data || deptRes.data || []);
    }).catch(() => showToast('error', 'Failed to load settings.'))
      .finally(() => setLoading(false));
  }, []);

  const fetchUsers = () => {
    api.get('/users').then(res => setUsers(res.data.data || res.data || [])).catch(() => {});
  };

  const toggleActive = async (user: User) => {
    try {
      await api.patch(`/users/${user.id}`, { is_active: !user.is_active });
      showToast('success', `User ${user.username} ${user.is_active ? 'deactivated' : 'activated'}.`);
      fetchUsers();
    } catch {
      showToast('error', 'Failed to update user.');
    }
  };

  const columns: Column<User>[] = [
    { key: 'username', label: 'Username', width: '140px',
      render: (row) => <span className="mono">{row.username}</span> },
    { key: 'email', label: 'Email', width: '200px',
      render: (row) => <span className="mono">{row.email}</span> },
    { key: 'role', label: 'Role', width: '160px',
      render: (row) => row.role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) },
    { key: 'department_id', label: 'Department', width: '100px',
      render: (row) => row.department_id || '–' },
    { key: 'is_active', label: 'Status', width: '100px',
      render: (row) => row.is_active
        ? <span style={{ color: 'var(--status-online)' }}>Active</span>
        : <span style={{ color: 'var(--status-offline)' }}>Inactive</span> },
    { key: 'actions', label: 'Actions', width: '120px',
      render: (row) => (
        <Button size="sm" variant="secondary" onClick={() => toggleActive(row)}>
          {row.is_active ? 'Deactivate' : 'Activate'}
        </Button>
      )},
  ];

  return (
    <div className="settings-page">
      <TopBar
        title="Settings"
        actions={
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowCreateUser(true)}>
            Create User
          </Button>
        }
      />
      <div className="settings-page__content">
        <div className="settings-section">
          <h3 className="section-heading">User Management</h3>
          <DataTable
            columns={columns}
            data={users}
            total={users.length}
            loading={loading}
            emptyMessage="No users found."
            id="users-table"
          />
        </div>
      </div>

      <Modal open={showCreateUser} onClose={() => setShowCreateUser(false)} title="Create User" width="480px">
        <CreateUserForm
          departments={departments}
          onSuccess={() => { setShowCreateUser(false); fetchUsers(); }}
        />
      </Modal>
    </div>
  );
}

function CreateUserForm({ departments, onSuccess }: { departments: Department[]; onSuccess: () => void }) {
  const { showToast } = useToast();
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'field_officer' as Role, department_id: '' });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/users', {
        ...form,
        department_id: form.department_id || null,
      });
      showToast('success', `User ${form.username} created.`);
      onSuccess();
    } catch (err: any) {
      showToast('error', err?.response?.data?.error || 'Failed to create user.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="onboard-form" onSubmit={handleSubmit}>
      <div className="form-field">
        <label className="form-label">Username</label>
        <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
      </div>
      <div className="form-field">
        <label className="form-label">Email</label>
        <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
      </div>
      <div className="form-field">
        <label className="form-label">Password</label>
        <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={8} required />
      </div>
      <div className="form-row form-row--2col">
        <div className="form-field">
          <label className="form-label">Role</label>
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            <option value="state_nodal_officer">State Nodal Officer</option>
            <option value="department_officer">Department Officer</option>
            <option value="field_officer">Field Officer</option>
            <option value="auditor">Auditor</option>
          </select>
        </div>
        <div className="form-field">
          <label className="form-label">Department</label>
          <select value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
            <option value="">None</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </div>
      <div className="form-actions">
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Creating...' : 'Create User'}
        </Button>
      </div>
    </form>
  );
}
