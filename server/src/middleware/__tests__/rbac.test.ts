import { rbacGuard } from '../rbac';
import { Role, Resource, Action } from '../../types';

describe('RBAC Guard Property Tests', () => {
  // Property 1: If RBAC matrix permits (role, resource, action), then request is allowed
  describe('Property 1: Permitted actions are allowed', () => {
    const allRoles: Role[] = ['state_nodal_officer', 'department_officer', 'field_officer', 'auditor'];
    const allResources: Resource[] = ['cameras', 'onboarding', 'audit_log', 'departments', 'users'];
    const allActions: Action[] = ['READ', 'WRITE', 'APPROVE', 'MANAGE'];

    test.each(allRoles)('Role %s has expected permissions', (role) => {
      allResources.forEach((resource) => {
        allActions.forEach((action) => {
          const decision = rbacGuard(role, resource, action, 'DEPT-001');
          
          // Check if this combination should be allowed based on the RBAC matrix
          const shouldBeAllowed = shouldAllow(role, resource, action);
          
          if (shouldBeAllowed) {
            expect(decision.allowed).toBe(true);
          }
        });
      });
    });

    // Specific test cases for known allowed combinations
    test('State Nodal Officer can MANAGE users', () => {
      const decision = rbacGuard('state_nodal_officer', 'users', 'MANAGE');
      expect(decision.allowed).toBe(true);
    });

    test('State Nodal Officer can WRITE cameras', () => {
      const decision = rbacGuard('state_nodal_officer', 'cameras', 'WRITE');
      expect(decision.allowed).toBe(true);
    });

    test('Department Officer can READ cameras', () => {
      const decision = rbacGuard('department_officer', 'cameras', 'READ', 'DEPT-001');
      expect(decision.allowed).toBe(true);
    });

    test('Department Officer can APPROVE onboarding', () => {
      const decision = rbacGuard('department_officer', 'onboarding', 'APPROVE', 'DEPT-001');
      expect(decision.allowed).toBe(true);
    });

    test('Field Officer can READ cameras', () => {
      const decision = rbacGuard('field_officer', 'cameras', 'READ', 'DEPT-001');
      expect(decision.allowed).toBe(true);
    });

    test('Auditor can READ audit_log', () => {
      const decision = rbacGuard('auditor', 'audit_log', 'READ');
      expect(decision.allowed).toBe(true);
    });
  });

  // Property 2: If RBAC matrix does not permit (role, resource, action), then request is denied
  describe('Property 2: Non-permitted actions are denied', () => {
    const allRoles: Role[] = ['state_nodal_officer', 'department_officer', 'field_officer', 'auditor'];
    const allResources: Resource[] = ['cameras', 'onboarding', 'audit_log', 'departments', 'users'];
    const allActions: Action[] = ['READ', 'WRITE', 'APPROVE', 'MANAGE'];

    test.each(allRoles)('Role %s is denied for non-permitted actions', (role) => {
      allResources.forEach((resource) => {
        allActions.forEach((action) => {
          const decision = rbacGuard(role, resource, action, 'DEPT-001');
          
          // Check if this combination should be denied based on the RBAC matrix
          const shouldBeDenied = !shouldAllow(role, resource, action);
          
          if (shouldBeDenied) {
            expect(decision.allowed).toBe(false);
          }
        });
      });
    });

    // Specific test cases for known denied combinations
    test('Field Officer can WRITE cameras (scoped to own department)', () => {
      const decision = rbacGuard('field_officer', 'cameras', 'WRITE', 'DEPT-001');
      expect(decision.allowed).toBe(true);
      expect(decision.scopedTo).toBe('DEPT-001');
    });

    test('Field Officer cannot WRITE cameras without a department', () => {
      const decision = rbacGuard('field_officer', 'cameras', 'WRITE', null);
      expect(decision.allowed).toBe(false);
    });

    test('Field Officer cannot MANAGE users', () => {
      const decision = rbacGuard('field_officer', 'users', 'MANAGE', 'DEPT-001');
      expect(decision.allowed).toBe(false);
    });

    test('Department Officer cannot MANAGE users', () => {
      const decision = rbacGuard('department_officer', 'users', 'MANAGE', 'DEPT-001');
      expect(decision.allowed).toBe(false);
    });

    test('Auditor cannot WRITE cameras', () => {
      const decision = rbacGuard('auditor', 'cameras', 'WRITE');
      expect(decision.allowed).toBe(false);
    });

    test('Auditor cannot APPROVE onboarding', () => {
      const decision = rbacGuard('auditor', 'onboarding', 'APPROVE');
      expect(decision.allowed).toBe(false);
    });
  });

  // Additional property: Scoping is applied correctly
  describe('Property: Scoping is applied correctly', () => {
    test('Department Officer is scoped to their department', () => {
      const decision = rbacGuard('department_officer', 'cameras', 'READ', 'DEPT-001');
      expect(decision.allowed).toBe(true);
      expect(decision.scopedTo).toBe('DEPT-001');
    });

    test('Field Officer is scoped to their department', () => {
      const decision = rbacGuard('field_officer', 'cameras', 'READ', 'DEPT-001');
      expect(decision.allowed).toBe(true);
      expect(decision.scopedTo).toBe('DEPT-001');
    });

    test('State Nodal Officer is not scoped', () => {
      const decision = rbacGuard('state_nodal_officer', 'cameras', 'READ');
      expect(decision.allowed).toBe(true);
      expect(decision.scopedTo).toBeUndefined();
    });

    test('Auditor is not scoped', () => {
      const decision = rbacGuard('auditor', 'audit_log', 'READ');
      expect(decision.allowed).toBe(true);
      expect(decision.scopedTo).toBeUndefined();
    });
  });
});

// Helper function to determine if a combination should be allowed based on the RBAC matrix
function shouldAllow(role: Role, resource: Resource, action: Action): boolean {
  // State Nodal Officer: All permissions on all resources
  if (role === 'state_nodal_officer') {
    return true;
  }

  // Department Officer: READ/WRITE/APPROVE on cameras, onboarding; READ on departments
  if (role === 'department_officer') {
    if (resource === 'cameras' || resource === 'onboarding') {
      return action === 'READ' || action === 'WRITE' || action === 'APPROVE';
    }
    if (resource === 'departments') {
      return action === 'READ';
    }
    return false;
  }

  // Field Officer: READ on cameras; WRITE on cameras (for submission)
  if (role === 'field_officer') {
    if (resource === 'cameras') {
      return action === 'READ' || action === 'WRITE';
    }
    return false;
  }

  // Auditor: READ on audit_log, cameras, departments
  if (role === 'auditor') {
    if (resource === 'audit_log' || resource === 'cameras' || resource === 'departments') {
      return action === 'READ';
    }
    return false;
  }

  return false;
}
