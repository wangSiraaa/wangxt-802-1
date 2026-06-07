const db = require('../models/database');

const seedData = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      const users = [
        { username: 'operator1', name: '张三', role: 'operator' },
        { username: 'inspector1', name: '李四', role: 'inspector' },
        { username: 'delivery1', name: '王五', role: 'delivery' }
      ];

      const customers = [
        { name: '华盛机械厂', contact: '刘经理 13800138001', address: '北京市朝阳区建国路88号' },
        { name: '顺达物流公司', contact: '王总 13900139002', address: '上海市浦东新区张江路100号' }
      ];

      const today = new Date();
      const nextYear = new Date(today);
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      
      const lastYear = new Date(today);
      lastYear.setFullYear(lastYear.getFullYear() - 1);
      
      const lastMonth = new Date(today);
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      const dateStr = (d) => d.toISOString().split('T')[0];

      const cylinders = [
        {
          cylinder_code: 'QP-2024-0001',
          specification: 'WMA219-40-15',
          medium: '氧气',
          volume: 40.0,
          max_weight: 55.0,
          tare_weight: 48.0,
          manufacture_date: dateStr(new Date('2020-01-15')),
          next_inspection_date: dateStr(nextYear),
          status: 'idle',
          current_location: '充装站'
        },
        {
          cylinder_code: 'QP-2024-0002',
          specification: 'WMA219-40-15',
          medium: '氮气',
          volume: 40.0,
          max_weight: 52.0,
          tare_weight: 47.5,
          manufacture_date: dateStr(new Date('2021-03-20')),
          next_inspection_date: dateStr(nextYear),
          status: 'idle',
          current_location: '充装站'
        },
        {
          cylinder_code: 'QP-2024-0003',
          specification: 'WMA219-40-20',
          medium: '氩气',
          volume: 40.0,
          max_weight: 60.0,
          tare_weight: 49.0,
          manufacture_date: dateStr(new Date('2019-06-10')),
          next_inspection_date: dateStr(lastMonth),
          status: 'expired',
          current_location: '充装站'
        },
        {
          cylinder_code: 'QP-2024-0004',
          specification: 'WMA219-40-15',
          medium: '二氧化碳',
          volume: 40.0,
          max_weight: 58.0,
          tare_weight: 48.5,
          manufacture_date: dateStr(new Date('2022-02-28')),
          next_inspection_date: dateStr(lastYear),
          status: 'expired',
          current_location: '充装站'
        },
        {
          cylinder_code: 'QP-2024-0005',
          specification: 'WMA219-40-15',
          medium: '氧气',
          volume: 40.0,
          max_weight: 55.0,
          tare_weight: 47.8,
          manufacture_date: dateStr(new Date('2023-05-15')),
          next_inspection_date: dateStr(nextYear),
          status: 'idle',
          current_location: '充装站'
        }
      ];

      const stmtUsers = db.prepare('INSERT INTO users (username, name, role) VALUES (?, ?, ?)');
      users.forEach(u => stmtUsers.run(u.username, u.name, u.role));
      stmtUsers.finalize();

      const stmtCustomers = db.prepare('INSERT INTO customers (name, contact, address) VALUES (?, ?, ?)');
      customers.forEach(c => stmtCustomers.run(c.name, c.contact, c.address));
      stmtCustomers.finalize();

      const stmtCylinders = db.prepare(`INSERT INTO cylinders 
        (cylinder_code, specification, medium, volume, max_weight, tare_weight, 
         manufacture_date, next_inspection_date, status, current_location)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      
      cylinders.forEach(c => {
        stmtCylinders.run(
          c.cylinder_code, c.specification, c.medium, c.volume, c.max_weight,
          c.tare_weight, c.manufacture_date, c.next_inspection_date, c.status, c.current_location
        );
      });
      stmtCylinders.finalize();

      console.log('初始化数据插入成功');
      console.log('');
      console.log('用户数据:');
      console.log('  - 充装站操作员: 张三 (username: operator1)');
      console.log('  - 检验员: 李四 (username: inspector1)');
      console.log('  - 配送员: 王五 (username: delivery1)');
      console.log('');
      console.log('客户数据:');
      console.log('  - 华盛机械厂');
      console.log('  - 顺达物流公司');
      console.log('');
      console.log('气瓶数据:');
      console.log('  - QP-2024-0001: 氧气, 检验有效');
      console.log('  - QP-2024-0002: 氮气, 检验有效');
      console.log('  - QP-2024-0003: 氩气, 检验已过期 (上月到期)');
      console.log('  - QP-2024-0004: 二氧化碳, 检验已过期 (去年到期)');
      console.log('  - QP-2024-0005: 氧气, 检验有效');
      console.log('');

      resolve();
    });
  });
};

seedData().then(() => {
  db.close();
  console.log('数据初始化完成');
  process.exit(0);
}).catch((err) => {
  console.error('数据初始化失败:', err);
  db.close();
  process.exit(1);
});
