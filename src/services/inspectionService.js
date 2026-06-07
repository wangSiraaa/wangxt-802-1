const db = require('../models/database');
const CylinderService = require('./cylinderService');

class InspectionService {
  static async getAll(params = {}) {
    return new Promise((resolve, reject) => {
      let sql = `SELECT i.*, c.cylinder_code, u.name as inspector_name 
                 FROM inspections i 
                 LEFT JOIN cylinders c ON i.cylinder_id = c.id 
                 LEFT JOIN users u ON i.inspector_id = u.id 
                 WHERE 1=1`;
      const values = [];
      
      if (params.cylinder_id) {
        sql += ' AND i.cylinder_id = ?';
        values.push(params.cylinder_id);
      }
      if (params.result) {
        sql += ' AND i.result = ?';
        values.push(params.result);
      }
      
      sql += ' ORDER BY i.created_at DESC';
      
      db.all(sql, values, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async getById(id) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT i.*, c.cylinder_code, u.name as inspector_name 
              FROM inspections i 
              LEFT JOIN cylinders c ON i.cylinder_id = c.id 
              LEFT JOIN users u ON i.inspector_id = u.id 
              WHERE i.id = ?`, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static async create(data) {
    return new Promise(async (resolve, reject) => {
      const { cylinder_id, inspector_id, inspection_date, next_inspection_date, result, remarks } = data;
      
      const cylinder = await CylinderService.getById(cylinder_id);
      if (!cylinder) {
        return reject(new Error('气瓶不存在'));
      }

      db.run(`INSERT INTO inspections 
        (cylinder_id, inspector_id, inspection_date, next_inspection_date, result, remarks)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [cylinder_id, inspector_id, inspection_date, next_inspection_date, result, remarks || ''],
        function(err) {
          if (err) return reject(err);
          
          let newStatus = cylinder.status;
          if (result === 'fail') {
            newStatus = 'scrapped';
          } else {
            const today = new Date();
            const nextInspect = new Date(next_inspection_date);
            newStatus = nextInspect < today ? 'expired' : 'idle';
          }
          
          db.run(`UPDATE cylinders 
                  SET next_inspection_date = ?, status = ?, updated_at = CURRENT_TIMESTAMP 
                  WHERE id = ?`,
            [next_inspection_date, newStatus, cylinder_id],
            (updateErr) => {
              if (updateErr) return reject(updateErr);
              resolve({ 
                id: this.lastID, 
                ...data,
                cylinder_status_updated: newStatus 
              });
            }
          );
        }
      );
    });
  }

  static async verifyInspection(cylinderId) {
    return new Promise(async (resolve, reject) => {
      try {
        const cylinder = await CylinderService.getById(cylinderId);
        if (!cylinder) {
          return reject(new Error('气瓶不存在'));
        }

        const today = new Date();
        const nextInspect = new Date(cylinder.next_inspection_date);
        const isExpired = nextInspect < today;

        resolve({
          cylinder_id: cylinderId,
          cylinder_code: cylinder.cylinder_code,
          next_inspection_date: cylinder.next_inspection_date,
          is_expired: isExpired,
          days_until_expiry: isExpired 
            ? -Math.ceil((today - nextInspect) / (1000 * 60 * 60 * 24))
            : Math.ceil((nextInspect - today) / (1000 * 60 * 60 * 24)),
          can_fill: !isExpired && cylinder.status !== 'scrapped'
        });
      } catch (err) {
        reject(err);
      }
    });
  }
}

module.exports = InspectionService;
