import { describe, it, expect, vi } from 'vitest';
import { isAuthorizedForContextImpl } from '../lib/context.js';

describe('ApiContext.isAuthorizedForContext', () => {
    
    it('should return true if user is admin', async () => {
        const mockDb = {} as any;
        const result = await isAuthorizedForContextImpl('any-id', mockDb, 'uid123', 'admin@example.com', { role: 'admin' }, 'uid123', true);
        expect(result).toBe(true);
    });

    it('should return false if contextId is empty string', async () => {
        const mockDb = {} as any;
        const result = await isAuthorizedForContextImpl('', mockDb, 'uid123', 'pm@example.com', { role: 'project_manager' }, 'client123', false);
        expect(result).toBe(false);
    });

    it('should return true if client admin accesses project in their organization', async () => {
        const mockDb = {
            collection: vi.fn((col) => ({
                doc: vi.fn((id) => ({
                    get: vi.fn().mockResolvedValue({
                        exists: col === 'projects' && id === 'proj123',
                        data: () => ({ clientId: 'client_uid' })
                    })
                }))
            }))
        } as any;

        const result = await isAuthorizedForContextImpl('proj123', mockDb, 'client_uid', 'client@example.com', { role: 'client_admin' }, 'client_uid', false);
        expect(result).toBe(true);
    });

    it('should return false if PM accesses project they are not assigned to', async () => {
        const mockDb = {
            collection: vi.fn((col) => ({
                doc: vi.fn((id) => ({
                    get: vi.fn().mockResolvedValue({
                        exists: col === 'projects' && id === 'proj123',
                        data: () => ({ clientId: 'client_uid', userId: 'pm_other', pm: 'pm_other@example.com' })
                    })
                }))
            }))
        } as any;

        const result = await isAuthorizedForContextImpl('proj123', mockDb, 'pm123', 'pm123@example.com', { role: 'project_manager' }, 'client_uid', false);
        expect(result).toBe(false);
    });
});

