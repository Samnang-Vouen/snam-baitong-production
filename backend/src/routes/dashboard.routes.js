const express = require('express');
const router = express.Router();
const { getDashboard } = require('../controllers/sensorData.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const authorize = require('../middlewares/authorize');
const { ROLES } = require('../services/user.service');

router.get('/', authenticate, authorize([ROLES.ADMIN, ROLES.MINISTRY]), getDashboard);

module.exports = router;
