// AI Key 加载与轮询管理（被 ai-analyze / auto-diagnose / smart-search / mcp 共享）
// 多 API Key 轮询：从本地私有文件 electron/api-keys.cjs 读取，避免 Key 进入 Git 仓库
// 该文件已加入 .gitignore，但会被 electron-builder 打包进应用，因此发布版本仍可正常使用
// 注意：必须使用 .cjs 扩展名！因为 package.json 声明了 "type": "module"，
//       .js 文件会被当作 ESM，require() 无法获取 module.exports 内容。
// 若文件缺失，则尝试从环境变量 AGNES_API_KEYS（逗号分隔）读取

const AGNES_API_URL = 'https://apihub.agnes-ai.com/v1/chat/completions';

let AGNES_API_KEYS = [];
try {
  const localKeys = require('../api-keys.cjs');
  if (Array.isArray(localKeys?.AGNES_API_KEYS) && localKeys.AGNES_API_KEYS.length > 0) {
    AGNES_API_KEYS = localKeys.AGNES_API_KEYS;
  }
} catch (e) {
  console.warn('[AI] 未找到 electron/api-keys.cjs，将尝试从环境变量读取 API Keys');
}
if (AGNES_API_KEYS.length === 0 && process.env.AGNES_API_KEYS) {
  AGNES_API_KEYS = process.env.AGNES_API_KEYS.split(',').map(k => k.trim()).filter(Boolean);
}
if (AGNES_API_KEYS.length === 0) {
  console.error('[AI] 未配置 Agnes API Keys，AI 日志分析功能将不可用。请创建 electron/api-keys.js 或设置 AGNES_API_KEYS 环境变量。');
}

// 轮询索引：随机起点，避免所有实例首次都打到同一个 Key
let agnesKeyIndex = AGNES_API_KEYS.length > 0 ? Math.floor(Math.random() * AGNES_API_KEYS.length) : 0;

// 加载时快照：MCP 的 ai_analyze 非流式接口使用此 Key（与原 main.cjs 行为保持一致）
const AGNES_API_KEY = AGNES_API_KEYS.length > 0 ? AGNES_API_KEYS[agnesKeyIndex] : '';

// 获取当前 Key（不递增）
function getCurrentApiKey() {
  if (AGNES_API_KEYS.length === 0) return '';
  return AGNES_API_KEYS[agnesKeyIndex];
}

// 获取下一个 API Key（轮询）
function getNextApiKey() {
  if (AGNES_API_KEYS.length === 0) return '';
  agnesKeyIndex = (agnesKeyIndex + 1) % AGNES_API_KEYS.length;
  return AGNES_API_KEYS[agnesKeyIndex];
}

const AGNES_MODEL = 'agnes-2.0-flash';
const AI_MAX_LOG_LINES = 8000;
// 对话上下文最大消息数（超出时保留最早的 system + 最近的消息）
const AI_MAX_CONTEXT_MESSAGES = 20;
// AI 对话上下文字节总量上限 2MB（防止超长消息累积导致内存/Token 失控）
const AI_MAX_CONTEXT_BYTES = 2 * 1024 * 1024;

module.exports = {
  AGNES_API_URL,
  AGNES_API_KEYS,
  AGNES_API_KEY,
  AGNES_MODEL,
  AI_MAX_LOG_LINES,
  AI_MAX_CONTEXT_MESSAGES,
  AI_MAX_CONTEXT_BYTES,
  getAgnesKeyIndex: () => agnesKeyIndex,
  getCurrentApiKey,
  getNextApiKey,
};
