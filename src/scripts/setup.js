const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'cylinder.db');

if (fs.existsSync(dbPath)) {
  console.log('检测到现有数据库，正在删除...');
  fs.unlinkSync(dbPath);
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
    process.exit(1);
  } else {
    console.log('数据库连接成功');
  }
});

db.serialize(() => {
  db.run('PRAGMA foreign_keys = ON');

  console.log('正在创建数据表...');

  db.run(`CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('operator', 'inspector', 'delivery')),
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
    status TEXT NOT NULL DEFAULT 'idle' CHECK(status IN ('idle', 'filling', 'filled', 'delivering', 'at_customer', 'inspecting', 'expired', 'scrapped')),
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
    result TEXT NOT NULL CHECK(result IN ('pass', 'fail')),
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cylinder_id) REFERENCES cylinders(id),
    FOREIGN KEY (inspector_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE filling_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_no TEXT UNIQUE NOT NULL,
    operator_id INTEGER NOT NULL,
    filling_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'processing' CHECK(status IN ('processing', 'completed', 'cancelled')),
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (operator_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE filling_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER NOT NULL,
    cylinder_id INTEGER NOT NULL,
    operator_id INTEGER NOT NULL,
    filling_weight REAL NOT NULL,
    is_overweight BOOLEAN NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
    filled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES filling_batches(id),
    FOREIGN KEY (cylinder_id) REFERENCES cylinders(id),
    FOREIGN KEY (operator_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE deliveries (
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

  db.run(`CREATE TABLE delivery_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    delivery_id INTEGER NOT NULL,
    cylinder_id INTEGER NOT NULL,
    filling_record_id INTEGER NOT NULL,
    FOREIGN KEY (delivery_id) REFERENCES deliveries(id),
    FOREIGN KEY (cylinder_id) REFERENCES cylinders(id),
    FOREIGN KEY (filling_record_id) REFERENCES filling_records(id)
  )`);

  db.run(`CREATE TABLE customer_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    cylinder_id INTEGER NOT NULL,
    received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'in_stock' CHECK(status IN ('in_stock', 'returned')),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (cylinder_id) REFERENCES cylinders(id)
  )`);

  db.run(`CREATE INDEX idx_cylinder_code ON cylinders(cylinder_code)`);
  db.run(`CREATE INDEX idx_cylinder_status ON cylinders(status)`);
  db.run(`CREATE INDEX idx_inspection_cylinder ON inspections(cylinder_id)`);
  db.run(`CREATE INDEX idx_filling_batch ON filling_records(batch_id)`);
  db.run(`CREATE INDEX idx_delivery_customer ON deliveries(customer_id)`);

  console.log('✅ 数据表创建完成');
  console.log('');

  console.log('正在导入初始化数据...');
  console.log('');

  const stmtUsers = db.prepare('INSERT INTO users (username, name, role) VALUES (?, ?, ?)');
  stmtUsers.run('operator1', '张三', 'operator');
  stmtUsers.run('inspector1', '李四', 'inspector');
  stmtUsers.run('delivery1', '王五', 'delivery');
  stmtUsers.finalize();

  const stmtCustomers = db.prepare('INSERT INTO customers (name, contact, address) VALUES (?, ?, ?)');
  stmtCustomers.run('华盛机械厂', '刘经理 13800138001', '北京市朝阳区建国路88号');
  stmtCustomers.run('顺达物流公司', '王总 13900139002', '上海市浦东新区张江路100号');
  stmtCustomers.finalize();

  const today = new Date();
  const nextYear = new Date(today);
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  const lastMonth = new Date(today);
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  const lastYear = new Date(today);
  lastYear.setFullYear(lastYear.getFullYear() - 1);

  const dateStr = (d) => d.toISOString().split('T')[0];

  const stmtCylinders = db.prepare(`INSERT INTO cylinders 
    (cylinder_code, specification, medium, volume, max_weight, tare_weight, 
     manufacture_date, next_inspection_date, status, current_location)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  stmtCylinders.run('QP-2024-0001', 'WMA219-40-15', '氧气', 40.0, 55.0, 48.0, '2020-01-15', dateStr(nextYear), 'idle', '充装站');
  stmtCylinders.run('QP-2024-0002', 'WMA219-40-15', '氮气', 40.0, 52.0, 47.5, '2021-03-20', dateStr(nextYear), 'idle', '充装站');
  stmtCylinders.run('QP-2024-0003', 'WMA219-40-20', '氩气', 40.0, 60.0, 49.0, '2019-06-10', dateStr(lastMonth), 'expired', '充装站');
  stmtCylinders.run('QP-2024-0004', 'WMA219-40-15', '二氧化碳', 40.0, 58.0, 48.5, '2022-02-28', dateStr(lastYear), 'expired', '充装站');
  stmtCylinders.run('QP-2024-0005', 'WMA219-40-15', '氧气', 40.0, 55.0, 47.8, '2023-05-15', dateStr(nextYear), 'idle', '充装站');
  stmtCylinders.finalize();

  console.log('✅ 初始化数据导入成功');
  console.log('');

  console.log('═══════════════════════════════════════════');
  console.log('           初始化数据汇总');
  console.log('═══════════════════════════════════════════');
  console.log('');
  console.log('👤 用户数据:');
  console.log('   1. 张三 - 充装站操作员 (username: operator1)');
  console.log('   2. 李四 - 检验员 (username: inspector1)');
  console.log('   3. 王五 - 配送员 (username: delivery1)');
  console.log('');
  console.log('🏭 客户数据:');
  console.log('   1. 华盛机械厂');
  console.log('   2. 顺达物流公司');
  console.log('');
  console.log('🛢️  气瓶数据:');
  console.log('   1. QP-2024-0001: 氧气, 检验有效 ✓');
  console.log('   2. QP-2024-0002: 氮气, 检验有效 ✓');
  console.log('   3. QP-2024-0003: 氩气, 检验已过期 ✗ (上月到期)');
  console.log('   4. QP-2024-0004: 二氧化碳, 检验已过期 ✗ (去年到期)');
  console.log('   5. QP-2024-0005: 氧气, 检验有效 ✓');
  console.log('');

  db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", (err, tables) => {
    if (err) {
      console.error('查询表列表失败:', err);
    } else {
      console.log('📋 已创建的数据表:');
      tables.forEach(t => console.log('   -', t.name));
      console.log('');
    }

    const checks = [
      { table: 'users', label: '用户' },
      { table: 'customers', label: '客户' },
      { table: 'cylinders', label: '气瓶' },
      { table: 'filling_batches', label: '充装批次' },
      { table: 'filling_records', label: '充装记录' },
      { table: 'deliveries', label: '配送单' },
      { table: 'customer_inventory', label: '客户库存' }
    ];

    let completed = 0;
    checks.forEach(check => {
      db.get(`SELECT COUNT(*) as count FROM ${check.table}`, (err, row) => {
        if (err) {
          console.error(`查询${check.label}数据失败:`, err);
        } else {
          console.log(`✅ ${check.table} 表可用，当前记录数: ${row.count}`);
        }
        completed++;
        if (completed === checks.length) {
          db.close((closeErr) => {
            if (closeErr) {
              console.error('关闭数据库失败:', closeErr);
              process.exit(1);
            } else {
              console.log('');
              console.log('═══════════════════════════════════════════');
              console.log('🎉 数据库初始化完成！所有表已就绪');
              console.log('═══════════════════════════════════════════');
              console.log('');
              console.log('下一步操作:');
              console.log('  PORT=3008 npm start    # 启动服务');
              console.log('  npm test               # 运行验收验证');
              process.exit(0);
            }
          });
        }
      });
    });
  });
});
