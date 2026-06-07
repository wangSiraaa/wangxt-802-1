const express = require('express');
const router = express.Router();
const FillingService = require('../services/fillingService');

router.get('/batches', async (req, res) => {
  try {
    const batches = await FillingService.getAllBatches(req.query);
    res.json({ success: true, data: batches });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/batches/:id', async (req, res) => {
  try {
    const batch = await FillingService.getBatchById(req.params.id);
    if (!batch) {
      return res.status(404).json({ success: false, error: '充装批次不存在' });
    }
    res.json({ success: true, data: batch });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/batches/:id/records', async (req, res) => {
  try {
    const records = await FillingService.getBatchRecords(req.params.id);
    res.json({ success: true, data: records });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/batches', async (req, res) => {
  try {
    const result = await FillingService.createBatch(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/records', async (req, res) => {
  try {
    const result = await FillingService.addFillingRecord(req.body);
    if (result.status === 'rejected') {
      return res.status(400).json({ 
        success: false, 
        error: result.warning || '充装被拒绝',
        data: result 
      });
    }
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.put('/batches/:id/complete', async (req, res) => {
  try {
    const result = await FillingService.completeBatch(req.params.id);
    if (result.affected === 0) {
      return res.status(404).json({ success: false, error: '充装批次不存在或已完成' });
    }
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
