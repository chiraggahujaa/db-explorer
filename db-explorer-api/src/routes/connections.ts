// Connection routes with authentication

import express from 'express';
import { ConnectionController } from '../controllers/ConnectionController.js';
import { SchemaTrainingController } from '../controllers/SchemaTrainingController.js';
import { ChatSessionController } from '../controllers/ChatSessionController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const connectionController = new ConnectionController();
const schemaTrainingController = new SchemaTrainingController();
const chatSessionController = new ChatSessionController();

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
router.get('/:id/schemas/:schemaName/tables/:tableName', connectionController.getTableSchema.bind(connectionController));
router.post('/:id/query', connectionController.executeStructuredQuery.bind(connectionController));
router.post('/:id/execute', connectionController.executeSql.bind(connectionController));

// Schema training routes
router.post('/:id/train-schema', schemaTrainingController.trainSchema.bind(schemaTrainingController));
router.get('/:id/schema-cache', schemaTrainingController.getSchemaCache.bind(schemaTrainingController));
router.delete('/:id/schema-cache', schemaTrainingController.deleteSchemaCache.bind(schemaTrainingController));

// Chat sessions for a connection
router.get('/:connectionId/chat-sessions', chatSessionController.getChatSessionsByConnection.bind(chatSessionController));

export default router;
