const express = require('express');
const router = express.Router();
const { createPlant, getPlants, getPlant, deletePlant, updatePlant } = require('../controllers/plants.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const authorize = require('../middlewares/authorize');
const { ROLES } = require('../services/user.service');

// Admin can create plants; both roles can view
router.post('/', authenticate, authorize([ROLES.ADMIN]), createPlant);
router.get('/', authenticate, authorize([ROLES.ADMIN, ROLES.MINISTRY]), getPlants);
router.get('/:id', authenticate, authorize([ROLES.ADMIN, ROLES.MINISTRY]), getPlant);
router.put('/:id', authenticate, authorize([ROLES.ADMIN, ROLES.MINISTRY]), updatePlant);
router.delete('/:id', authenticate, authorize([ROLES.ADMIN]), deletePlant);

module.exports = router;
