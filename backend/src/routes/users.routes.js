const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const authorize = require('../middlewares/authorize');
const { getUsers, postUser, putUser, removeUser } = require('../controllers/users.controller');
const { ROLES } = require('../services/user.service');

router.use(authenticate);
router.get('/', authorize([ROLES.ADMIN]), getUsers);
router.post('/', authorize([ROLES.ADMIN]), postUser);
router.put('/:id', authorize([ROLES.ADMIN]), putUser);
router.delete('/:id', authorize([ROLES.ADMIN]), removeUser);

module.exports = router;
