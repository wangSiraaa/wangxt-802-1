const fs = require('fs');
const path = require('path');

const routeContent = `const express = require('express');
const router = express.Router();
const FillingService = require('../services/fillingService');

router.post('/fillings/records/idempotent', async (req, res) => {
  try {
    const { idempotency_key, ...data } = req.body;
    
    if (!idempotency_key) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少幂等键 idempotency_key' 
      });
    }

    const result = await FillingService.addFillingRecordIdempotent(data, idempotency_key);
    
    if (result.status === 'failed') {
      return res.status(400).json({ 
        success: false, 
        error: result.error_message || '处理失败',
        data: result 
      });
    }
    
    if (result.response_data && result.response_data.status === 'rejected') {
      return res.status(400).json({ 
        success: false, 
        error: result.response_data.warning || '充装被拒绝',
        data: result 
      });
    }
    
    if (result.idempotent) {
      return res.status(200).json({ success: true, data: result });
    }
    
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/fillings/idempotent', async (req, res) => {
  try {
    const submissions = await FillingService.getAllIdempotentSubmissions(req.query);
    res.json({ success: true, data: submissions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/fillings/idempotent/:id', async (req, res) => {
  try {
    const submission = await FillingService.getIdempotentSubmissionDetail(req.params.id);
    if (!submission) {
      return res.status(404).json({ success: false, error: '幂等提交记录不存在' });
    }
    res.json({ success: true, data: submission });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/fillings/idempotent/key/:key', async (req, res) => {
  try {
    const submission = await FillingService.getIdempotentSubmission(req.params.key);
    if (!submission) {
      return res.status(404).json({ success: false, error: '幂等提交记录不存在' });
    }
    
    let parsed = { ...submission };
    try {
      if (submission.request_body) parsed.request_body = JSON.parse(submission.request_body);
      if (submission.before_state) parsed.before_state = JSON.parse(submission.before_state);
      if (submission.after_state) parsed.after_state = JSON.parse(submission.after_state);
      if (submission.response_data) parsed.response_data = JSON.parse(submission.response_data);
    } catch (e) {}
    
    res.json({ success: true, data: parsed });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
`;

const routePath = path.join(__dirname, 'src/routes/idempotent.js');
fs.writeFileSync(routePath, routeContent);
console.log('路由文件创建成功:', routePath);

const serverPath = path.join(__dirname, 'src/server.js');
let serverContent = fs.readFileSync(serverPath, 'utf8');

if (!serverContent.includes("idempotentRoutes")) {
  serverContent = serverContent.replace(
    "const customerRoutes = require('./routes/customers');",
    "const customerRoutes = require('./routes/customers');\nconst idempotentRoutes = require('./routes/idempotent');"
  );
  
  serverContent = serverContent.replace(
    "app.use('/api/customers', customerRoutes);",
    "app.use('/api/customers', customerRoutes);\napp.use('/api', idempotentRoutes);"
  );
  
  fs.writeFileSync(serverPath, serverContent);
  console.log('server.js 已更新，注册了幂等路由');
} else {
  console.log('server.js 已包含幂等路由，无需更新');
}

console.log('完成！');
