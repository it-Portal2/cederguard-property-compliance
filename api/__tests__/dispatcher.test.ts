import { describe, it, expect, vi } from 'vitest';
import { allRoutes } from '../index.js'; // Use relative import to test the exported router
import { ApiContext } from '../lib/context.js';

describe('API Dispatcher Configuration', () => {
    it('should export allRoutes object', () => {
        expect(allRoutes).toBeDefined();
        expect(typeof allRoutes).toBe('object');
    });

    it('should map core data actions', () => {
        expect(allRoutes['clientGetProjectData']).toBeDefined();
        expect(allRoutes['createProject']).toBeDefined();
        expect(allRoutes['updateProject']).toBeDefined();
    });

    it('should map admin actions', () => {
        expect(allRoutes['adminStats']).toBeDefined();
        expect(allRoutes['adminGetUsers']).toBeDefined();
        expect(allRoutes['adminDeleteProject']).toBeDefined();
    });

    it('should map team actions', () => {
        expect(allRoutes['inviteProjectManager']).toBeDefined();
        expect(allRoutes['clientGetTeam']).toBeDefined();
    });

    it('should map auth actions', () => {
        expect(allRoutes['generateApiKey']).toBeDefined();
        expect(allRoutes['deleteUserAccount']).toBeDefined();
    });

    it('should map compliance actions', () => {
        expect(allRoutes['getComplianceLibrary']).toBeDefined();
        expect(allRoutes['getComplianceDomains']).toBeDefined();
    });

    it('should map AI advisor actions', () => {
        expect(allRoutes['analyzeCompliance']).toBeDefined();
        expect(allRoutes['chatWithAI']).toBeDefined();
    });

    it('should map notification actions', () => {
        expect(allRoutes['registerDeviceToken']).toBeDefined();
        expect(allRoutes['sendPushNotification']).toBeDefined();
    });
});
