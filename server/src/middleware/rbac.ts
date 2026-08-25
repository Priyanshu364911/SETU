import { Request, Response, NextFunction } from 'express';
import { TokenPayload, Role, Resource, Action } from '../types';

export { Resource, Action };

interface RBACDecision {
  allowed: boolean;
  scopedTo?: string;
}

// RBAC Matrix based on design document
export function rbacGuard(
  role: Role,
  resource: Resource,
  action: Action,
  ownDeptId: string | null = null,
): RBACDecision {
  switch (role) {
    case 'state_nodal_officer':
      // SNO has full access to everything
      return { allowed: true };

    case 'auditor':
      // Auditor can only read, no write operations
      if (action === 'READ') {
        return { allowed: true };
      }
      return { allowed: false };

    case 'department_officer':
      // DO can read, write, and approve within their own department
      if (['READ', 'WRITE', 'APPROVE'].includes(action)) {
        if (ownDeptId === null || ownDeptId === undefined) {
          return { allowed: false };
        }
        return { allowed: true, scopedTo: ownDeptId };
      }
      return { allowed: false };

    case 'field_officer':
      // FO can only write (submit) cameras and read within their department
      // FO can also read audit_log, but only their own entries (enforced at route level)
      if (resource === 'cameras' && action === 'WRITE') {
        if (ownDeptId === null || ownDeptId === undefined) {
          return { allowed: false };
        }
        return { allowed: true, scopedTo: ownDeptId };
      }
      if (action === 'READ' && resource === 'audit_log') {
        return { allowed: true };
      }
      if (action === 'READ' && ownDeptId !== null && ownDeptId !== undefined) {
        return { allowed: true, scopedTo: ownDeptId };
      }
      return { allowed: false };

    default:
      return { allowed: false };
  }
}

export function requirePermission(resource: Resource, action: Action) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: No user context' });
    }

    const decision = rbacGuard(req.user.role, resource, action, req.user.departmentId);

    if (!decision.allowed) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }

    // Attach scoping information to the request
    req.user.scopedTo = decision.scopedTo;
    next();
  };
}

export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: No user context' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Role not allowed' });
    }

    next();
  };
}
