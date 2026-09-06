import { useState, useEffect, useCallback } from 'react';
import { Tv, Maximize2, Tag, RefreshCw, X, Radio, CheckCircle2 } from 'lucide-react';
import CctvLivePlayer from '../components/CctvLivePlayer';
import { model2Api } from '../api';
import './LiveViewPage.css';

interface LiveFeedCamera {
  id: string;
  name: string;
  department_id: string;
  district_id: string;
  latitude: number;
  longitude: number;
  camera_type: string;
  status: string;
  vms_system_id: string;
  vms_name: string;
  external_camera_id: string;
  stream_url: string;
  clean_cam_id: string;
}

interface TaggedEvent {
  id: string;
  camera_id: string;
  timestamp: string;
  note: string;
  snapshot_url: string | null;
  camera_name?: string;
  tagged_by_username?: string;
}

export default function LiveViewPage() {
  const [feeds, setFeeds] = useState<LiveFeedCamera[]>([]);
  const [loading, setLoading] = useState(true);
  const [gridMode, setGridMode] = useState<'1x1' | '2x2' | '3x3'>('2x2');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Selected camera tiles (slot assignment)
  const [selectedCamIds, setSelectedCamIds] = useState<string[]>([]);
  const [focusedFeed, setFocusedFeed] = useState<LiveFeedCamera | null>(null);

  // Event tagging modal state
  const [tagModalCam, setTagModalCam] = useState<LiveFeedCamera | null>(null);
  const [tagNote, setTagNote] = useState('');
  const [tagSubmitting, setTagSubmitting] = useState(false);
  const [tagSuccessMsg, setTagSuccessMsg] = useState('');

  // Recent tagged events list
  const [taggedEvents, setTaggedEvents] = useState<TaggedEvent[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [feedsData, tagsData] = await Promise.all([
        model2Api.getLiveFeeds(),
        model2Api.getTaggedEvents(undefined, 20).catch(() => []),
      ]);
      setFeeds(feedsData || []);
      setTaggedEvents(tagsData || []);

      // Default select first N feeds based on current slot capacity
      if (feedsData && feedsData.length > 0 && selectedCamIds.length === 0) {
        setSelectedCamIds(feedsData.slice(0, 9).map((f: LiveFeedCamera) => f.id));
      }
    } catch (err: any) {
      console.warn('[LiveView] Failed to load feeds:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Number of slots for current grid layout
  const slotCount = gridMode === '1x1' ? 1 : gridMode === '2x2' ? 4 : 9;

  // Filtered cameras for picker
  const filteredFeeds = feeds.filter((f) => {
    const matchesDept = departmentFilter === 'ALL' || f.department_id === departmentFilter;
    const matchesSearch =
      !searchQuery ||
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.clean_cam_id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDept && matchesSearch;
  });

  const handleTagSubmit = async () => {
    if (!tagModalCam || !tagNote.trim()) return;
    setTagSubmitting(true);
    try {
      await model2Api.tagEvent({
        camera_id: tagModalCam.id,
        note: tagNote.trim(),
      });
      setTagSuccessMsg(`Event tagged for camera ${tagModalCam.name}`);
      setTagNote('');
      setTimeout(() => {
        setTagModalCam(null);
        setTagSuccessMsg('');
      }, 1200);

      // Refresh tags
      const updatedTags = await model2Api.getTaggedEvents(undefined, 20).catch(() => []);
      setTaggedEvents(updatedTags || []);
    } catch (err: any) {
      alert(err?.response?.data?.error ?? err.message);
    } finally {
      setTagSubmitting(false);
    }
  };

  const handleSlotChange = (slotIndex: number, newCamId: string) => {
    setSelectedCamIds((prev) => {
      const next = [...prev];
      next[slotIndex] = newCamId;
      return next;
    });
  };

  // Get displayed feeds for current grid layout
  const activeGridFeeds = selectedCamIds.slice(0, slotCount).map((id) => feeds.find((f) => f.id === id)).filter(Boolean) as LiveFeedCamera[];

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="lv-page">
      {/* Header */}
      <div className="lv-header">
        <div>
          <div className="lv-header__title">
            <Tv size={20} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8, color: 'var(--accent)' }} />
            Unified Viewer (Model 2)
          </div>
          <div className="lv-header__subtitle">
            Consuming federated VMS live streams through Model 3 middleware — Gujarat Police Command & Control
          </div>
        </div>

        {/* Grid controls & refresh */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div className="lv-grid-picker">
            <button
              className={`lv-grid-btn ${gridMode === '1x1' ? 'lv-grid-btn--active' : ''}`}
              onClick={() => setGridMode('1x1')}
              title="Single Focus (1x1)"
            >
              1×1
            </button>
            <button
              className={`lv-grid-btn ${gridMode === '2x2' ? 'lv-grid-btn--active' : ''}`}
              onClick={() => setGridMode('2x2')}
              title="Quad View (2x2)"
            >
              2×2
            </button>
            <button
              className={`lv-grid-btn ${gridMode === '3x3' ? 'lv-grid-btn--active' : ''}`}
              onClick={() => setGridMode('3x3')}
              title="Video Wall (3x3)"
            >
              3×3
            </button>
          </div>

          <button className="btn-sm btn-sm--ghost" onClick={() => void loadData()} disabled={loading}>
            <RefreshCw size={13} style={{ marginRight: 4, display: 'inline', verticalAlign: 'middle' }} />
            Refresh
          </button>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="lv-content">
        {/* Left Area: Video Grid */}
        <div className="lv-main">
          {/* Top Filter Strip */}
          <div className="lv-filter-bar">
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="lv-filter-label">Filter Feeds:</span>
              <select
                className="lv-select"
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
              >
                <option value="ALL">All Departments</option>
                <option value="POL">Gujarat Police (POL)</option>
                <option value="SMC">Surat Municipal (SMC)</option>
                <option value="AMC">Ahmedabad Municipal (AMC)</option>
                <option value="RTO">Road Transport (RTO)</option>
                <option value="NHAI">Highway Authority (NHAI)</option>
              </select>

              <input
                type="text"
                className="lv-input"
                placeholder="Search camera name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Showing <strong style={{ color: 'var(--accent)' }}>{activeGridFeeds.length}</strong> of {feeds.length} camera feeds
            </div>
          </div>

          {/* Camera Grid Tiles */}
          <div className={`lv-grid lv-grid--${gridMode}`}>
            {Array.from({ length: slotCount }).map((_, slotIndex) => {
              const currentFeed = activeGridFeeds[slotIndex];

              return (
                <div key={slotIndex} className="lv-tile">
                  {/* Tile Header Bar */}
                  <div className="lv-tile__header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                      <span className="lv-tile__status-dot" title="Live stream feed connected" />
                      <select
                        className="lv-tile__cam-select"
                        value={currentFeed?.id || ''}
                        onChange={(e) => handleSlotChange(slotIndex, e.target.value)}
                      >
                        {filteredFeeds.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.clean_cam_id.toUpperCase()} · {f.name} ({f.department_id})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span className="lv-tile__dept-tag">{currentFeed?.department_id || 'POL'}</span>
                      <button
                        className="lv-tile__icon-btn"
                        onClick={() => currentFeed && setTagModalCam(currentFeed)}
                        title="Tag manual event"
                      >
                        <Tag size={13} />
                      </button>
                      <button
                        className="lv-tile__icon-btn"
                        onClick={() => currentFeed && setFocusedFeed(currentFeed)}
                        title="Expand to Fullscreen"
                      >
                        <Maximize2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Tile Video Body */}
                  <div className="lv-tile__body">
                    {currentFeed ? (
                      <CctvLivePlayer
                        cameraId={currentFeed.id}
                        cameraName={currentFeed.name}
                        vmsSystemId={currentFeed.vms_system_id}
                        streamUrl={currentFeed.stream_url}
                      />
                    ) : (
                      <div className="lv-tile__empty">
                        <Tv size={28} style={{ opacity: 0.3 }} />
                        <span>No Feed Assigned</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Sidebar: Activity & Tagged Events */}
        <div className="lv-sidebar">
          {/* Architecture Badge Note */}
          <div className="lv-arch-banner">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--accent)' }}>
              <Radio size={14} /> Model 3 Consumed Layer
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.4 }}>
              Model 2 viewer consumes streams directly via Model 3 federation middleware stream proxy handles without duplicating vendor protocol logic.
            </p>
          </div>

          {/* Recent Event Tags */}
          <div className="lv-sidebar__card">
            <div className="lv-sidebar__header">
              <Tag size={14} style={{ marginRight: 6, color: 'var(--accent)' }} />
              Recent Operator Event Tags
            </div>

            <div className="lv-sidebar__list">
              {taggedEvents.length === 0 ? (
                <div className="lv-sidebar__empty">
                  No operator tags logged yet. Click the tag icon on any camera tile to mark an event of interest.
                </div>
              ) : (
                taggedEvents.map((t) => (
                  <div key={t.id} className="lv-tag-item">
                    <div className="lv-tag-item__top">
                      <span className="lv-tag-item__cam">{t.camera_id}</span>
                      <span className="lv-tag-item__time">{formatTime(t.timestamp)}</span>
                    </div>
                    <div className="lv-tag-item__note">{t.note}</div>
                    <div className="lv-tag-item__by">Tagged by {t.tagged_by_username || 'Operator'}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Tag Event Modal ─── */}
      {tagModalCam && (
        <div className="lv-modal-overlay">
          <div className="lv-modal">
            <div className="lv-modal__header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                <Tag size={16} style={{ color: 'var(--accent)' }} />
                Tag Event of Interest — {tagModalCam.name} ({tagModalCam.clean_cam_id.toUpperCase()})
              </div>
              <button className="lv-modal__close" onClick={() => setTagModalCam(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="lv-modal__body">
              {tagSuccessMsg ? (
                <div className="lv-modal__success">
                  <CheckCircle2 size={18} style={{ color: '#16a34a', marginRight: 6 }} />
                  {tagSuccessMsg}
                </div>
              ) : (
                <>
                  <label className="lv-label">Operator Event Note / Observation *</label>
                  <textarea
                    className="lv-textarea"
                    rows={3}
                    placeholder="e.g. Suspect vehicle parked near restricted perimeter; requested patrol dispatch."
                    value={tagNote}
                    onChange={(e) => setTagNote(e.target.value)}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                    Event will be recorded in Model 2 database and logged to the central Audit Trail.
                  </span>
                </>
              )}
            </div>

            {!tagSuccessMsg && (
              <div className="lv-modal__footer">
                <button
                  className="btn-sm btn-sm--primary"
                  onClick={() => void handleTagSubmit()}
                  disabled={tagSubmitting || !tagNote.trim()}
                >
                  {tagSubmitting ? 'Saving…' : 'Save Event Tag'}
                </button>
                <button className="btn-sm btn-sm--ghost" onClick={() => setTagModalCam(null)}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Fullscreen Focus Modal ─── */}
      {focusedFeed && (
        <div className="lv-modal-overlay">
          <div className="lv-modal lv-modal--lg">
            <div className="lv-modal__header">
              <div>
                <strong>{focusedFeed.name}</strong> ({focusedFeed.clean_cam_id.toUpperCase()})
                <span style={{ marginLeft: 8, fontSize: '11px', color: 'var(--text-secondary)' }}>
                  {focusedFeed.vms_name} · Dept: {focusedFeed.department_id}
                </span>
              </div>
              <button className="lv-modal__close" onClick={() => setFocusedFeed(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="lv-modal__body" style={{ padding: 0 }}>
              <CctvLivePlayer
                cameraId={focusedFeed.id}
                cameraName={focusedFeed.name}
                vmsSystemId={focusedFeed.vms_system_id}
                streamUrl={focusedFeed.stream_url}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
