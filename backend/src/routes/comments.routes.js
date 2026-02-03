const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const authorize = require('../middlewares/authorize');
const { ROLES } = require('../services/user.service');
const { postComment, getComments } = require('../controllers/comments.controller');

router.use(authenticate);
router.get('/', authorize([ROLES.ADMIN, ROLES.MINISTRY]), getComments);
router.post('/', authorize([ROLES.ADMIN, ROLES.MINISTRY]), postComment);

module.exports = router;
