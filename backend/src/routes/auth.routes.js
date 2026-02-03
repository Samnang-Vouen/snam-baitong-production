const express = require('express');
const router = express.Router();
const { postLogin, postLogout, getMe, updatePassword } = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');

router.post('/login', postLogin);
router.post('/logout', postLogout); // Don't require auth - just clear cookie
router.get('/me', authenticate, getMe);
router.put('/me/password', authenticate, updatePassword);

module.exports = router;
