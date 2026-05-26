const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
  listSectors,
  getActiveSectors,
  createSector,
  updateSector,
  deleteSector,
  toggleSectorStatus,
} = require('../controllers/industrySectorController');

router.get('/active', getActiveSectors);

router.post('/list', authMiddleware(['superAdmin']), listSectors);
router.post('/create', authMiddleware(['superAdmin']), createSector);
router.post('/update', authMiddleware(['superAdmin']), updateSector);
router.post('/delete', authMiddleware(['superAdmin']), deleteSector);
router.post('/toggle-status', authMiddleware(['superAdmin']), toggleSectorStatus);

module.exports = router;
