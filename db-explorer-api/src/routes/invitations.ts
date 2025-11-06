// Invitation routes with authentication

import express from 'express';
import { ConnectionController } from '../controllers/ConnectionController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const connectionController = new ConnectionController();

// All routes require authentication
router.use(authenticateToken);

// User invitation routes
router.get('/', connectionController.getMyInvitations.bind(connectionController));
router.post('/:id/accept', connectionController.acceptInvitation.bind(connectionController));
router.post('/:id/decline', connectionController.declineInvitation.bind(connectionController));
router.delete('/:id', connectionController.cancelInvitation.bind(connectionController));

export default router;
