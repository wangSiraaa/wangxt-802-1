const db = require('../models/database');
const CylinderService = require('./cylinderService');

class FillingService {
  static async getAllBatches(params = {}) {
    return new Promise((resolve, reject) => {
      let sql = `SELECT fb.*, u.name as operator_name 
                 FROM filling_batches fb 
                 LEFT JOIN users u ON fb.operator_id = u.id 
                 WHERE 1=1`;
      const values = [];
      
      if (params.status) {
        sql += ' AND fb.status = ?';
        values.push(params.status);
      }
      
      sql += ' ORDER BY fb.created_at DESC';
      
      db.all(sql, values, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async getBatchById(id) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT fb.*, u.name as operator_name 
              FROM filling_batches fb 
              LEFT JOIN users u ON fb.operator_id = u.id 
              WHERE fb.id = ?`, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static async getBatchRecords(batchId) {
    return new Promise((resolve, reject) => {
      db.all(`SELECT fr.*, c.cylinder_code, c.specification, c.medium,
                     u.name as operator_name
              FROM filling_records fr 
              LEFT JOIN cylinders c ON fr.cylinder_id = c.id 
              LEFT JOIN users u ON fr.operator_id = u.id 
              WHERE fr.batch_id = ?
              ORDER BY fr.filled_at DESC`, [batchId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async createBatch(data) {
    return new Promise((resolve, reject) => {
      const { operator_id, remarks } = data;
      const batchNo = `FB${Date.now()}`;
      
      db.run(`INSERT INTO filling_batches (batch_no, operator_id, remarks)
              VALUES (?, ?, ?)`,
        [batchNo, operator_id, remarks || ''],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, batch_no: batchNo, ...data });
        }
      );
    });
  }

  static async addFillingRecord(data) {
    return new Promise(async (resolve, reject) => {
      const { batch_id, cylinder_id, operator_id, filling_weight } = data;

      try {
        const cylinder = await CylinderService.getById(cylinder_id);
        if (!cylinder) {
          return reject(new Error('气瓶不存在'));
        }

        const isExpired = await CylinderService.isInspectionExpired(cylinder_id);
        if (isExpired) {
          return reject(new Error('气瓶检验已过期，禁止充装'));
        }

        if (cylinder.status === 'scrapped') {
          return reject(new Error('气瓶已报废，禁止充装'));
        }

        if (cylinder.status !== 'idle' && cylinder.status !== 'expired') {
          return reject(new Error(`气瓶当前状态(${cylinder.status})不允许充装`));
        }

        const weightCheck = await CylinderService.checkWeightOverload(cylinder_id, filling_weight);
        
        const status = weightCheck.isOverload ? 'rejected' : 'approved';

        db.run(`INSERT INTO filling_records 
          (batch_id, cylinder_id, operator_id, filling_weight, is_overweight, status)
          VALUES (?, ?, ?, ?, ?, ?)`,
          [batch_id, cylinder_id, operator_id, filling_weight, weightCheck.isOverload ? 1 : 0, status],
          function(err) {
            if (err) return reject(err);

            if (status === 'approved') {
              db.run(`UPDATE cylinders SET status = 'filled', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [cylinder_id], (updateErr) => {
                  if (updateErr) return reject(updateErr);
                  
                  resolve({
                    id: this.lastID,
                    ...data,
                    is_overweight: weightCheck.isOverload,
                    status,
                    weight_check: weightCheck,
                    warning: weightCheck.isOverload ? '充装重量超限，已拒绝' : null
                  });
                }
              );
            } else {
              resolve({
                id: this.lastID,
                ...data,
                is_overweight: weightCheck.isOverload,
                status,
                weight_check: weightCheck,
                warning: '充装重量超限，已拒绝'
              });
            }
          }
        );
      } catch (err) {
        reject(err);
      }
    });
  }

  static async completeBatch(batchId) {
    return new Promise((resolve, reject) => {
      db.run(`UPDATE filling_batches SET status = 'completed' WHERE id = ? AND status = 'processing'`,
        [batchId], function(err) {
          if (err) reject(err);
          else resolve({ affected: this.changes });
        }
      );
    });
  }
}

module.exports = FillingService;
