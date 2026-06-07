# 工业气瓶充装追溯 API 服务

工业气瓶充装全流程追溯管理系统后端服务，实现气瓶档案管理、检验复核、充装登记、配送签收的完整业务链路。

## 功能特性

### 核心业务流程
1. **气瓶档案管理** - 充装站操作员提交气瓶档案信息
2. **检验复核** - 检验员复核检验有效期，过期气瓶自动标记
3. **充装登记** - 充装重量超限自动报警，过期气瓶禁止充装
4. **配送签收** - 配送员读取充装批次结果，签收后进入客户库存

### 业务边界规则
- ✅ **检验过期气瓶禁止充装** - 系统自动校验下次检验日期
- ✅ **充装重量超限要报警** - 根据气瓶参数自动计算最大允许充装量
- ✅ **配送签收后才能进入客户库存** - 事务保障，确保数据一致性

## 技术栈

- **运行时**: Node.js 14+
- **Web框架**: Express.js
- **数据库**: SQLite3
- **数据格式**: JSON

## 项目结构

```
.
├── package.json
├── README.md
├── data/                           # 数据库文件目录
│   └── cylinder.db                 # SQLite 数据库文件（运行后生成）
└── src/
    ├── server.js                   # 服务入口
    ├── models/
    │   └── database.js             # 数据库连接
    ├── routes/                     # API 路由层
    │   ├── cylinders.js            # 气瓶档案接口
    │   ├── inspections.js          # 检验复核接口
    │   ├── fillings.js             # 充装登记接口
    │   ├── deliveries.js           # 配送管理接口
    │   ├── users.js                # 用户管理接口
    │   └── customers.js            # 客户管理接口
    ├── services/                   # 业务逻辑层
    │   ├── cylinderService.js      # 气瓶业务逻辑
    │   ├── inspectionService.js    # 检验业务逻辑
    │   ├── fillingService.js       # 充装业务逻辑
    │   └── deliveryService.js      # 配送业务逻辑
    └── scripts/                    # 脚本工具
        ├── initDB.js               # 数据库初始化
        ├── seedData.js             # 初始化测试数据
        └── verify.js               # 验收验证脚本
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
npm run init
```

### 3. 导入初始化数据

```bash
npm run seed
```

初始化数据包含：
- **用户**: 充装站操作员(张三)、检验员(李四)、配送员(王五)
- **客户**: 华盛机械厂、顺达物流公司
- **气瓶**: 5个气瓶，其中2个检验过期，3个检验有效

### 4. 启动服务

```bash
npm start
```

服务默认运行在 `http://localhost:3000`

### 5. 验证服务

```bash
# 健康检查
curl http://localhost:3000/api/health
```

## API 接口文档

### 健康检查

```
GET /api/health
```

### 气瓶档案管理

```
GET    /api/cylinders              # 获取气瓶列表
GET    /api/cylinders/:id          # 获取单个气瓶详情
GET    /api/cylinders/code/:code   # 按编码查询气瓶
POST   /api/cylinders              # 新增气瓶档案
PUT    /api/cylinders/:id          # 更新气瓶信息
GET    /api/cylinders/:id/inspection-check  # 检查检验是否过期
POST   /api/cylinders/:id/check-weight      # 检查充装重量是否超限
```

### 检验复核

```
GET    /api/inspections            # 获取检验记录列表
GET    /api/inspections/:id        # 获取检验记录详情
POST   /api/inspections            # 新增检验记录
GET    /api/inspections/verify/:cylinderId  # 复核气瓶检验有效期
```

### 充装登记

```
GET    /api/fillings/batches       # 获取充装批次列表
GET    /api/fillings/batches/:id   # 获取充装批次详情
GET    /api/fillings/batches/:id/records  # 获取批次充装记录
POST   /api/fillings/batches       # 创建充装批次
POST   /api/fillings/records       # 登记充装记录（自动校验有效期和重量）
PUT    /api/fillings/batches/:id/complete  # 完成充装批次
```

### 配送管理

```
GET    /api/deliveries             # 获取配送单列表
GET    /api/deliveries/:id         # 获取配送单详情
GET    /api/deliveries/:id/items   # 获取配送明细
POST   /api/deliveries             # 创建配送单
PUT    /api/deliveries/:id/start   # 开始配送
PUT    /api/deliveries/:id/sign    # 配送签收（自动入库）
GET    /api/deliveries/inventory/customer/:customerId  # 查询客户库存
```

