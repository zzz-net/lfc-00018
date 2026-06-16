# 设计稿评审排队板

一个本地设计稿评审排队管理系统，支持设计稿导入、状态流转、评论记录、权限区分和纪要导出。

## 技术栈

- **前端**: React 18 + TypeScript + Vite + Tailwind CSS + Zustand
- **后端**: Express 4 + TypeScript + better-sqlite3（同步 SQLite）
- **认证**: Session + better-sqlite3-session-store
- **文件上传**: multer + memoryStorage

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动后端服务

```bash
npm run server:dev
```

后端服务默认运行在 `http://localhost:3001`，数据库文件为 `./data/review-board.db`（首次启动自动创建）。

### 3. 启动前端开发服务

```bash
npm run client:dev
```

前端服务默认运行在 `http://localhost:5173`（5174/5175 也可能被使用），通过 Vite 代理转发 `/api` 请求到后端。

### 4. 访问应用

浏览器打开 `http://localhost:5173`（以前端终端实际显示的端口为准）。

## 预设账号

系统首次启动时自动创建以下测试账号：

| 用户名 | 密码 | 角色 | 姓名 |
|--------|------|------|------|
| `admin` | `admin123` | 管理员 | 系统管理员 |
| `reviewer1` | `reviewer123` | 评审人 | 张评审 |
| `reviewer2` | `reviewer123` | 评审人 | 李评审 |
| `submitter1` | `submitter123` | 提交者 | 王设计 |
| `submitter2` | `submitter123` | 提交者 | 刘设计 |

> 登录失败时会提示「用户名或密码错误」，状态码 401。

## 权限说明

- **管理员**: 导入设计稿、管理用户、查看全部设计稿、导出评审纪要
- **评审人**: 认领设计稿、评审（通过/退回）、添加评论
- **提交者**: 查看自己的设计稿、重新提交、添加评论

## CSV 导入

### 表头格式

CSV 文件**必须**包含以下列（列名大小写不敏感）：

| 列名 | 必填 | 说明 |
|------|------|------|
| `designId` | ✅ | 设计稿唯一 ID，重复则视为冲突 |
| `name` | ✅ | 设计稿名称 |
| `submitter` | ✅ | 提交者（支持用户名或真实姓名） |
| `description` | ❌ | 设计稿描述，默认为空 |
| `priority` | ❌ | 优先级：`high` / `medium` / `low`，默认 `medium` |

### 示例 CSV

```csv
designId,name,description,submitter,priority
DES-001,用户中心设计稿,用户中心页面设计,王设计,high
DES-002,订单列表设计稿,订单列表页面设计,submitter1,medium
DES-003,商品详情设计稿,商品详情页面设计,刘设计,low
```

### 界面操作

1. 使用管理员账号登录
2. 点击顶部工具栏的 **「导入」** 按钮
3. 选择 CSV 文件或拖拽到上传区域
4. 预览数据和冲突检测结果
5. 点击 **「确认导入」** 完成导入

### 导入结果

导入成功后会显示：
- 成功导入数量
- 冲突数量及详情（重复 `designId` 会被跳过，不会覆盖已有数据和评论）

### 常见错误提示

| 场景 | 提示信息 | HTTP 状态码 |
|------|----------|-------------|
| 文件不是 CSV 格式 | `只支持CSV格式文件` | 400 |
| CSV 缺少必要列（如没有 designId） | `CSV缺少必要列: designid, submitter` | 400 |
| CSV 为空或只有表头 | `CSV文件内容为空或格式不正确` | 400 |
| 某行数据不完整 | `第X行数据不完整，designId、名称和提交者不能为空` | 400 |
| 提交者不存在 | `提交者 XXX 不存在，请检查用户名或姓名是否正确` | 400 |
| 文件太大（超过 10MB） | `文件大小超过限制（最大10MB）` | 400 |
| 上传解析失败 | `文件上传失败，请检查文件格式后重试` | 400 |
| 无权限（非管理员） | `权限不足` | 403 |
| 未登录 | 重定向到登录页 | 401 |

## 设计稿状态流转

```
pending_claim → reviewing → passed
                    ↓
                 returned → pending_review → reviewing → ...
```

| 状态 | 说明 |
|------|------|
| `pending_claim` | 待认领，等待评审人认领 |
| `reviewing` | 评审中，评审人正在评审 |
| `returned` | 退回修改，等待提交者修改后重新提交 |
| `pending_review` | 待复审，提交者重新提交后回到原评审人 |
| `passed` | 已通过 |

## 主要功能

- ✅ 设计稿清单导入（CSV 格式）
- ✅ 五状态流转（待认领 → 评审中 → 退回 → 待复审 → 通过）
- ✅ 提交者 / 评审人 / 管理员 三角色权限
- ✅ 评论历史记录
- ✅ 重复 `designId` 冲突检测，旧评论不覆盖
- ✅ 乐观锁并发控制（同时认领只有一个成功）
- ✅ 评审纪要导出（Markdown 格式）
- ✅ 队列顺序保留（按导入顺序排列）

## API 说明

### 认证

- `POST /api/auth/login` - 登录
- `POST /api/auth/logout` - 登出
- `GET /api/auth/me` - 获取当前用户

### 设计稿

- `GET /api/designs` - 获取设计稿列表
- `GET /api/designs/:id` - 获取单个设计稿详情
- `POST /api/designs/import` - 导入设计稿（支持 FormData CSV 文件 或 JSON 数组）
- `POST /api/designs/:id/claim` - 认领设计稿
- `POST /api/designs/:id/review` - 评审（通过/退回）
- `POST /api/designs/:id/resubmit` - 重新提交
- `GET /api/designs/export` - 导出评审纪要（Markdown）

### 评论

- `GET /api/designs/:id/comments` - 获取评论列表
- `POST /api/designs/:id/comments` - 添加评论

## 验证

### 端到端验证脚本

项目包含端到端验证脚本，可验证登录、导入、冲突检测、错误提示等完整链路：

```bash
node verify-e2e.mjs
```

### FormData 导入回归测试

```bash
node test-formdata-import.mjs
```

包含 8 个测试用例：成功导入、队列顺序、冲突检测、旧评论不覆盖、错误格式、缺列、空文件、不上传文件。

## 项目结构

```
.
├── api/                    # 后端代码
│   ├── controllers/       # 控制器
│   ├── services/          # 业务逻辑
│   ├── repositories/      # 数据访问
│   ├── middleware/        # 中间件
│   └── db/                # 数据库
├── src/                   # 前端代码
│   ├── components/        # 组件
│   ├── pages/             # 页面
│   ├── store/             # 状态管理
│   └── api/               # API 调用
├── shared/                # 共享类型定义
└── data/                  # 数据库文件目录
```
