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

## 成员 CSV 批量导入

管理员可以通过 CSV 文件批量创建用户，系统提供完整的字段映射、预检查、错误导出、草稿恢复和操作日志功能。

### 导入流程

导入采用 **4 步向导式** 界面：

1. **选择文件**：拖拽或点击上传 CSV 文件
2. **字段映射**：将 CSV 表头映射到系统字段（支持自动识别中英文）
3. **预检查**：逐行校验数据质量，展示全部错误原因
4. **导入结果**：显示成功、跳过、失败的数量及明细

### 支持的系统字段

| 字段名 | 必填 | 说明 |
|--------|------|------|
| `username` | ✅ | 登录用户名，全局唯一 |
| `name` | ✅ | 真实姓名，系统内唯一 |
| `role` | ✅ | 角色：`admin` / `reviewer` / `submitter`（或中文：管理员/评审人/提交者） |
| `email` | ❌ | 电子邮箱，若提供需唯一且格式有效 |
| `password` | ❌ | 登录密码，若为空将使用默认密码 `user123456` |

### 预检查校验规则

系统在导入前会执行全面校验，**所有问题都会在弹窗中逐条展示原因**，不会只给模糊提示：

| 错误类型 | 说明 |
|----------|------|
| `MISSING_REQUIRED_COLUMN` | CSV 缺少必填列（如没有用户名字段） |
| `UNKNOWN_HEADER` | 存在未识别的表头列，可手动选择映射或忽略 |
| `EMPTY_REQUIRED_FIELD` | 必填字段为空 |
| `INVALID_ROLE` | 角色值不是支持的类型 |
| `INVALID_EMAIL` | 邮箱格式不正确 |
| `WEAK_PASSWORD` | 密码长度不足 6 位 |
| `USERNAME_EXISTS` | 用户名已在系统中存在 |
| `NAME_EXISTS` | 姓名已在系统中存在 |
| `EMAIL_EXISTS` | 邮箱已在系统中存在 |
| `ROW_INTERNAL_DUP_USERNAME` | CSV 文件内用户名重复 |
| `ROW_INTERNAL_DUP_NAME` | CSV 文件内姓名重复 |
| `ROW_INTERNAL_DUP_EMAIL` | CSV 文件内邮箱重复 |

### 错误行导出

校验不通过的行可以**单独导出为带错误说明的 CSV**，方便修改后重新导入：

- 导出的 CSV 首列是**行号**，方便定位原始文件
- 保留所有原始数据列
- 末尾增加 **"错误原因"** 列，多个错误用中文分号分隔
- 文件带 UTF-8 BOM，Excel/WPS 直接打开不乱码

### 可恢复草稿

导入过程中的进度会自动保存为草稿，**应用重启后可以继续**：

- 保存内容：CSV 原始内容、字段映射选择、预检查结果
- 保存时机：字段映射变更、预检查完成后自动保存（debounce 600ms）
- 恢复方式：页面顶部出现琥珀色提示条，点击「继续导入」即可恢复
- 安全保障：草稿存在独立的 `import_drafts` 表，**正式提交前不会写入 `users` 表**
- 自动清理：导入成功后自动清除草稿

### 管理员操作日志

所有导入操作都会记录到管理员操作日志，可在「操作日志」弹窗中查看：

- 操作人、操作时间
- 导入的文件名
- 成功数量、跳过数量、失败数量
- 跳过的具体原因和行号
- 创建的用户 ID 列表

### 界面操作

1. 使用管理员账号登录
2. 进入 **「用户管理」** 页面
3. 点击顶部的 **「批量导入」** 按钮
4. 选择 CSV 文件 → 确认字段映射 → 查看预检查结果
5. （可选）导出错误行修改后重新导入
6. 点击 **「确认导入」** 完成
7. 点击 **「操作日志」** 查看历史导入记录

### 示例 CSV

```csv
用户名,姓名,角色,邮箱,备注
zhangsan,张三,管理员,zhangsan@example.com,测试用户1
lisi,李四,评审人,lisi@example.com,测试用户2
wangwu,王五,提交者,wangwu@example.com,测试用户3
```

## 设计稿 CSV 导入

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
- ✅ 成员批量导入（CSV + 字段映射 + 预检查 + 错误导出）
- ✅ 五状态流转（待认领 → 评审中 → 退回 → 待复审 → 通过）
- ✅ 提交者 / 评审人 / 管理员 三角色权限
- ✅ 评论历史记录
- ✅ 重复 `designId` 冲突检测，旧评论不覆盖
- ✅ 乐观锁并发控制（同时认领只有一个成功）
- ✅ 评审纪要导出（Markdown 格式）
- ✅ 队列顺序保留（按导入顺序排列）
- ✅ 可恢复导入草稿（应用重启后可继续）
- ✅ 管理员操作日志（导入 / 创建 / 更新 / 删除）

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

### 用户管理

- `GET /api/users` - 获取用户列表
- `POST /api/users` - 创建用户
- `PUT /api/users/:id` - 更新用户
- `DELETE /api/users/:id` - 删除用户

#### 成员导入

- `POST /api/users/import/precheck` - CSV 预检查（支持 FormData 文件上传 或 JSON rawCsv）
- `POST /api/users/import/submit` - 正式提交导入
- `POST /api/users/import/export-errors` - 导出错误行 CSV
- `GET /api/users/import/draft` - 获取导入草稿
- `POST /api/users/import/draft` - 保存导入草稿
- `DELETE /api/users/import/draft` - 清除导入草稿

#### 操作日志

- `GET /api/users/admin-logs` - 获取管理员操作日志（支持 `?type=user_import` 筛选）

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
