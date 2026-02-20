const express = require('express');
const ExportController = require('../controllers/exportController');

const router = express.Router();

router.post('/csv', ExportController.initiateExport);
router.get('/:exportId/status', ExportController.getStatus);
router.get('/:exportId/download', ExportController.downloadExport);
router.delete('/:exportId', ExportController.cancelExport);

module.exports = router;
