export type UserRole = 'submitter' | 'reviewer' | 'admin';

export type DesignStatus = 
  | 'pending_claim'
  | 'reviewing'
  | 'returned'
  | 'pending_review'
  | 'passed';

export const STATUS_LABELS: Record<DesignStatus, string> = {
  pending_claim: '待认领',
  reviewing: '评审中',
  returned: '退回修改',
  pending_review: '待复审',
  passed: '通过',
};

export const STATUS_COLORS: Record<DesignStatus, string> = {
  pending_claim: '#f59e0b',
  reviewing: '#0ea5e9',
  returned: '#ef4444',
  pending_review: '#8b5cf6',
  passed: '#10b981',
};

export interface User {
  id: number;
  username: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export interface Design {
  id: number;
  designId: string;
  name: string;
  description: string;
  submitterId: number;
  submitterName: string;
  reviewerId: number | null;
  reviewerName: string | null;
  status: DesignStatus;
  priority: 'high' | 'medium' | 'low';
  returnReason: string | null;
  queueOrder: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: number;
  designId: number;
  userId: number;
  userName: string;
  userRole: UserRole;
  content: string;
  isReturnReason: boolean;
  createdAt: string;
}

export interface OperationLog {
  id: number;
  designId: number;
  userId: number;
  userName: string;
  action: string;
  oldStatus: DesignStatus | null;
  newStatus: DesignStatus | null;
  details: string | null;
  createdAt: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface ImportDesignItem {
  designId: string;
  name: string;
  description: string;
  submitter: string;
  priority?: 'high' | 'medium' | 'low';
}

export interface ReviewRequest {
  action: 'pass' | 'return';
  reason?: string;
  comment?: string;
}

export interface ExportFilter {
  status?: DesignStatus;
  submitterId?: number;
  reviewerId?: number;
  startDate?: string;
  endDate?: string;
}

export interface ImportConflict {
  designId: string;
  name: string;
  existingCreatedAt: string;
  commentCount: number;
  message: string;
}

export interface ImportResult {
  imported: number;
  conflicts: ImportConflict[];
}

export interface ApiResponse<T = null> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ClaimConflictData {
  currentReviewer: string;
  claimTime: string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  submitter: '提交者',
  reviewer: '评审人',
  admin: '管理员',
};

export const PRIORITY_LABELS: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
};
