const express = require('express');
const router = express.Router();
const CylinderService = require('../services/cylinderService');

router.get('/', async (req, res) => {
  try {
    const cylinders = await CylinderService.getAll(req.query);
    res.json({ success: true, data: cylinders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const cylinder = await CylinderService.getById(req.params.id);
    if (!cylinder) {
      return res.status(404).json({ success: false, error: '气瓶不存在' });
    }
    res.json({ success: true, data: cylinder });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/code/:code', async (req, res) => {
  try {
    const cylinder = await CylinderService.getByCode(req.params.code);
    if (!cylinder) {
      return res.status(404).json({ success: false, error: '气瓶不存在' });
    }
    res.json({ success: true, data: cylinder });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const result = await CylinderService.create(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const result = await CylinderService.update(req.params.id, req.body);
    if (result.affected === 0) {
      return res.status(404).json({ success: false, error: '气瓶不存在' });
    }
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/:id/inspection-check', async (req, res) => {
  try {
    const isExpired = await CylinderService.isInspectionExpired(req.params.id);
    res.json({ success: true, data: { is_expired: isExpired } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/check-weight', async (req, res) => {
  try {
    const result = await CylinderService.checkWeightOverload(req.params.id, req.body.filling_weight);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
