// src/routes/chatRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
  sendChatRequest,
  respondToChatRequest,
  getChatRequests,
  getChatMessages,
  getEventUsers,
  markMessagesAsRead
} = require('../controllers/chatController');

// All chat endpoints are secured and require either exhibitor or visitor token
router.post('/request/send', authMiddleware(['exhibitor', 'visitor']), sendChatRequest);
router.post('/request/respond', authMiddleware(['exhibitor', 'visitor']), respondToChatRequest);
router.get('/requests', authMiddleware(['exhibitor', 'visitor']), getChatRequests);
router.get('/messages', authMiddleware(['exhibitor', 'visitor']), getChatMessages);
router.get('/event-users/:eventId', authMiddleware(['exhibitor', 'visitor']), getEventUsers);
router.post('/messages/mark-read', authMiddleware(['exhibitor', 'visitor']), markMessagesAsRead);

module.exports = router;
