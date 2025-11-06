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

// Invitation routes for connections
router.post('/:id/invite', connectionController.inviteMember.bind(connectionController));
router.get(
  '/:id/invitations',
  connectionController.getConnectionInvitations.bind(connectionController)
);

export default router;
