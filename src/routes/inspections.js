const express = require('express');
const router = express.Router();
const InspectionService = require('../services/inspectionService');

router.get('/', async (req, res) => {
  try {
    const inspections = await InspectionService.getAll(req.query);
    res.json({ success: true, data: inspections });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const inspection = await InspectionService.getById(req.params.id);
    if (!inspection) {
      return res.status(404).json({ success: false, error: '检验记录不存在' });
    }
    res.json({ success: true, data: inspection });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const result = await InspectionService.create(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/verify/:cylinderId', async (req, res) => {
  try {
    const result = await InspectionService.verifyInspection(req.params.cylinderId);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
