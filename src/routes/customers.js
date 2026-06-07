const express = require('express');
const router = express.Router();
const db = require('../models/database');

router.get('/', (req, res) => {
  db.all('SELECT * FROM customers ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
    } else {
      res.json({ success: true, data: rows });
    }
  });
});

router.get('/:id', (req, res) => {
  db.get('SELECT * FROM customers WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
    } else if (!row) {
      res.status(404).json({ success: false, error: '客户不存在' });
    } else {
      res.json({ success: true, data: row });
    }
  });
});

router.post('/', (req, res) => {
  const { name, contact, address } = req.body;
  db.run('INSERT INTO customers (name, contact, address) VALUES (?, ?, ?)',
    [name, contact || '', address || ''],
    function(err) {
      if (err) {
        res.status(400).json({ success: false, error: err.message });
      } else {
        res.status(201).json({ success: true, data: { id: this.lastID, name, contact, address } });
      }
    }
  );
});

module.exports = router;
