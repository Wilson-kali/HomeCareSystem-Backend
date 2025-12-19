const express = require('express');
const {
  getSpecialties,
  getSpecialtyById,
  createSpecialty,
  updateSpecialty,
  deleteSpecialty,
  restoreSpecialty,
  updateSpecialtyFees
} = require('../controllers/specialtyController');
const { authenticateToken } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/roleCheck.middleware');

const router = express.Router();

// Public routes
router.get('/', getSpecialties);
router.get('/:id', getSpecialtyById);

// Admin only routes
router.post('/', authenticateToken, requireAdmin, createSpecialty);
router.put('/:id', authenticateToken, requireAdmin, updateSpecialty);
router.delete('/:id', authenticateToken, requireAdmin, deleteSpecialty);
router.patch('/:id/restore', authenticateToken, requireAdmin, restoreSpecialty);
router.patch('/:id/fees', authenticateToken, requireAdmin, updateSpecialtyFees);

module.exports = router;