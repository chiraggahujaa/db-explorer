// User routes with authentication and validation

import express from 'express';
import { UserController } from '../controllers/UserController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const userController = new UserController();

// Protected routes (current user)
router.get('/me', authenticateToken, userController.getProfile.bind(userController));
router.patch('/me', authenticateToken, userController.updateProfile.bind(userController));

// Public routes
router.get('/:id', userController.getUserById.bind(userController));

export default router;