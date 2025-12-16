import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { toolPermissionController } from '../controllers/ToolPermissionController';

const router = Router();

router.use(authenticate);

router.get('/registry', toolPermissionController.getToolRegistry);

router.get('/connections/:connectionId', toolPermissionController.getUserPermissions);

router.post('/', toolPermissionController.createPermission);

router.put('/:id', toolPermissionController.updatePermission);

router.delete('/:id', toolPermissionController.deletePermission);

router.post('/bulk-update', toolPermissionController.bulkUpdatePermissions);

router.post('/check', toolPermissionController.checkPermission);

router.get('/connections/:connectionId/pending', toolPermissionController.getPendingRequests);

router.post('/requests/:id/respond', toolPermissionController.respondToRequest);

router.get('/connections/:connectionId/audit', toolPermissionController.getAuditLogs);

router.post('/connections/:connectionId/initialize', toolPermissionController.initializeDefaultPermissions);

export default router;
