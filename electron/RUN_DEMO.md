# 如何运行 Realtime API Demo

## 前置要求

1. **Node.js 20+** 已安装
2. **OpenAI API Key** - 需要设置环境变量

## 步骤

### 1. 设置 OpenAI API Key

**Windows PowerShell:**
```powershell
$env:OPENAI_API_KEY="your-api-key-here"
```

**Windows CMD:**
```cmd
set OPENAI_API_KEY=your-api-key-here
```

**或者创建 `.env` 文件（推荐）:**
在 `electron` 目录下创建 `.env` 文件：
```
OPENAI_API_KEY=your-api-key-here
```

### 2. 安装依赖（如果还没安装）

```bash
cd electron
npm install
```

### 3. 构建 Electron

```bash
npm run build
```

### 4. 运行 Electron

```bash
npm start
```

或者使用开发模式（自动重新构建）：
```bash
npm run dev
```

### 5. 打开 Demo

1. Electron 窗口打开后
2. 点击右上角的 **"Realtime Demo"** 按钮
3. 在 demo 窗口中点击 **"Connect to Realtime API"**
4. 允许麦克风权限
5. 开始说话，观察 conversation history 自动更新

## 功能说明

- **真实连接**: 连接到 OpenAI Realtime API
- **语音输入**: 实时发送你的语音
- **语音输出**: 播放 AI 的语音回复
- **自动记录**: 对话历史自动记录到 history
- **实时显示**: History 实时更新显示

## 故障排除

### 如果连接失败：

1. **检查 API Key**: 确保 `OPENAI_API_KEY` 环境变量已设置
2. **检查网络**: 确保可以访问 `api.openai.com`
3. **查看日志**: 在 demo 窗口的 Event Log 中查看错误信息

### 如果音频不工作：

1. **检查麦克风权限**: 确保 Electron 有麦克风权限
2. **检查浏览器控制台**: 按 F12 打开开发者工具查看错误

## 测试模拟功能

如果不想连接真实的 Realtime API，可以：
1. 点击 "Connect to Realtime API"（会失败，但可以测试 UI）
2. 使用 "Simulate User Message" 和 "Simulate Assistant Message" 按钮测试 history 机制








