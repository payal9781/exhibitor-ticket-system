const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { getCards, saveCard, updateCard, deleteCard, createDigitalCard } = require('../controllers/cardController');

// Dashboard stats routes

router.post('/create-digital-card', authMiddleware(['exhibitor', 'visitor']), createDigitalCard);
router.post('/save-card', authMiddleware(['exhibitor', 'visitor']), saveCard);
router.post('/update-card', authMiddleware(['exhibitor', 'visitor']), updateCard);
router.post('/get-cards', authMiddleware(['exhibitor', 'visitor']), getCards);
router.post('/delete-cards', authMiddleware(['exhibitor', 'visitor']), deleteCard);

module.exports = router;
