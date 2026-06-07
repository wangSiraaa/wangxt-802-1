const db = require('../models/database');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const createTables = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('operator', 'inspector', 'delivery')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        contact TEXT,
        address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS cylinders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cylinder_code TEXT UNIQUE NOT NULL,
        specification TEXT NOT NULL,
        medium TEXT NOT NULL,
        volume REAL NOT NULL,
        max_weight REAL NOT NULL,
        tare_weight REAL NOT NULL,
        manufacture_date DATE NOT NULL,
        next_inspection_date DATE NOT NULL,
        status TEXT NOT NULL DEFAULT 'idle' CHECK(status IN ('idle', 'filling', 'filled', 'delivering', 'at_customer', 'inspecting', 'expired', 'scrapped')),
        current_location TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS inspections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cylinder_id INTEGER NOT NULL,
        inspector_id INTEGER NOT NULL,
        inspection_date DATE NOT NULL,
        next_inspection_date DATE NOT NULL,
        result TEXT NOT NULL CHECK(result IN ('pass', 'fail')),
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cylinder_id) REFERENCES cylinders(id),
        FOREIGN KEY (inspector_id) REFERENCES users(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS filling_batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_no TEXT UNIQUE NOT NULL,
        operator_id INTEGER NOT NULL,
        filling_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        status TEXT NOT NULL DEFAULT 'processing' CHECK(status IN ('processing', 'completed', 'cancelled')),
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (operator_id) REFERENCES users(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS filling_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id INTEGER NOT NULL,
        cylinder_id INTEGER NOT NULL,
        operator_id INTEGER NOT NULL,
        filling_weight REAL NOT NULL,
        is_overweight BOOLEAN NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
        filled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        idempotency_key TEXT UNIQUE,
        FOREIGN KEY (batch_id) REFERENCES filling_batches(id),
        FOREIGN KEY (cylinder_id) REFERENCES cylinders(id),
        FOREIGN KEY (operator_id) REFERENCES users(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS idempotent_submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        idempotency_key TEXT UNIQUE NOT NULL,
        request_type TEXT NOT NULL,
        request_body TEXT,
        status TEXT NOT NULL DEFAULT 'processing' CHECK(status IN ('processing', 'success', 'failed')),
        before_state TEXT,
        after_state TEXT,
        response_data TEXT,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        processed_at DATETIME,
        resource_id INTEGER,
        resource_type TEXT
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS deliveries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        delivery_no TEXT UNIQUE NOT NULL,
        delivery_person_id INTEGER NOT NULL,
        customer_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_transit', 'delivered', 'returned')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        delivered_at DATETIME,
        signed_by TEXT,
        FOREIGN KEY (delivery_person_id) REFERENCES users(id),
        FOREIGN KEY (customer_id) REFERENCES customers(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS delivery_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        delivery_id INTEGER NOT NULL,
        cylinder_id INTEGER NOT NULL,
        filling_record_id INTEGER NOT NULL,
        FOREIGN KEY (delivery_id) REFERENCES deliveries(id),
        FOREIGN KEY (cylinder_id) REFERENCES cylinders(id),
        FOREIGN KEY (filling_record_id) REFERENCES filling_records(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS customer_inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        cylinder_id INTEGER NOT NULL,
        received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        status TEXT NOT NULL DEFAULT 'in_stock' CHECK(status IN ('in_stock', 'returned')),
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (cylinder_id) REFERENCES cylinders(id)
      )`);

      db.run(`CREATE INDEX IF NOT EXISTS idx_cylinder_code ON cylinders(cylinder_code)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_cylinder_status ON cylinders(status)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_inspection_cylinder ON inspections(cylinder_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_filling_batch ON filling_records(batch_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_delivery_customer ON deliveries(customer_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_idempotency_key ON idempotent_submissions(idempotency_key)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_filling_record_idempotency ON filling_records(idempotency_key)`);

      console.log('数据库表创建成功');
      resolve();
    });
  });
};

createTables().then(() => {
  db.close();
  console.log('数据库初始化完成');
  process.exit(0);
}).catch((err) => {
  console.error('数据库初始化失败:', err);
  db.close();
  process.exit(1);
});
