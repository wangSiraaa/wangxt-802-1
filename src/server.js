const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const cylinderRoutes = require('./routes/cylinders');
const inspectionRoutes = require('./routes/inspections');
const fillingRoutes = require('./routes/fillings');
const deliveryRoutes = require('./routes/deliveries');
const userRoutes = require('./routes/users');
const customerRoutes = require('./routes/customers');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: '工业气瓶充装追溯 API 服务运行正常',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/cylinders', cylinderRoutes);
app.use('/api/inspections', inspectionRoutes);
app.use('/api/fillings', fillingRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/users', userRoutes);
app.use('/api/customers', customerRoutes);

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ 
    success: false, 
    error: '服务器内部错误',
    message: err.message 
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, error: '接口不存在' });
});

app.listen(PORT, () => {
  console.log(`工业气瓶充装追溯 API 服务已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
});

module.exports = app;
