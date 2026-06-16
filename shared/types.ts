export type UserRole = 'submitter' | 'reviewer' | 'admin';
export type DraftType = 'users' | 'designs';
export type PrecheckErrorType =
  | 'MISSING_REQUIRED_COLUMN'
  | 'UNKNOWN_HEADER'
  | 'EMPTY_REQUIRED_FIELD'
  | 'DUPLICATE_EMAIL'
  | 'DUPLICATE_NAME'
  | 'DUPLICATE_USERNAME'
  | 'INVALID_ROLE'
  | 'INVALID_EMAIL'
  | 'USERNAME_EXISTS'
  | 'EMAIL_EXISTS'
  | 'NAME_EXISTS'
  | 'WEAK_PASSWORD'
  | 'ROW_INTERNAL_DUP_EMAIL'
  | 'ROW_INTERNAL_DUP_USERNAME'
  | 'ROW_INTERNAL_DUP_NAME';

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
  email: string | null;
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

export interface UserImportFieldDef {
  key: 'username' | 'name' | 'email' | 'role' | 'password';
  label: string;
  required: boolean;
  description: string;
}

export const USER_IMPORT_FIELDS: UserImportFieldDef[] = [
  { key: 'username', label: '用户名', required: true, description: '登录用户名，全局唯一' },
  { key: 'name', label: '姓名', required: true, description: '真实姓名，系统内唯一' },
  { key: 'email', label: '邮箱', required: false, description: '电子邮箱，若提供需唯一且有效' },
  { key: 'role', label: '角色', required: true, description: 'admin / reviewer / submitter' },
  { key: 'password', label: '密码', required: false, description: '登录密码，若为空将使用默认密码' },
];

export const USER_IMPORT_DEFAULT_PASSWORD = 'user123456';

export type FieldMapping = Record<string, string>;

export interface PrecheckRowError {
  lineNumber: number;
  rowData: Record<string, string>;
  errors: {
    type: PrecheckErrorType;
    field?: string;
    value?: string;
    message: string;
  }[];
}

export interface PrecheckHeaderIssue {
  type: PrecheckErrorType;
  header?: string;
  expected?: string[];
  message: string;
}

export interface UserImportPrecheckResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  headerIssues: PrecheckHeaderIssue[];
  rowErrors: PrecheckRowError[];
  fieldMapping: FieldMapping;
  detectedHeaders: string[];
  fileSummary: {
    fileName: string;
    fileSize: number;
    totalDataLines: number;
  };
  parsedRows: Array<{
    lineNumber: number;
    username: string;
    name: string;
    email: string;
    role: string;
    password: string;
    rawRow: Record<string, string>;
  }>;
}

export interface UserImportSubmitRequest {
  fieldMapping: FieldMapping;
  applyDefaultPassword?: boolean;
}

export interface UserImportResult {
  imported: number;
  skipped: number;
  skippedReasons: Array<{
    lineNumber: number;
    username: string;
    name: string;
    reasons: string[];
  }>;
  createdUserIds: number[];
  defaultPasswordUsed: boolean;
}

export interface ImportDraft {
  id: number;
  userId: number;
  draftType: DraftType;
  fileName: string;
  fileSize: number;
  fieldMapping: FieldMapping;
  precheckResult: UserImportPrecheckResult;
  rawCsvContent: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminOperationLog {
  id: number;
  operatorId: number;
  operatorName: string;
  operationType: string;
  targetType: string;
  targetId: string | null;
  summary: string;
  details: string | null;
  createdAt: string;
}

export const ADMIN_OPERATION_TYPES = {
  USER_IMPORT: 'user_import',
  USER_CREATE: 'user_create',
  USER_UPDATE: 'user_update',
  USER_DELETE: 'user_delete',
  DESIGN_IMPORT: 'design_import',
} as const;

export interface UserImportDraftPayload {
  precheckResult: UserImportPrecheckResult;
  fieldMapping: FieldMapping;
  fileName: string;
  fileSize: number;
  rawCsvContent: string;
}

export type BatchTaskStatus = 'draft' | 'pending_review' | 'executing' | 'completed' | 'failed' | 'cancelled';
export type BatchTaskItemType = 'new' | 'role_change' | 'disable' | 'duplicate_account' | 'name_conflict' | 'valid';
export type BatchTaskItemStatus = 'pending' | 'ignored' | 'executing' | 'success' | 'failed' | 'skipped';

export const BATCH_TASK_STATUS_LABELS: Record<BatchTaskStatus, string> = {
  draft: '草稿',
  pending_review: '待执行',
  executing: '执行中',
  completed: '已完成',
  failed: '执行失败',
  cancelled: '已取消',
};

export const BATCH_TASK_ITEM_TYPE_LABELS: Record<BatchTaskItemType, string> = {
  new: '新增成员',
  role_change: '角色变更',
  disable: '停用成员',
  duplicate_account: '重复账号',
  name_conflict: '同名冲突',
  valid: '有效记录',
};

export const BATCH_TASK_ITEM_STATUS_LABELS: Record<BatchTaskItemStatus, string> = {
  pending: '待处理',
  ignored: '已忽略',
  executing: '执行中',
  success: '成功',
  failed: '失败',
  skipped: '已跳过',
};

export interface BatchTask {
  id: number;
  taskName: string;
  createdBy: number;
  createdByName: string;
  status: BatchTaskStatus;
  fileName: string;
  fileSize: number;
  fieldMapping: FieldMapping;
  totalCount: number;
  newCount: number;
  roleChangeCount: number;
  disableCount: number;
  duplicateCount: number;
  nameConflictCount: number;
  rawCsvContent: string;
  executedAt: string | null;
  executedBy: number | null;
  executedByName: string | null;
  resultSummary: BatchTaskResultSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface BatchTaskItem {
  id: number;
  taskId: number;
  itemType: BatchTaskItemType;
  lineNumber: number;
  username: string;
  name: string;
  email: string | null;
  role: string | null;
  oldRole: string | null;
  password: string | null;
  status: BatchTaskItemStatus;
  skipReason: string | null;
  errorMessage: string | null;
  userId: number | null;
  rowData: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface BatchTaskResultSummary {
  successCount: number;
  failedCount: number;
  skippedCount: number;
  ignoredCount: number;
  newSuccess: number;
  roleChangeSuccess: number;
  disableSuccess: number;
  failedItems: Array<{
    id: number;
    username: string;
    name: string;
    error: string;
  }>;
  skippedItems: Array<{
    id: number;
    username: string;
    name: string;
    reason: string;
  }>;
}

export interface CreateBatchTaskRequest {
  taskName: string;
  rawCsv: string;
  fileName: string;
  fileSize: number;
  fieldMapping: FieldMapping;
}

export interface BatchTaskDetail {
  task: BatchTask;
  items: BatchTaskItem[];
}

export interface UpdateBatchTaskItemRequest {
  status?: BatchTaskItemStatus;
  skipReason?: string;
}

export interface BatchTaskSummary {
  id: number;
  taskName: string;
  status: BatchTaskStatus;
  totalCount: number;
  createdAt: string;
  createdByName: string;
}
