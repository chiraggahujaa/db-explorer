/**
 * Job Routes
 *
 * API routes for job management
 */

import { Router } from 'express';
import { JobController } from '../controllers/JobController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// All job routes require authentication
router.use(authenticateToken);

/**
 * @route   POST /api/jobs
 * @desc    Create a new job
 * @access  Private
 */
router.post('/', JobController.createJob);

/**
 * @route   GET /api/jobs
 * @desc    List user's jobs with filtering
 * @access  Private
 */
router.get('/', JobController.listJobs);

/**
 * @route   GET /api/jobs/stats
 * @desc    Get job statistics
 * @access  Private
 */
router.get('/stats', JobController.getStats);

/**
 * @route   GET /api/jobs/:id
 * @desc    Get job by ID
 * @access  Private
 */
router.get('/:id', JobController.getJob);

/**
 * @route   DELETE /api/jobs/:id
 * @desc    Cancel a job
 * @access  Private
 */
router.delete('/:id', JobController.cancelJob);

/**
 * @route   POST /api/jobs/:id/retry
 * @desc    Retry a failed job
 * @access  Private
 */
router.post('/:id/retry', JobController.retryJob);

export default router;
