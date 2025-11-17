import express from 'express';
import { ChatSessionController } from '../controllers/ChatSessionController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const chatSessionController = new ChatSessionController();

// All routes require authentication
router.use(authenticateToken);

// Chat session CRUD routes
router.get('/', chatSessionController.getMyChatSessions.bind(chatSessionController));
router.get('/:id', chatSessionController.getChatSession.bind(chatSessionController));
router.post('/', chatSessionController.createChatSession.bind(chatSessionController));
router.patch('/:id', chatSessionController.updateChatSession.bind(chatSessionController));
router.delete('/:id', chatSessionController.deleteChatSession.bind(chatSessionController));

// Chat messages routes
router.post('/:id/messages', chatSessionController.addMessage.bind(chatSessionController));

// Context and title generation routes
router.get('/:id/context', chatSessionController.getContext.bind(chatSessionController));
router.post('/:id/generate-title', chatSessionController.generateTitle.bind(chatSessionController));

export default router;
