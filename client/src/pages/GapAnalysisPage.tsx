import { useEffect, useState } from 'react';
import TopBar from '../components/TopBar';
import DataTable from '../components/DataTable';
import type { Column } from '../components/DataTable';
import Button from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import api from '../api';
import type { GapZone, DistrictRanking } from '../types';
import { Download } from 'lucide-react';
import './GapAnalysisPage.css';

export default function GapAnalysisPage() {
  const { hasRole } = useAuth();
  const { showToast } = useToast();
  const [zones, setZones] = useState<GapZone[]>([]);
  const [rankings, setRankings] = useState<DistrictRanking[]>([]);
  const [threshold, setThreshold] = useState(0.5);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/gap-analysis?threshold=${threshold}`),
      api.get('/gap-analysis/ageing').catch(() => ({ data: { districts: [] } })),
    ]).then(([zonesRes, rankingsRes]) => {
      setZones(zonesRes.data.zones || zonesRes.data || []);
      setRankings(rankingsRes.data.districts || rankingsRes.data || []);
    }).catch(() => showToast('error', 'Failed to load gap analysis.'))
      .finally(() => setLoading(false));
  }, [threshold]);

  const handleExport = () => {
    window.open(`${api.defaults.baseURL}/gap-analysis/export?threshold=${threshold}`, '_blank');
  };

  const zoneColumns: Column<GapZone>[] = [
    { key: 'district_name', label: 'District', sortable: true, width: '180px' },
    { key: 'camera_count', label: 'Cameras', sortable: true, width: '100px',
      render: (row) => <span className="mono">{row.camera_count}</span> },
    { key: 'avg_per_district', label: 'Average', width: '100px',
      render: (row) => <span className="mono">{row.avg_per_district.toFixed(1)}</span> },
    { key: 'deficit', label: 'Deficit', sortable: true, width: '100px',
      render: (row) => <span className="mono" style={{ color: 'var(--status-offline)' }}>−{row.deficit.toFixed(1)}</span> },
  ];

  return (
    <div className="gap-page">
      <TopBar
        title="Gap Analysis"
        actions={
          hasRole('state_nodal_officer', 'department_officer', 'auditor') && (
            <Button variant="secondary" size="sm" icon={<Download size={14} />} onClick={handleExport}>
              Export Report
            </Button>
          )
        }
      />
      <div className="gap-page__content">
        <div className="gap-page__controls">
          <label className="form-label">Threshold</label>
          <div className="gap-page__slider-row">
            <input
              type="range"
              min="0.1"
              max="0.9"
              step="0.05"
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              id="gap-threshold"
            />
            <span className="mono">{(threshold * 100).toFixed(0)}%</span>
          </div>
          <p className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)' }}>
            Show districts with camera count below {(threshold * 100).toFixed(0)}% of the district average.
          </p>
        </div>

        <div className="gap-page__section">
          <h3 className="section-heading">Low Coverage Zones ({zones.length})</h3>
          <DataTable
            columns={zoneColumns}
            data={zones}
            total={zones.length}
            loading={loading}
            emptyMessage="No districts below the threshold."
            id="gap-zones-table"
          />
        </div>

        {rankings.length > 0 && (
          <div className="gap-page__section">
            <h3 className="section-heading">District Rankings</h3>
            <DataTable
              columns={[
                { key: 'rank', label: '#', width: '50px', render: (row: DistrictRanking) => <span className="mono">{row.rank}</span> },
                { key: 'district_name', label: 'District', width: '180px' },
                { key: 'camera_count', label: 'Cameras', width: '100px', render: (row: DistrictRanking) => <span className="mono">{row.camera_count}</span> },
                { key: 'online_rate', label: 'Online Rate', width: '100px',
                  render: (row: DistrictRanking) => <span className="mono">{(row.online_rate * 100).toFixed(1)}%</span> },
                { key: 'below_average', label: 'Below Avg', width: '100px',
                  render: (row: DistrictRanking) => row.below_average
                    ? <span style={{ color: 'var(--status-offline)' }}>Yes</span>
                    : <span style={{ color: 'var(--text-tertiary)' }}>No</span> },
              ]}
              data={rankings}
              total={rankings.length}
              id="district-rankings-table"
            />
          </div>
        )}
      </div>
    </div>
  );
}
