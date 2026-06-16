import type { UserRole } from '../../shared/types.js'
import { USER_IMPORT_DEFAULT_PASSWORD } from '../../shared/types.js'

export type StartupMode = 'first_launch' | 'restart' | 'upgrade' | 'test'

export interface SeedUser {
  username: string
  password: string
  name: string
  role: UserRole
  email?: string
  isDemo: boolean
}

export interface SeedDesign {
  designId: string
  name: string
  description: string
  submitterUsername: string
  priority: 'high' | 'medium' | 'low'
}

export interface RolePermission {
  role: UserRole
  permissions: string[]
}

export const DATABASE_VERSION = 2

export const ROLE_PERMISSIONS: RolePermission[] = [
  {
    role: 'admin',
    permissions: [
      'design:import',
      'design:view_all',
      'design:claim',
      'design:review',
      'design:resubmit',
      'design:comment',
      'design:export',
      'user:manage',
      'user:view',
      'user:import',
      'batch_task:view_list',
      'batch_task:view_detail',
      'batch_task:view_summary',
      'batch_task:create',
      'batch_task:execute',
      'batch_task:delete',
      'batch_task:export_conflicts',
      'admin_log:view',
    ],
  },
  {
    role: 'reviewer',
    permissions: [
      'design:view_all',
      'design:claim',
      'design:review',
      'design:comment',
      'user:view',
      'batch_task:view_list',
      'batch_task:view_summary',
    ],
  },
  {
    role: 'submitter',
    permissions: [
      'design:view_all',
      'design:resubmit',
      'design:comment',
      'user:view',
      'batch_task:view_list',
      'batch_task:view_summary',
    ],
  },
]

export const SEED_USERS: SeedUser[] = [
  {
    username: 'admin',
    password: 'admin123',
    name: '系统管理员',
    role: 'admin',
    isDemo: true,
  },
  {
    username: 'reviewer1',
    password: 'reviewer123',
    name: '张评审',
    role: 'reviewer',
    isDemo: true,
  },
  {
    username: 'reviewer2',
    password: 'reviewer123',
    name: '李评审',
    role: 'reviewer',
    isDemo: true,
  },
  {
    username: 'submitter1',
    password: 'submitter123',
    name: '王设计',
    role: 'submitter',
    isDemo: true,
  },
  {
    username: 'submitter2',
    password: 'submitter123',
    name: '刘设计',
    role: 'submitter',
    isDemo: true,
  },
]

export const SEED_DESIGNS: SeedDesign[] = [
  {
    designId: 'SAMPLE-001',
    name: '示例设计稿 - 首页改版',
    description: '这是一个示例设计稿，用于演示系统功能',
    submitterUsername: 'submitter1',
    priority: 'high',
  },
  {
    designId: 'SAMPLE-002',
    name: '示例设计稿 - 个人中心',
    description: '这是另一个示例设计稿',
    submitterUsername: 'submitter2',
    priority: 'medium',
  },
]

export const DEFAULT_USER_PASSWORD = USER_IMPORT_DEFAULT_PASSWORD

export function getRolePermissions(role: UserRole): string[] {
  const rolePerm = ROLE_PERMISSIONS.find((rp) => rp.role === role)
  return rolePerm?.permissions || []
}

export function hasPermission(role: UserRole, permission: string): boolean {
  return getRolePermissions(role).includes(permission)
}

export function getSeedUserByUsername(username: string): SeedUser | undefined {
  return SEED_USERS.find((u) => u.username === username)
}

export function getSeedUsersByRole(role: UserRole): SeedUser[] {
  return SEED_USERS.filter((u) => u.role === role)
}

export function generateReadmeAccountTable(): string {
  const header = '| 用户名 | 密码 | 角色 | 姓名 |\n|--------|------|------|------|'
  const rows = SEED_USERS.map((u) => {
    const roleLabel: Record<UserRole, string> = {
      admin: '管理员',
      reviewer: '评审人',
      submitter: '提交者',
    }
    return `| \`${u.username}\` | \`${u.password}\` | ${roleLabel[u.role]} | ${u.name} |`
  }).join('\n')
  return `${header}\n${rows}`
}

export function generateEnvExample(): string {
  return `# 数据库配置
DB_PATH=./data/review-board.db

# 服务配置
PORT=3001

# Session 配置
SESSION_SECRET=design-review-board-secret-key-2024

# 启动模式: first_launch | restart | upgrade | test
# 留空则自动检测
STARTUP_MODE=

# 是否加载示例数据
LOAD_SAMPLE_DATA=true
`
}
