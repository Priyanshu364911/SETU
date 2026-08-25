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

export type Resource = 'cameras' | 'users' | 'audit_log' | 'departments' | 'onboarding';

export type Action = 'READ' | 'WRITE' | 'APPROVE' | 'MANAGE';

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
  onboarded_at: Date;
  last_verified_at: Date | null;
  notes?: string;
  created_at: Date;
  updated_at: Date;
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
  created_at: Date;
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
  password_hash: string;
  role: Role;
  department_id: string | null;
  is_active: boolean;
  created_at: Date;
  last_login_at: Date | null;
}

export interface AuditLog {
  id: string;
  action: AuditAction;
  actor_id: string;
  actor_role: Role;
  target_id: string | null;
  target_type: 'camera' | 'user' | null;
  before_state: object | null;
  after_state: object | null;
  metadata: object | null;
  ip_address: string | null;
  created_at: Date;
}

// Auth & RBAC
export interface TokenPayload {
  userId: string;
  username: string;
  role: Role;
  departmentId: string | null;
  exp: number;
  scopedTo?: string;
}

export interface AuthResult {
  token: string;
  user: UserProfile;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  role: Role;
  department_id: string | null;
}

// Filters & Pagination
export interface CameraFilters {
  departmentId?: string;
  districtId?: string;
  status?: CameraStatus[];
  cameraType?: CameraType[];
  connectivity?: ConnectivityType[];
  search?: string;
  onboardedAfter?: Date;
  onboardedBefore?: Date;
}

export interface Pagination {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

// Validation
export interface FieldError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: FieldError[];
}

// Onboarding
export interface OnboardingEntry {
  id: string;
  camera_id: string;
  status: OnboardingStatus;
  submitted_by: string;
  submitted_at: Date;
  reviewed_by?: string;
  reviewed_at?: Date;
  rejection_reason?: string;
  validation_errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface BulkImportResult {
  accepted: number;
  rejected: number;
  errors: Array<{ row: number; field: string; message: string }>;
}

// Gap Analysis
export interface GapZone {
  district_id: string;
  district_name: string;
  camera_count: number;
  avg_per_district: number;
  deficit: number;
  coordinates: [number, number]; // [lat, lng]
}

export interface DistrictRanking {
  district_id: string;
  district_name: string;
  camera_count: number;
  online_rate: number;
  rank: number;
  below_average: boolean;
}

// Health Monitor
export interface FlaggedCamera {
  camera: Camera;
  flag_reason: 'Offline' | 'Maintenance' | 'Not_Verified_90d' | 'Retention_Expiring';
  flagged_at: Date;
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

export interface CameraStats {
  total: number;
  online: number;
  offline: number;
  maintenance: number;
  pending: number;
}

// GeoJSON
export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

export interface GeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat] per RFC 7946
  };
  properties: {
    id: string;
    status: CameraStatus;
    departmentId: string;
    cameraType: CameraType;
  };
}
