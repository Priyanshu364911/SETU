import { z } from 'zod';

// Enums
export const RoleSchema = z.enum(['state_nodal_officer', 'department_officer', 'field_officer', 'auditor']);
export const CameraStatusSchema = z.enum(['Online', 'Maintenance', 'Offline', 'Pending']);
export const OnboardingStatusSchema = z.enum(['Pending', 'Validation', 'Approved', 'Rejected']);
export const CameraTypeSchema = z.enum(['IP', 'Analog', 'PTZ', 'ANPR']);
export const ConnectivityTypeSchema = z.enum(['Fiber', '4G', 'Microwave', 'Other']);
export const StorageTypeSchema = z.enum(['Local NVR', 'Cloud', 'Hybrid']);
export const OwnershipTypeSchema = z.enum(['Govt', 'Private']);
export const OnboardingMethodSchema = z.enum(['Manual', 'Bulk CSV', 'API']);

// Camera ID validation: GJ-DEPTCODE-NNNNNN
const CameraIdSchema = z.string().regex(/^GJ-[A-Z]{2,6}-\d{6}$/, {
  message: 'Camera ID must match format GJ-DEPTCODE-NNNNNN (e.g., GJ-POL-000042)',
});

// Gujarat coordinate bounds
const GujaratLatSchema = z.number().min(20.1).max(24.7, {
  message: 'Latitude must be within Gujarat bounds [20.1, 24.7]',
});
const GujaratLngSchema = z.number().min(68.2).max(74.5, {
  message: 'Longitude must be within Gujarat bounds [68.2, 74.5]',
});

// Camera Input Schema
export const CameraInputSchema = z.object({
  id: CameraIdSchema.optional(),
  name: z.string().min(1).max(200, {
    message: 'Name must be between 1 and 200 characters',
  }),
  department_id: z.string().min(1, {
    message: 'Department ID is required',
  }),
  district_id: z.string().min(1, {
    message: 'District ID is required',
  }),
  latitude: GujaratLatSchema,
  longitude: GujaratLngSchema,
  camera_type: CameraTypeSchema,
  connectivity: ConnectivityTypeSchema,
  storage_type: StorageTypeSchema,
  retention_days: z.number().int().min(1).max(365, {
    message: 'Retention days must be between 1 and 365',
  }),
  ownership: OwnershipTypeSchema,
  notes: z.string().optional(),
});

// User Schema
export const UserCreateSchema = z.object({
  username: z.string().min(3).max(60),
  email: z.string().email(),
  password: z.string().min(8),
  role: RoleSchema,
  department_id: z.string().nullable(),
});

export const UserUpdateSchema = z.object({
  role: RoleSchema.optional(),
  department_id: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
});

// Login Schema
export const LoginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

// Pagination Schema
export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(500).default(50),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

// Filter Schemas
export const CameraFiltersSchema = z.object({
  departmentId: z.string().optional(),
  districtId: z.string().optional(),
  status: z.array(CameraStatusSchema).optional(),
  cameraType: z.array(CameraTypeSchema).optional(),
  connectivity: z.array(ConnectivityTypeSchema).optional(),
  search: z.string().optional(),
  onboardedAfter: z.string().datetime().optional(),
  onboardedBefore: z.string().datetime().optional(),
});

// Onboarding Approval/Rejection Schema
export const OnboardingActionSchema = z.object({
  reason: z.string().optional(),
});

// Gap Analysis Schema
export const GapAnalysisThresholdSchema = z.object({
  threshold: z.number().gt(0).lt(1),
});

// Export types from schemas
export type CameraInput = z.infer<typeof CameraInputSchema>;
export type UserCreate = z.infer<typeof UserCreateSchema>;
export type UserUpdate = z.infer<typeof UserUpdateSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type Pagination = z.infer<typeof PaginationSchema>;
export type CameraFilters = z.infer<typeof CameraFiltersSchema>;
