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

  static async getIdempotentSubmission(idempotencyKey) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM idempotent_submissions WHERE idempotency_key = ?`, 
        [idempotencyKey], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static async addFillingRecordIdempotent(data, idempotencyKey) {
    return new Promise(async (resolve, reject) => {
      const { batch_id, cylinder_id, operator_id, filling_weight } = data;

      try {
        const existingSubmission = await FillingService.getIdempotentSubmission(idempotencyKey);
        
        if (existingSubmission) {
          let responseData = null;
          let beforeState = null;
          let afterState = null;
          
          try {
            responseData = existingSubmission.response_data ? JSON.parse(existingSubmission.response_data) : null;
            beforeState = existingSubmission.before_state ? JSON.parse(existingSubmission.before_state) : null;
            afterState = existingSubmission.after_state ? JSON.parse(existingSubmission.after_state) : null;
          } catch (e) {}
          
          return resolve({
            idempotent: true,
            status: existingSubmission.status,
            submission_id: existingSubmission.id,
            response_data: responseData,
            before_state: beforeState,
            after_state: afterState,
            error_message: existingSubmission.error_message,
            message: '幂等提交：返回已有处理结果'
          });
        }

        db.run(`INSERT INTO idempotent_submissions 
          (idempotency_key, request_type, request_body, status)
          VALUES (?, ?, ?, 'processing')`,
          [idempotencyKey, 'filling_record', JSON.stringify(data)],
          async function(submissionErr) {
            if (submissionErr) {
              if (submissionErr.message.includes('UNIQUE constraint failed')) {
                const retrySubmission = await FillingService.getIdempotentSubmission(idempotencyKey);
                if (retrySubmission) {
                  let responseData = null;
                  try {
                    responseData = retrySubmission.response_data ? JSON.parse(retrySubmission.response_data) : null;
                  } catch (e) {}
                  return resolve({
                    idempotent: true,
                    status: retrySubmission.status,
                    submission_id: retrySubmission.id,
                    response_data: responseData,
                    message: '幂等提交：返回已有处理结果'
                  });
                }
              }
              return reject(submissionErr);
            }

            const submissionId = this.lastID;
            let beforeState = null;

            try {
              const cylinder = await CylinderService.getById(cylinder_id);
              beforeState = {
                cylinder: cylinder,
                timestamp: new Date().toISOString()
              };

              if (!cylinder) {
                db.run(`UPDATE idempotent_submissions 
                        SET status = 'failed', error_message = ?, before_state = ?, processed_at = CURRENT_TIMESTAMP
                        WHERE id = ?`,
                  ['气瓶不存在', JSON.stringify(beforeState), submissionId]);
                return reject(new Error('气瓶不存在'));
              }

              const isExpired = await CylinderService.isInspectionExpired(cylinder_id);
              if (isExpired) {
                db.run(`UPDATE idempotent_submissions 
                        SET status = 'failed', error_message = ?, before_state = ?, processed_at = CURRENT_TIMESTAMP
                        WHERE id = ?`,
                  ['气瓶检验已过期，禁止充装', JSON.stringify(beforeState), submissionId]);
                return reject(new Error('气瓶检验已过期，禁止充装'));
              }

              if (cylinder.status === 'scrapped') {
                db.run(`UPDATE idempotent_submissions 
                        SET status = 'failed', error_message = ?, before_state = ?, processed_at = CURRENT_TIMESTAMP
                        WHERE id = ?`,
                  ['气瓶已报废，禁止充装', JSON.stringify(beforeState), submissionId]);
                return reject(new Error('气瓶已报废，禁止充装'));
              }

              if (cylinder.status !== 'idle' && cylinder.status !== 'expired') {
                db.run(`UPDATE idempotent_submissions 
                        SET status = 'failed', error_message = ?, before_state = ?, processed_at = CURRENT_TIMESTAMP
                        WHERE id = ?`,
                  [`气瓶当前状态(${cylinder.status})不允许充装`, JSON.stringify(beforeState), submissionId]);
                return reject(new Error(`气瓶当前状态(${cylinder.status})不允许充装`));
              }

              const weightCheck = await CylinderService.checkWeightOverload(cylinder_id, filling_weight);
              const status = weightCheck.isOverload ? 'rejected' : 'approved';

              db.run(`INSERT INTO filling_records 
                (batch_id, cylinder_id, operator_id, filling_weight, is_overweight, status, idempotency_key)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [batch_id, cylinder_id, operator_id, filling_weight, weightCheck.isOverload ? 1 : 0, status, idempotencyKey],
                function(insertErr) {
                  if (insertErr) {
                    db.run(`UPDATE idempotent_submissions 
                            SET status = 'failed', error_message = ?, before_state = ?, processed_at = CURRENT_TIMESTAMP
                            WHERE id = ?`,
                      [insertErr.message, JSON.stringify(beforeState), submissionId]);
                    return reject(insertErr);
                  }

                  const recordId = this.lastID;
                  const responseData = {
                    id: recordId,
                    ...data,
                    is_overweight: weightCheck.isOverload,
                    status,
                    weight_check: weightCheck,
                    warning: weightCheck.isOverload ? '充装重量超限，已拒绝' : null
                  };

                  if (status === 'approved') {
                    db.run(`UPDATE cylinders SET status = 'filled', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                      [cylinder_id], async (updateErr) => {
                        if (updateErr) {
                          db.run(`UPDATE idempotent_submissions 
                                  SET status = 'failed', error_message = ?, before_state = ?, processed_at = CURRENT_TIMESTAMP
                                  WHERE id = ?`,
                            [updateErr.message, JSON.stringify(beforeState), submissionId]);
                          return reject(updateErr);
                        }

                        const updatedCylinder = await CylinderService.getById(cylinder_id);
                        const afterState = {
                          cylinder: updatedCylinder,
                          filling_record: { id: recordId, status: status },
                          timestamp: new Date().toISOString()
                        };

                        db.run(`UPDATE idempotent_submissions 
                                SET status = 'success', before_state = ?, after_state = ?, 
                                    response_data = ?, resource_id = ?, resource_type = 'filling_record',
                                    processed_at = CURRENT_TIMESTAMP
                                WHERE id = ?`,
                          [JSON.stringify(beforeState), JSON.stringify(afterState), 
                           JSON.stringify(responseData), recordId, submissionId]);

                        resolve({
                          idempotent: false,
                          submission_id: submissionId,
                          ...responseData,
                          before_state: beforeState,
                          after_state: afterState,
                          message: '幂等提交：首次处理成功'
                        });
                      }
                    );
                  } else {
                    const afterState = {
                      cylinder: cylinder,
                      filling_record: { id: recordId, status: status, rejected: true },
                      timestamp: new Date().toISOString()
                    };

                    db.run(`UPDATE idempotent_submissions 
                            SET status = 'success', before_state = ?, after_state = ?, 
                                response_data = ?, resource_id = ?, resource_type = 'filling_record',
                                processed_at = CURRENT_TIMESTAMP
                            WHERE id = ?`,
                      [JSON.stringify(beforeState), JSON.stringify(afterState), 
                       JSON.stringify(responseData), recordId, submissionId]);

                    resolve({
                      idempotent: false,
                      submission_id: submissionId,
                      ...responseData,
                      before_state: beforeState,
                      after_state: afterState,
                      message: '幂等提交：首次处理完成'
                    });
                  }
                }
              );
            } catch (err) {
              db.run(`UPDATE idempotent_submissions 
                      SET status = 'failed', error_message = ?, processed_at = CURRENT_TIMESTAMP
                      WHERE id = ?`,
                [err.message, submissionId]);
              reject(err);
            }
          }
        );
      } catch (err) {
        reject(err);
      }
    });
  }

  static async getAllIdempotentSubmissions(params = {}) {
    return new Promise((resolve, reject) => {
      let sql = `SELECT * FROM idempotent_submissions WHERE 1=1`;
      const values = [];
      
      if (params.request_type) {
        sql += ' AND request_type = ?';
        values.push(params.request_type);
      }
      if (params.status) {
        sql += ' AND status = ?';
        values.push(params.status);
      }
      if (params.resource_type) {
        sql += ' AND resource_type = ?';
        values.push(params.resource_type);
      }
      
      sql += ' ORDER BY created_at DESC';
      
      db.all(sql, values, (err, rows) => {
        if (err) reject(err);
        else {
          const result = rows.map(row => {
            let parsed = { ...row };
            try {
              if (row.request_body) parsed.request_body = JSON.parse(row.request_body);
              if (row.before_state) parsed.before_state = JSON.parse(row.before_state);
              if (row.after_state) parsed.after_state = JSON.parse(row.after_state);
              if (row.response_data) parsed.response_data = JSON.parse(row.response_data);
            } catch (e) {}
            return parsed;
          });
          resolve(result);
        }
      });
    });
  }

  static async getIdempotentSubmissionDetail(id) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM idempotent_submissions WHERE id = ?`, [id], (err, row) => {
        if (err) reject(err);
        else if (!row) resolve(null);
        else {
          let parsed = { ...row };
          try {
            if (row.request_body) parsed.request_body = JSON.parse(row.request_body);
            if (row.before_state) parsed.before_state = JSON.parse(row.before_state);
            if (row.after_state) parsed.after_state = JSON.parse(row.after_state);
            if (row.response_data) parsed.response_data = JSON.parse(row.response_data);
          } catch (e) {}
          resolve(parsed);
        }
      });
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
