import type { UserRole } from '../../shared/types.js'

declare module 'express-session' {
  interface SessionData {
    user?: {
      id: number
      username: string
      name: string
      role: UserRole
    }
  }
}

declare global {
  namespace Express {
    interface Request {
      session: import('express-session').Session & {
        user?: {
          id: number
          username: string
          name: string
          role: UserRole
        }
      }
    }
  }
}

export {}
