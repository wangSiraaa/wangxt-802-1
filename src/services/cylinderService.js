const db = require('../models/database');

class CylinderService {
  static async getAll(params = {}) {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM cylinders WHERE 1=1';
      const values = [];
      
      if (params.status) {
        sql += ' AND status = ?';
        values.push(params.status);
      }
      if (params.cylinder_code) {
        sql += ' AND cylinder_code LIKE ?';
        values.push(`%${params.cylinder_code}%`);
      }
      
      sql += ' ORDER BY created_at DESC';
      
      db.all(sql, values, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async getById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM cylinders WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static async getByCode(cylinderCode) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM cylinders WHERE cylinder_code = ?', [cylinderCode], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static async create(data) {
    return new Promise((resolve, reject) => {
      const { cylinder_code, specification, medium, volume, max_weight, tare_weight, 
              manufacture_date, next_inspection_date, current_location } = data;
      
      const today = new Date();
      const nextInspect = new Date(next_inspection_date);
      let status = 'idle';
      if (nextInspect < today) {
        status = 'expired';
      }
      
      db.run(`INSERT INTO cylinders 
        (cylinder_code, specification, medium, volume, max_weight, tare_weight, 
         manufacture_date, next_inspection_date, status, current_location)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [cylinder_code, specification, medium, volume, max_weight, tare_weight,
         manufacture_date, next_inspection_date, status, current_location || '充装站'],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, ...data, status });
        }
      );
    });
  }

  static async update(id, data) {
    return new Promise((resolve, reject) => {
      const fields = [];
      const values = [];
      
      for (const key in data) {
        if (key !== 'id' && key !== 'created_at') {
          fields.push(`${key} = ?`);
          values.push(data[key]);
        }
      }
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);
      
      db.run(`UPDATE cylinders SET ${fields.join(', ')} WHERE id = ?`, values, function(err) {
        if (err) reject(err);
        else resolve({ affected: this.changes });
      });
    });
  }

  static async isInspectionExpired(cylinderId) {
    return new Promise((resolve, reject) => {
      db.get('SELECT next_inspection_date FROM cylinders WHERE id = ?', [cylinderId], (err, row) => {
        if (err) reject(err);
        else if (!row) resolve(true);
        else {
          const today = new Date();
          const nextInspect = new Date(row.next_inspection_date);
          resolve(nextInspect < today);
        }
      });
    });
  }

  static async checkWeightOverload(cylinderId, fillingWeight) {
    return new Promise((resolve, reject) => {
      db.get('SELECT max_weight, tare_weight FROM cylinders WHERE id = ?', [cylinderId], (err, row) => {
        if (err) reject(err);
        else if (!row) resolve({ isOverload: true, maxAllowed: 0 });
        else {
          const maxAllowed = row.max_weight - row.tare_weight;
          const isOverload = fillingWeight > maxAllowed;
          resolve({ isOverload, maxAllowed, tareWeight: row.tare_weight, maxWeight: row.max_weight });
        }
      });
    });
  }
}

module.exports = CylinderService;
