const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { getCards, saveCard, deleteCard, createDigitalCard } = require('../controllers/cardController');

// Dashboard stats routes

router.post('/create-digital-card', authMiddleware(['exhibitor', 'visitor']), createDigitalCard);
router.post('/save-card', authMiddleware(['exhibitor', 'visitor']), saveCard);
router.post('/get-cards', authMiddleware(['exhibitor', 'visitor']), getCards);
router.post('/delete-cards', authMiddleware(['exhibitor', 'visitor']), deleteCard);

module.exports = router;
