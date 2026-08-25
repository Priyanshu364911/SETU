// Core Enums
export type Role = 'state_nodal_officer' | 'department_officer' | 'field_officer' | 'auditor';

export type CameraStatus = 'Online' | 'Maintenance' | 'Offline' | 'Pending';

export type OnboardingStatus = 'Pending' | 'Validation' | 'Approved' | 'Rejected';

export type CameraType = 'IP' | 'Analog' | 'PTZ' | 'ANPR';

export type ConnectivityType = 'Fiber' | '4G' | 'Microwave' | 'Other';

export type StorageType = 'Local NVR' | 'Cloud' | 'Hybrid';

export type OwnershipType = 'Govt' | 'Private';

export type OnboardingMethod = 'Manual' | 'Bulk CSV' | 'API';

export type AuditAction =
  | 'ONBOARD_SUBMIT'
  | 'ONBOARD_APPROVE'
  | 'ONBOARD_REJECT'
  | 'STATUS_CHANGE'
  | 'CAMERA_UPDATE'
  | 'CAMERA_DELETE'
  | 'BULK_UPLOAD'
  | 'EXPORT'
  | 'LOGIN'
  | 'USER_CREATE'
  | 'USER_UPDATE';

// Core Entities
export interface Camera {
  id: string;
  name: string;
  department_id: string;
  district_id: string;
  latitude: number;
  longitude: number;
  camera_type: CameraType;
  connectivity: ConnectivityType;
  storage_type: StorageType;
  retention_days: number;
  ownership: OwnershipType;
  status: CameraStatus;
  onboarding_status: OnboardingStatus;
  onboarding_method: OnboardingMethod;
  onboarded_by: string;
  onboarded_at: string;
  last_verified_at: string | null;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CameraInput {
  id?: string;
  name: string;
  department_id: string;
  district_id: string;
  latitude: number;
  longitude: number;
  camera_type: CameraType;
  connectivity: ConnectivityType;
  storage_type: StorageType;
  retention_days: number;
  ownership: OwnershipType;
  notes?: string;
}

export interface Department {
  id: string;
  name: string;
  nodal_officer_name: string;
  nodal_officer_email: string;
  camera_count?: number;
  created_at: string;
}

export interface District {
  id: string;
  name: string;
  centroid_lat: number;
  centroid_lng: number;
  region: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: Role;
  department_id: string | null;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  role: Role;
  department_id: string | null;
}

export interface AuditLog {
  id: string;
  action: AuditAction;
  actor_id: string;
  actor_role: Role;
  target_id: string | null;
  target_type: 'camera' | 'user' | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface TokenPayload {
  userId: string;
  username: string;
  role: Role;
  departmentId: string | null;
  exp: number;
}

export interface CameraStats {
  total: number;
  online: number;
  offline: number;
  maintenance: number;
  pending: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface GeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: {
    id: string;
    status: CameraStatus;
    departmentId: string;
    cameraType: CameraType;
  };
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

export interface GapZone {
  district_id: string;
  district_name: string;
  camera_count: number;
  avg_per_district: number;
  deficit: number;
  coordinates: [number, number];
}

export interface DistrictRanking {
  district_id: string;
  district_name: string;
  camera_count: number;
  online_rate: number;
  rank: number;
  below_average: boolean;
}

export interface FlaggedCamera {
  camera: Camera;
  flag_reason: 'Offline' | 'Maintenance' | 'Not_Verified_90d' | 'Retention_Expiring';
  flagged_at: string;
  severity: 'low' | 'medium' | 'high';
}

export interface HealthTrendPoint {
  date: string;
  online: number;
  offline: number;
  maintenance: number;
}

export interface AlertSummary {
  high: number;
  medium: number;
  low: number;
}

export interface BulkImportResult {
  accepted: number;
  rejected: number;
  errors: Array<{ row: number; field: string; message: string }>;
}

export interface OnboardingEntry {
  id: string;
  camera_id: string;
  status: OnboardingStatus;
  submitted_by: string;
  submitted_at: string;
  reviewed_by?: string;
  reviewed_at?: string;
  rejection_reason?: string;
  validation_errors: Array<{ field: string; message: string }>;
}
