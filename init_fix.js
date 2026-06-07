const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'cylinder.db');

if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run('PRAGMA foreign_keys = ON');
  
  db.run(`CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  db.run(`CREATE TABLE customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact TEXT,
    address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  db.run(`CREATE TABLE cylinders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cylinder_code TEXT UNIQUE NOT NULL,
    specification TEXT NOT NULL,
    medium TEXT NOT NULL,
    volume REAL NOT NULL,
    max_weight REAL NOT NULL,
    tare_weight REAL NOT NULL,
    manufacture_date DATE NOT NULL,
    next_inspection_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'idle',
    current_location TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  db.run(`CREATE TABLE inspections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cylinder_id INTEGER NOT NULL,
    inspector_id INTEGER NOT NULL,
    inspection_date DATE NOT NULL,
    next_inspection_date DATE NOT NULL,
    result TEXT NOT NULL,
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  db.run(`CREATE TABLE filling_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_no TEXT UNIQUE NOT NULL,
    operator_id INTEGER NOT NULL,
    filling_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'processing',
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  db.run(`CREATE TABLE filling_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER NOT NULL,
    cylinder_id INTEGER NOT NULL,
    operator_id INTEGER NOT NULL,
    filling_weight REAL NOT NULL,
    is_overweight BOOLEAN NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    filled_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  db.run(`CREATE TABLE deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    delivery_no TEXT UNIQUE NOT NULL,
    delivery_person_id INTEGER NOT NULL,
    customer_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    delivered_at DATETIME,
    signed_by TEXT
  )`);
  
  db.run(`CREATE TABLE delivery_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    delivery_id INTEGER NOT NULL,
    cylinder_id INTEGER NOT NULL,
    filling_record_id INTEGER NOT NULL
  )`);
  
  db.run(`CREATE TABLE customer_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    cylinder_id INTEGER NOT NULL,
    received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'in_stock'
  )`);
  
  const stmt1 = db.prepare('INSERT INTO users (username, name, role) VALUES (?, ?, ?)');
  stmt1.run('operator1', '张三', 'operator');
  stmt1.run('inspector1', '李四', 'inspector');
  stmt1.run('delivery1', '王五', 'delivery');
  stmt1.finalize();
  
  const stmt2 = db.prepare('INSERT INTO customers (name, contact, address) VALUES (?, ?, ?)');
  stmt2.run('华盛机械厂', '刘经理 13800138001', '北京市朝阳区建国路88号');
  stmt2.run('顺达物流公司', '王总 13900139002', '上海市浦东新区张江路100号');
  stmt2.finalize();
  
  const today = new Date();
  const nextYear = new Date(today);
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  const lastMonth = new Date(today);
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  const lastYear = new Date(today);
  lastYear.setFullYear(lastYear.getFullYear() - 1);
  
  const ds = (d) => d.toISOString().split('T')[0];
  
  const stmt3 = db.prepare(`INSERT INTO cylinders 
    (cylinder_code, specification, medium, volume, max_weight, tare_weight, 
     manufacture_date, next_inspection_date, status, current_location)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  
  stmt3.run('QP-2024-0001', 'WMA219-40-15', '氧气', 40.0, 55.0, 48.0, '2020-01-15', ds(nextYear), 'idle', '充装站');
  stmt3.run('QP-2024-0002', 'WMA219-40-15', '氮气', 40.0, 52.0, 47.5, '2021-03-20', ds(nextYear), 'idle', '充装站');
  stmt3.run('QP-2024-0003', 'WMA219-40-20', '氩气', 40.0, 60.0, 49.0, '2019-06-10', ds(lastMonth), 'expired', '充装站');
  stmt3.run('QP-2024-0004', 'WMA219-40-15', '二氧化碳', 40.0, 58.0, 48.5, '2022-02-28', ds(lastYear), 'expired', '充装站');
  stmt3.run('QP-2024-0005', 'WMA219-40-15', '氧气', 40.0, 55.0, 47.8, '2023-05-15', ds(nextYear), 'idle', '充装站');
  stmt3.finalize();
  
  console.log('数据库初始化和数据导入成功！');
  console.log('');
  console.log('表列表:');
  db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
    if (err) {
      console.error(err);
    } else {
      rows.forEach(row => console.log('  -', row.name));
    }
  });
});

db.close((err) => {
  if (err) {
    console.error('关闭数据库失败:', err);
    process.exit(1);
  } else {
    console.log('');
    console.log('数据库已关闭，初始化完成！');
    process.exit(0);
  }
});
