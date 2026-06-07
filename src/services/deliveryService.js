const db = require('../models/database');

class DeliveryService {
  static async getAll(params = {}) {
    return new Promise((resolve, reject) => {
      let sql = `SELECT d.*, c.name as customer_name, u.name as delivery_person_name
                 FROM deliveries d 
                 LEFT JOIN customers c ON d.customer_id = c.id 
                 LEFT JOIN users u ON d.delivery_person_id = u.id 
                 WHERE 1=1`;
      const values = [];
      
      if (params.status) {
        sql += ' AND d.status = ?';
        values.push(params.status);
      }
      if (params.customer_id) {
        sql += ' AND d.customer_id = ?';
        values.push(params.customer_id);
      }
      
      sql += ' ORDER BY d.created_at DESC';
      
      db.all(sql, values, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async getById(id) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT d.*, c.name as customer_name, c.contact, c.address, u.name as delivery_person_name
              FROM deliveries d 
              LEFT JOIN customers c ON d.customer_id = c.id 
              LEFT JOIN users u ON d.delivery_person_id = u.id 
              WHERE d.id = ?`, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static async getDeliveryItems(deliveryId) {
    return new Promise((resolve, reject) => {
      db.all(`SELECT di.*, cy.cylinder_code, cy.specification, cy.medium,
                     fr.filling_weight, fb.batch_no
              FROM delivery_items di 
              LEFT JOIN cylinders cy ON di.cylinder_id = cy.id 
              LEFT JOIN filling_records fr ON di.filling_record_id = fr.id
              LEFT JOIN filling_batches fb ON fr.batch_id = fb.id
              WHERE di.delivery_id = ?`, [deliveryId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async create(data) {
    return new Promise((resolve, reject) => {
      const { delivery_person_id, customer_id, cylinder_ids } = data;
      const deliveryNo = `DL${Date.now()}`;

      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        db.run(`INSERT INTO deliveries (delivery_no, delivery_person_id, customer_id, status)
                VALUES (?, ?, ?, 'pending')`,
          [deliveryNo, delivery_person_id, customer_id],
          function(err) {
            if (err) {
              db.run('ROLLBACK');
              return reject(err);
            }

            const deliveryId = this.lastID;
            const itemInserts = cylinder_ids.map(({ cylinder_id, filling_record_id }) => {
              return new Promise((res, rej) => {
                db.run(`INSERT INTO delivery_items (delivery_id, cylinder_id, filling_record_id)
                        VALUES (?, ?, ?)`,
                  [deliveryId, cylinder_id, filling_record_id],
                  (insErr) => {
                    if (insErr) rej(insErr);
                    else res();
                  }
                );
              });
            });

            Promise.all(itemInserts).then(() => {
              const statusUpdates = cylinder_ids.map(({ cylinder_id }) => {
                return new Promise((res, rej) => {
                  db.run(`UPDATE cylinders SET status = 'delivering', updated_at = CURRENT_TIMESTAMP 
                          WHERE id = ?`, [cylinder_id], (updErr) => {
                    if (updErr) rej(updErr);
                    else res();
                  });
                });
              });

              Promise.all(statusUpdates).then(() => {
                db.run('COMMIT', (commitErr) => {
                  if (commitErr) {
                    db.run('ROLLBACK');
                    reject(commitErr);
                  } else {
                    resolve({ id: deliveryId, delivery_no: deliveryNo, ...data });
                  }
                });
              }).catch((updErr) => {
                db.run('ROLLBACK');
                reject(updErr);
              });
            }).catch((insErr) => {
              db.run('ROLLBACK');
              reject(insErr);
            });
          }
        );
      });
    });
  }

  static async startDelivery(deliveryId) {
    return new Promise((resolve, reject) => {
      db.run(`UPDATE deliveries SET status = 'in_transit' WHERE id = ? AND status = 'pending'`,
        [deliveryId], function(err) {
          if (err) reject(err);
          else resolve({ affected: this.changes });
        }
      );
    });
  }

  static async signDelivery(deliveryId, signedBy) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        db.run(`UPDATE deliveries 
                SET status = 'delivered', delivered_at = CURRENT_TIMESTAMP, signed_by = ?
                WHERE id = ? AND status = 'in_transit'`,
          [signedBy, deliveryId],
          function(err) {
            if (err) {
              db.run('ROLLBACK');
              return reject(err);
            }

            if (this.changes === 0) {
              db.run('ROLLBACK');
              return reject(new Error('配送单不存在或状态不允许签收'));
            }

            db.all(`SELECT cylinder_id FROM delivery_items WHERE delivery_id = ?`, [deliveryId], (err, items) => {
              if (err) {
                db.run('ROLLBACK');
                return reject(err);
              }

              db.get(`SELECT customer_id FROM deliveries WHERE id = ?`, [deliveryId], (err, delivery) => {
                if (err) {
                  db.run('ROLLBACK');
                  return reject(err);
                }

                const inventoryInserts = items.map(item => {
                  return new Promise((res, rej) => {
                    db.run(`INSERT INTO customer_inventory (customer_id, cylinder_id)
                            VALUES (?, ?)`,
                      [delivery.customer_id, item.cylinder_id],
                      (insErr) => {
                        if (insErr) rej(insErr);
                        else res();
                      }
                    );
                  });
                });

                const cylinderUpdates = items.map(item => {
                  return new Promise((res, rej) => {
                    db.run(`UPDATE cylinders SET status = 'at_customer', current_location = ?, updated_at = CURRENT_TIMESTAMP 
                            WHERE id = ?`,
                      ['客户现场', item.cylinder_id],
                      (updErr) => {
                        if (updErr) rej(updErr);
                        else res();
                      }
                    );
                  });
                });

                Promise.all([...inventoryInserts, ...cylinderUpdates]).then(() => {
                  db.run('COMMIT', (commitErr) => {
                    if (commitErr) {
                      db.run('ROLLBACK');
                      reject(commitErr);
                    } else {
                      resolve({ 
                        success: true, 
                        message: '配送签收成功，气瓶已进入客户库存',
                        cylinders_delivered: items.length
                      });
                    }
                  });
                }).catch((err) => {
                  db.run('ROLLBACK');
                  reject(err);
                });
              });
            });
          }
        );
      });
    });
  }

  static async getCustomerInventory(customerId) {
    return new Promise((resolve, reject) => {
      db.all(`SELECT ci.*, cy.cylinder_code, cy.specification, cy.medium
              FROM customer_inventory ci 
              LEFT JOIN cylinders cy ON ci.cylinder_id = cy.id 
              WHERE ci.customer_id = ? AND ci.status = 'in_stock'
              ORDER BY ci.received_at DESC`, [customerId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = DeliveryService;