### 用户管理

```
GET    /api/users                  # 获取用户列表
GET    /api/users/:id              # 获取用户详情
POST   /api/users                  # 新增用户
```

### 客户管理

```
GET    /api/customers              # 获取客户列表
GET    /api/customers/:id          # 获取客户详情
POST   /api/customers              # 新增客户
```

## 验收路径

### 使用过期气瓶登记充装并验证被拒绝

#### 运行验收脚本

```bash
# 确保服务已启动
npm start

# 新开一个终端，运行验证脚本
npm test
```

#### 手动验证步骤

1. **查询过期气瓶**
   ```bash
   curl http://localhost:3000/api/cylinders?status=expired
   ```

2. **复核过期气瓶检验状态**
   ```bash
   # 替换 {cylinderId} 为实际过期气瓶ID
   curl http://localhost:3000/api/inspections/verify/{cylinderId}
   ```
   预期返回: `is_expired: true, can_fill: false`

3. **创建充装批次**
   ```bash
   curl -X POST http://localhost:3000/api/fillings/batches \
     -H "Content-Type: application/json" \
     -d '{"operator_id": 1, "remarks": "验收测试"}'
   ```

4. **使用过期气瓶充装（应被拒绝）**
   ```bash
   # 替换 {batchId} 和 {cylinderId} 为实际ID
   curl -X POST http://localhost:3000/api/fillings/records \
     -H "Content-Type: application/json" \
     -d '{"batch_id": {batchId}, "cylinder_id": {cylinderId}, "operator_id": 1, "filling_weight": 5.0}'
   ```
   预期返回: HTTP 400，错误信息包含"检验已过期，禁止充装"

## 数据模型

### 气瓶 (cylinders)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| cylinder_code | TEXT | 气瓶编号（唯一） |
| specification | TEXT | 规格型号 |
| medium | TEXT | 介质 |
| volume | REAL | 容积(L) |
| max_weight | REAL | 最大重量(kg) |
| tare_weight | REAL | 瓶重(kg) |
| manufacture_date | DATE | 制造日期 |
| next_inspection_date | DATE | 下次检验日期 |
| status | TEXT | 状态: idle/filling/filled/delivering/at_customer/expired/scrapped |

### 充装记录 (filling_records)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| batch_id | INTEGER | 批次ID |
| cylinder_id | INTEGER | 气瓶ID |
| filling_weight | REAL | 充装重量(kg) |
| is_overweight | BOOLEAN | 是否超重 |
| status | TEXT | 状态: pending/approved/rejected |

### 配送单 (deliveries)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| delivery_no | TEXT | 配送单号 |
| customer_id | INTEGER | 客户ID |
| status | TEXT | 状态: pending/in_transit/delivered/returned |
| signed_by | TEXT | 签收人 |
| delivered_at | DATETIME | 签收时间 |

### 客户库存 (customer_inventory)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| customer_id | INTEGER | 客户ID |
| cylinder_id | INTEGER | 气瓶ID |
| received_at | DATETIME | 入库时间（签收时自动写入） |
| status | TEXT | 状态: in_stock/returned |

## 核心业务逻辑说明

### 1. 检验过期判断
- 系统每日自动比对 `next_inspection_date` 与当前日期
- 创建充装记录时强制执行校验，过期气瓶直接拒绝
- 检验复核通过后更新气瓶下次检验日期和状态

### 2. 充装重量校验
- 最大允许充装量 = `max_weight` - `tare_weight`
- 充装重量超过允许值时标记为 `is_overweight = 1`，状态设为 `rejected`
- 返回详细的重量检查信息，便于前端提示用户

### 3. 配送签收事务
- 签收操作使用数据库事务保障数据一致性
- 签收成功后自动：
  1. 更新配送单状态为 `delivered`
  2. 记录签收人和签收时间
  3. 气瓶状态更新为 `at_customer`
  4. 写入客户库存表

## 运行验证测试

```bash
# 完整测试流程
npm run init      # 初始化数据库
npm run seed      # 导入测试数据
npm start         # 启动服务
npm test          # 运行验收验证脚本
```

## 许可证

MIT License
