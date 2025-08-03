const { Router } = require('express');
const { getAllUsers } = require('../controllers/superadminController');
const authMiddleware  = require('../middleware/authMiddleware');

const router = Router();

router.get('/users', authMiddleware(['superadmin']), getAllUsers);

module.exports = router;