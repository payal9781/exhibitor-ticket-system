const { Router } = require('express');
const { register, login, signout } = require('../controllers/authController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { validator } = require('../utils/validator');
const { register: registerValidator, login: loginValidator } = require('../validators/authValidator');
const { createUploadMiddleware } = require('../middleware/uploadMiddleware');

const router = Router();
const upload = createUploadMiddleware('user');

router.post('/register', upload, validator(registerValidator), register);
router.post('/login', validator(loginValidator), login);
router.post('/signout', authMiddleware(['superadmin', 'organizer', 'exhibitor', 'visitor']), signout);

module.exports = router;