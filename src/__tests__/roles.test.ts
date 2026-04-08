import { describe, it, expect, vi } from 'vitest';
import { 
  isSystemAdmin, 
  isSuperAdmin, 
  isAtLeastClientAdmin, 
  canCreateProject, 
  canCreateProgramme 
} from '../lib/roles';

describe('Role-Based Access Control', () => {
    const ADMIN_EMAIL = 'admin@cedarguard.co.uk';
    const REGULAR_USER = 'user@example.com';

    describe('isSystemAdmin', () => {
        it('should return true for known admin emails', () => {
            expect(isSystemAdmin(ADMIN_EMAIL)).toBe(true);
            expect(isSystemAdmin('ali@cedarguard.co.uk')).toBe(true);
        });

        it('should return false for regular users', () => {
            expect(isSystemAdmin(REGULAR_USER)).toBe(false);
            expect(isSystemAdmin('')).toBe(false);
        });
    });

    describe('isSuperAdmin', () => {
        it('should return true if role is admin', () => {
            expect(isSuperAdmin(REGULAR_USER, 'admin')).toBe(true);
        });

        it('should return true if email is system admin', () => {
            expect(isSuperAdmin(ADMIN_EMAIL, 'user')).toBe(true);
        });

        it('should return false if neither', () => {
            expect(isSuperAdmin(REGULAR_USER, 'user')).toBe(false);
        });
    });

    describe('isAtLeastClientAdmin', () => {
        it('should return true for admin and client_admin', () => {
            expect(isAtLeastClientAdmin('admin')).toBe(true);
            expect(isAtLeastClientAdmin('client_admin')).toBe(true);
        });

        it('should return false for lower roles', () => {
            expect(isAtLeastClientAdmin('project_manager')).toBe(false);
        });
    });

    describe('canCreateProject', () => {
        it('should allow admin, project managers, and organizational admins', () => {
            expect(canCreateProject('admin')).toBe(true);
            expect(canCreateProject('client_admin')).toBe(true);
            expect(canCreateProject('project_manager')).toBe(true);
            expect(canCreateProject('senior_pm')).toBe(true);
        });

        it('should not allow viewers', () => {
            expect(canCreateProject('viewer')).toBe(false);
        });
    });

    describe('canCreateProgramme', () => {
        it('should allow admin and client_admin', () => {
            expect(canCreateProgramme('admin')).toBe(true);
            expect(canCreateProgramme('client_admin')).toBe(true);
        });

        it('should not allow project managers', () => {
            expect(canCreateProgramme('project_manager')).toBe(false);
        });
    });
});
