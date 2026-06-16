import bcrypt from 'bcryptjs'
import * as userRepository from '../repositories/userRepository.js'
import type { User, UserRole } from '../../shared/types.js'

export class BusinessError extends Error {
  code: string
  statusCode: number

  constructor(message: string, code: string, statusCode: number = 400) {
    super(message)
    this.name = 'BusinessError'
    this.code = code
    this.statusCode = statusCode
  }
}

export function getUsers(): User[] {
  return userRepository.findAll()
}

export function createUser(
  username: string,
  password: string,
  name: string,
  role: UserRole
): { success: boolean; error?: string; user?: User } {
  if (!username || !password || !name || !role) {
    throw new BusinessError('用户名、密码、姓名和角色不能为空', 'MISSING_FIELDS')
  }

  const existing = userRepository.findByUsername(username)
  if (existing) {
    throw new BusinessError('用户名已存在', 'USERNAME_EXISTS')
  }

  const passwordHash = bcrypt.hashSync(password, 10)
  const id = userRepository.create(username, passwordHash, name, role)
  const user = userRepository.findById(id)

  if (!user) {
    throw new BusinessError('创建用户失败', 'CREATE_FAILED', 500)
  }

  return { success: true, user }
}

export function updateUser(
  id: number,
  data: { name?: string; role?: UserRole; password?: string }
): { success: boolean; error?: string } {
  const existing = userRepository.findById(id)
  if (!existing) {
    throw new BusinessError('用户不存在', 'USER_NOT_FOUND', 404)
  }

  const updateData: Partial<{ name: string; role: string; password_hash: string }> = {}

  if (data.name !== undefined) {
    updateData.name = data.name
  }
  if (data.role !== undefined) {
    updateData.role = data.role
  }
  if (data.password !== undefined) {
    updateData.password_hash = bcrypt.hashSync(data.password, 10)
  }

  if (Object.keys(updateData).length === 0) {
    throw new BusinessError('没有需要更新的字段', 'NO_FIELDS_TO_UPDATE')
  }

  const success = userRepository.update(id, updateData)
  if (!success) {
    throw new BusinessError('更新用户失败', 'UPDATE_FAILED', 500)
  }

  return { success: true }
}

export function deleteUser(id: number): { success: boolean; error?: string } {
  const existing = userRepository.findById(id)
  if (!existing) {
    throw new BusinessError('用户不存在', 'USER_NOT_FOUND', 404)
  }

  const success = userRepository.deleteUser(id)
  if (!success) {
    throw new BusinessError('删除用户失败', 'DELETE_FAILED', 500)
  }

  return { success: true }
}

export function login(
  username: string,
  password: string
): { success: boolean; user?: User; error?: string } {
  if (!username || !password) {
    throw new BusinessError('用户名和密码不能为空', 'MISSING_CREDENTIALS')
  }

  const userWithPassword = userRepository.findByUsername(username)
  if (!userWithPassword) {
    throw new BusinessError('用户名或密码错误', 'INVALID_CREDENTIALS', 401)
  }

  const isPasswordValid = bcrypt.compareSync(password, userWithPassword.password_hash)
  if (!isPasswordValid) {
    throw new BusinessError('用户名或密码错误', 'INVALID_CREDENTIALS', 401)
  }

  const user: User = {
    id: userWithPassword.id,
    username: userWithPassword.username,
    name: userWithPassword.name,
    role: userWithPassword.role,
    createdAt: userWithPassword.createdAt,
  }

  return { success: true, user }
}
