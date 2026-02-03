const express = require('express');
const router = express.Router();
const { generateQr, getAggregatedByToken, listTokens, devSeed } = require('../controllers/qr.controller');

router.post('/generate', generateQr);
router.post('/dev-seed', devSeed);
router.get('/tokens', listTokens);
router.get('/scan/:token', getAggregatedByToken);

module.exports = router;
