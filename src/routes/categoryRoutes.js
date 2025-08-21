const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  createDefaultCategories,
  reorderCategories
} = require('../controllers/categoryController');

// Category CRUD routes
router.post('/create', authMiddleware(['organizer', 'superAdmin']), createCategory);
router.post('/list', authMiddleware(['organizer', 'superAdmin']), getCategories);
router.post('/get', authMiddleware(['organizer', 'superAdmin']), getCategoryById);
router.post('/update', authMiddleware(['organizer', 'superAdmin']), updateCategory);
router.post('/delete', authMiddleware(['organizer', 'superAdmin']), deleteCategory);

// Utility routes
router.post('/create-defaults', authMiddleware(['organizer', 'superAdmin']), createDefaultCategories);
router.post('/reorder', authMiddleware(['organizer', 'superAdmin']), reorderCategories);

module.exports = router;