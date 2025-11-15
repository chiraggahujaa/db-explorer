// Connection routes with authentication

import express from 'express';
import { ConnectionController } from '../controllers/ConnectionController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const connectionController = new ConnectionController();

// All routes require authentication
router.use(authenticateToken);

// Connection CRUD routes
router.get('/', connectionController.getMyConnections.bind(connectionController));
router.get('/:id/credentials', connectionController.getConnectionCredentials.bind(connectionController)); // Must come before /:id
router.get('/:id', connectionController.getConnection.bind(connectionController));
router.post('/', connectionController.createConnection.bind(connectionController));
router.patch('/:id', connectionController.updateConnection.bind(connectionController));
router.delete('/:id', connectionController.deleteConnection.bind(connectionController));

// Connection members routes
router.get('/:id/members', connectionController.getConnectionMembers.bind(connectionController));
router.patch(
  '/:id/members/:memberId',
  connectionController.updateMemberRole.bind(connectionController)
);
router.delete(
  '/:id/members/:memberId',
  connectionController.removeMember.bind(connectionController)
);
router.post('/:id/leave', connectionController.leaveConnection.bind(connectionController));

// Invitation routes for connections
router.post('/:id/invite', connectionController.inviteMember.bind(connectionController));
router.get(
  '/:id/invitations',
  connectionController.getConnectionInvitations.bind(connectionController)
);
router.post(
  '/:id/invitations/:invitationId/send-email',
  connectionController.sendInvitationEmail.bind(connectionController)
);

// Database explorer routes
router.get('/:id/schemas', connectionController.getSchemas.bind(connectionController));
router.get('/:id/tables', connectionController.getTables.bind(connectionController));

export default router;
