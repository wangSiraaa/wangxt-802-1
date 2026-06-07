const express = require('express');
const router = express.Router();
const db = require('../models/database');

router.get('/', (req, res) => {
  let sql = 'SELECT * FROM users WHERE 1=1';
  const values = [];
  
  if (req.query.role) {
    sql += ' AND role = ?';
    values.push(req.query.role);
  }
  
  db.all(sql, values, (err, rows) => {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
    } else {
      res.json({ success: true, data: rows });
    }
  });
});

router.get('/:id', (req, res) => {
  db.get('SELECT * FROM users WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
    } else if (!row) {
      res.status(404).json({ success: false, error: '用户不存在' });
    } else {
      res.json({ success: true, data: row });
    }
  });
});

router.post('/', (req, res) => {
  const { username, name, role } = req.body;
  db.run('INSERT INTO users (username, name, role) VALUES (?, ?, ?)',
    [username, name, role],
    function(err) {
      if (err) {
        res.status(400).json({ success: false, error: err.message });
      } else {
        res.status(201).json({ success: true, data: { id: this.lastID, username, name, role } });
      }
    }
  );
});

module.exports = router;
