const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { getCards, saveCard, deleteCard, createDigitalCard } = require('../controllers/cardController');

// Dashboard stats routes

router.get('/create-digital-card', authMiddleware(['exhibitor', 'visitor']), createDigitalCard);
router.get('/save-card', authMiddleware(['exhibitor', 'visitor']), saveCard);
router.get('/get-cards', authMiddleware(['exhibitor', 'visitor']), getCards);
router.get('/delete-cards', authMiddleware(['exhibitor', 'visitor']), deleteCard);

module.exports = router;
