const express = require('express');
const router = express.Router();
const { upload, uploadImage } = require('../controllers/upload.controller');
const { authenticate } = require('../middlewares/auth.middleware');

// Upload image endpoint (protected)
router.post('/image', authenticate, upload.single('image'), uploadImage);

module.exports = router;
