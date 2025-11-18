// Job and Notification routes with authentication

import express from 'express';
import { SchemaTrainingController } from '../controllers/SchemaTrainingController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const schemaTrainingController = new SchemaTrainingController();

// All routes require authentication
router.use(authenticateToken);

// Job routes
router.get('/', schemaTrainingController.getUserJobs.bind(schemaTrainingController));
router.get('/:jobId', schemaTrainingController.getJobStatus.bind(schemaTrainingController));

// Notification SSE endpoint
router.get('/notifications/stream', schemaTrainingController.streamNotifications.bind(schemaTrainingController));

export default router;
