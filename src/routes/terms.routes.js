const express = require('express');
const router = express.Router();
const caregiverTerms = require('../data/caregiver-terms');
const patientTerms = require('../data/patient-terms');

// Get terms and conditions based on user role
router.get('/terms/:role', (req, res) => {
  try {
    const { role } = req.params;
    
    let terms;
    switch (role) {
      case 'caregiver':
        terms = caregiverTerms;
        break;
      case 'patient':
        terms = patientTerms;
        break;
      default:
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid role specified' 
        });
    }

    res.json({
      success: true,
      data: {
        terms,
        role
      }
    });
  } catch (error) {
    console.error('Error fetching terms:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch terms and conditions'
    });
  }
});

module.exports = router;