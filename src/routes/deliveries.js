const express = require('express');
const router = express.Router();
const DeliveryService = require('../services/deliveryService');

router.get('/', async (req, res) => {
  try {
    const deliveries = await DeliveryService.getAll(req.query);
    res.json({ success: true, data: deliveries });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const delivery = await DeliveryService.getById(req.params.id);
    if (!delivery) {
      return res.status(404).json({ success: false, error: '配送单不存在' });
    }
    res.json({ success: true, data: delivery });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id/items', async (req, res) => {
  try {
    const items = await DeliveryService.getDeliveryItems(req.params.id);
    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const result = await DeliveryService.create(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.put('/:id/start', async (req, res) => {
  try {
    const result = await DeliveryService.startDelivery(req.params.id);
    if (result.affected === 0) {
      return res.status(404).json({ success: false, error: '配送单不存在或状态不允许' });
    }
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.put('/:id/sign', async (req, res) => {
  try {
    const result = await DeliveryService.signDelivery(req.params.id, req.body.signed_by);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/inventory/customer/:customerId', async (req, res) => {
  try {
    const inventory = await DeliveryService.getCustomerInventory(req.params.customerId);
    res.json({ success: true, data: inventory });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
