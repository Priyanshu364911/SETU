import type { CameraStatus, OnboardingStatus } from '../types';
import './StatusBadge.css';

type BadgeStatus = CameraStatus | OnboardingStatus;

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  Online: { color: 'var(--status-online)', label: 'Online' },
  Maintenance: { color: 'var(--status-warning)', label: 'Maintenance' },
  Offline: { color: 'var(--status-offline)', label: 'Offline' },
  Pending: { color: 'var(--text-tertiary)', label: 'Pending' },
  Approved: { color: 'var(--status-online)', label: 'Approved' },
  Rejected: { color: 'var(--status-offline)', label: 'Rejected' },
  Validation: { color: 'var(--status-warning)', label: 'Validation' },
};

interface StatusBadgeProps {
  status: BadgeStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || { color: 'var(--text-tertiary)', label: status };
  return (
    <span className="status-badge" style={{ color: config.color }}>
      <span className="status-badge__dot" style={{ backgroundColor: config.color }} />
      {config.label}
    </span>
  );
}
