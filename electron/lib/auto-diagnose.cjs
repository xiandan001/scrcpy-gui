// XBH_AI_PATCH_START
// AI 自动诊断引擎：实时检测 logcat 中的崩溃/ANR/OOM 等关键问题
// 触发后向渲染进程推送 onAutoDiagnose 事件，由用户确认是否调用 AI 分析
//
// 依赖方向（无循环）：
//   auto-diagnose → ai-analyze（共享 controller / pushAiMessages / buildAiSystemPrompt）
//   auto-diagnose → app-context（广播）
//   auto-diagnose → log-analyzer（延迟 require，运行时读取 logStore）

const https = require('https');
const { StringDecoder } = require('string_decoder');

const ctx = require('./app-context.cjs');
const aiAnalyze = require('./ai-analyze.cjs');
const {
  AGNES_API_URL,
  AGNES_API_KEYS,
  AGNES_MODEL,
  getAgnesKeyIndex,
  getNextApiKey,
} = aiAnalyze.aiKeys;

// 预编译关键词正则（按问题类型分组）
const AUTO_DIAGNOSE_PATTERNS = [
  {
    type: 'crash',
    label: 'Java Crash',
    severity: 'fatal',
    // FATAL EXCEPTION / AndroidRuntime / CRASH: 等典型 Java 崩溃标志
    regex: /FATAL\s+EXCEPTION|AndroidRuntime.*FATAL|CRASH:|java\.lang\.\w+Exception|NullPointerException|IllegalStateException|ClassCastException|ArrayIndexOutOfBoundsException/i
  },
  {
    type: 'anr',
    label: 'ANR',
    severity: 'fatal',
    regex: /ANR\s+in\s+|Application\s+Not\s+Responding|ANRManager|not\s+responding/i
  },
  {
    type: 'native_crash',
    label: 'Native Crash',
    severity: 'fatal',
    regex: /SIGSEGV|signal\s+11|SIGABRT|signal\s+6|tombstone|libc.*Fatal|backtrace:/i
  },
  {
    type: 'oom',
    label: 'OOM',
    severity: 'fatal',
    regex: /OutOfMemoryError|Failed\s+to\s+allocate|OutOfMem/i
  },
  {
    type: 'watchdog',
    label: 'Watchdog',
    severity: 'error',
    regex: /Watchdog|watchdog.*killed|Blocked\s+in\s+handler/i
  },
  {
    type: 'kernel_panic',
    label: 'Kernel Panic',
    severity: 'fatal',
    regex: /Kernel\s+Panic|BUG:|oops:|Unable\s+to\s+handle/i
  }
];

// 自动诊断状态
// - autoDiagnoseEnabled: 总开关（用户可在 UI 关闭）
// - autoDiagnoseLastFireByType: 每种问题类型上次触发时间戳（独立去抖）
// - autoDiagnoseContextLines: 每个问题提取的上下文行数（前后各 N 行）
let autoDiagnoseEnabled = true;
const autoDiagnoseLastFireByType = {}; // { crash: timestamp, anr: timestamp, ... }
const AUTO_DIAGNOSE_DEBOUNCE_MS = 3000; // 同类型问题 3 秒内不重复推送（仅防止同一崩溃堆栈行反复触发）
const AUTO_DIAGNOSE_CONTEXT_LINES = 50;  // 每个问题前后各取 50 行上下文

// 运行时访问 log-analyzer 的 logStore（避免循环依赖：log-analyzer 也 require 本模块）
function getLogStore() {
  return require('./log-analyzer.cjs').getLogStore();
}

/**
 * 检测单行日志是否命中关键问题
 * @param {string} line 原始日志行
 * @returns {{type:string,label:string,severity:string}|null}
 */
function detectIssue(line) {
  // XBH_AI_PATCH_START
  // 关键词预筛：先用 String.includes 做快速过滤，避免对每行都执行 6 个正则
  // 预筛关键词覆盖所有 6 类问题的特征词
  const AUTO_DIAGNOSE_PRE_KEYWORDS = [
    'FATAL', 'ANR', 'SIGSEGV', 'signal', 'OutOfMemory',
    'Watchdog', 'tombstone', 'Panic', 'BUG:', 'oops',
    'AndroidRuntime', 'CRASH:', 'Exception', 'Application',
    'responding', 'allocate', 'Blocked', 'handler', 'Unable'
  ];
  let hit = false;
  for (let i = 0; i < AUTO_DIAGNOSE_PRE_KEYWORDS.length; i++) {
    if (line.indexOf(AUTO_DIAGNOSE_PRE_KEYWORDS[i]) !== -1) {
      hit = true;
      break;
    }
  }
  if (!hit) return null;
  // XBH_AI_PATCH_END
  for (const p of AUTO_DIAGNOSE_PATTERNS) {
    if (p.regex.test(line)) {
      return { type: p.type, label: p.label, severity: p.severity };
    }
  }
  return null;
}

/**
 * 检测到问题后立即推送（每种类型独立去抖）
 * 在 logcat 实时数据事件中调用
 * @param {string} line 当前日志行
 * @param {number} lineIndex 当前日志在 logStore 中的索引
 * @param {string} source 日志源（'realtime' | 'file'），默认 'realtime'
 */
function autoDiagnoseOnLine(line, lineIndex, source = 'realtime', contextEntries = null) {
  if (!autoDiagnoseEnabled) return;

  const issue = detectIssue(line);
  if (!issue) return;

  console.log(`[AutoDiagnose] 检测到 ${issue.label}（源: ${source}），line: ${line.slice(0, 100)}`);

  const now = Date.now();
  // 同类型问题在去抖窗口内不重复推送
  const lastFire = autoDiagnoseLastFireByType[issue.type] || 0;
  if (now - lastFire < AUTO_DIAGNOSE_DEBOUNCE_MS) {
    console.log(`[AutoDiagnose] ${issue.label} 在去抖窗口内，跳过 (${Math.round((now - lastFire) / 1000)}s/${AUTO_DIAGNOSE_DEBOUNCE_MS / 1000}s)`);
    return;
  }

  // 立即提取上下文快照（避免 logStore 截断后索引失效）
  // XBH_AI_PATCH_START
  // 支持外部传入的 entries（用于搜索结果重新扫描场景），避免使用错误的 logStore 源
  const entries = contextEntries || getLogStore()[source] || [];
  // XBH_AI_PATCH_END
  const start = Math.max(0, lineIndex - AUTO_DIAGNOSE_CONTEXT_LINES);
  const end = Math.min(entries.length, lineIndex + AUTO_DIAGNOSE_CONTEXT_LINES + 1);
  const contextSnapshot = entries.slice(start, end).map(e => {
    const ts = e.ts ? new Date(e.ts).toLocaleString('zh-CN', { hour12: false }) : '';
    const lvl = e.level || 'V';
    const tag = e.tag || '';
    const pid = e.pid || 0;
    const msg = e.message || e.raw || '';
    return `${ts} ${lvl}/${tag}(${pid}): ${msg}`;
  }).join('\n');

  // 更新该类型的去抖时间戳
  autoDiagnoseLastFireByType[issue.type] = now;

  // 立即推送到渲染进程
  const issueWithCtx = {
    type: issue.type,
    label: issue.label,
    severity: issue.severity,
    context: contextSnapshot
  };

  const summary = { total: 1, [issue.type]: 1 };

  console.log(`[AutoDiagnose] 推送事件到渲染进程: ${issue.label}, context 长度: ${contextSnapshot.length}`);

  ctx.broadcastToAllWindows('auto-diagnose:detected', {
    issues: [issueWithCtx],
    summary,
    timestamp: now
  });
}

/**
 * 扫描已加载的文件日志，检测关键问题
 * 在文件加载完成后调用
 * @param {Array} entries 日志条目数组
 * @param {string} source 日志源标识（'file' | 'search' | 'realtime'），用于日志和上下文
 */
// XBH_AI_PATCH_START
// 改为 async 函数，每 1000 条 yield 一次，防止阻塞主进程
async function autoDiagnoseScanFile(entries, source = 'file') {
  if (!autoDiagnoseEnabled || !entries || entries.length === 0) return;

  console.log(`[AutoDiagnose] 开始扫描日志，共 ${entries.length} 行（源: ${source}）`);

  // 遍历所有条目，检测关键问题
  // 每种类型只取第一次出现的位置
  const detectedTypes = new Set();
  const CHUNK_SIZE = 1000;
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const line = entry.raw || entry.message || '';
    const issue = detectIssue(line);
    if (issue && !detectedTypes.has(issue.type)) {
      detectedTypes.add(issue.type);
      // XBH_AI_PATCH_START
      // 传入 entries 作为上下文来源，确保搜索结果场景下上下文正确
      autoDiagnoseOnLine(line, i, source, entries);
      // XBH_AI_PATCH_END
    }
    // 每 1000 条 yield 一次，让出主进程事件循环
    if ((i + 1) % CHUNK_SIZE === 0) {
      await new Promise(r => setImmediate(r));
    }
  }

  console.log(`[AutoDiagnose] 日志扫描完成（源: ${source}），检测到 ${detectedTypes.size} 种问题`);

  // XBH_AI_PATCH_START
  // 扫描完成后广播事件，渲染进程据此从"监控中"切换到"扫描完成（无异常）"状态
  // 仅当 issueCount === 0 且非实时捕获时，渲染进程才切换到 clean 状态
  ctx.broadcastToAllWindows('auto-diagnose:scan-complete', {
    issueCount: detectedTypes.size,
    source,
    timestamp: Date.now()
  });
  // XBH_AI_PATCH_END

  return detectedTypes.size;
}
// XBH_AI_PATCH_END

// 重置自动诊断去抖时间戳（log:clear / toggle 关闭时调用）
function resetAutoDiagnoseLastFire() {
  Object.keys(autoDiagnoseLastFireByType).forEach(k => delete autoDiagnoseLastFireByType[k]);
}

function register(ipcMain) {
  // 用户确认后触发 AI 分析（带自动诊断上下文）
  ipcMain.handle('auto-diagnose:analyze', async (event, args) => {
    try {
      const { issues, summary } = args || {};
      if (!issues || issues.length === 0) {
        return { ok: false, error: '没有可分析的问题' };
      }

      // 构造给 AI 的提示：将所有检测到的问题及上下文合并
      const issueBlocks = issues.map((issue, idx) => {
        return `### 问题 ${idx + 1}：${issue.label}（严重程度：${issue.severity}）\n\n\`\`\`log\n${issue.context}\n\`\`\``;
      }).join('\n\n---\n\n');

      const autoPrompt = `请分析以下 Android logcat 日志中检测到的 ${issues.length} 个关键问题，逐一分析根因并给出修复建议：\n\n${issueBlocks}\n\n请重点关注：\n1. 每个问题的根本原因\n2. 问题之间的关联性\n3. 优先级排序\n4. 具体的修复方向`;

      // 复用 AI 分析流程，但使用自动诊断的 prompt
      // 不传 filterContext，避免"自动诊断"字样误导 AI 的安全判断
      const systemPrompt = aiAnalyze.buildAiSystemPrompt(null);
      const userContent = autoPrompt;

      let messages;
      if (aiAnalyze.getAiConversationMessages().length === 0) {
        messages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ];
      } else {
        messages = [
          ...aiAnalyze.getAiConversationMessages(),
          { role: 'user', content: userContent }
        ];
      }

      // 取消之前的请求（保持原行为：共享 controller）
      if (aiAnalyze.hasActiveAiRequest()) {
        aiAnalyze.abortActiveAiRequestOnly();
      }

      const requestBody = JSON.stringify({
        model: AGNES_MODEL,
        messages,
        stream: true,
        temperature: 0.3
      });

      const urlObj = new URL(AGNES_API_URL);
      const sender = event.sender;

      if (!sender.isDestroyed()) {
        sender.send('ai:streamStart', { totalLines: issues.length, truncated: false, autoDiagnose: true });
      }

      let fullResponse = '';
      const AI_MAX_RETRIES = 3;
      let retryCount = 0;

      function doRequest(currentKey) {
        const controller = aiAnalyze.createNewAiAbortController();

        const options = {
          hostname: urlObj.hostname,
          port: 443,
          path: urlObj.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentKey}`,
            'Accept': 'text/event-stream'
          },
          signal: controller.signal
        };

        const req = https.request(options, (res) => {
          if (res.statusCode !== 200) {
            let errBody = '';
            res.on('data', (chunk) => { errBody += chunk; });
            res.on('end', () => {
              // 与原代码保持一致：用 aiAnalyze.hasActiveAiRequest() 判断是否已 abort
              if (!aiAnalyze.hasActiveAiRequest()) return;
              if (retryCount < AI_MAX_RETRIES && (res.statusCode === 429 || res.statusCode >= 500)) {
                retryCount++;
                const nextKey = getNextApiKey();
                console.log(`[AI-AutoDiagnose] API Key 出错(${res.statusCode})，第 ${retryCount} 次重试`);
                doRequest(nextKey);
                return;
              }
              if (!sender.isDestroyed()) {
                sender.send('ai:streamError', { error: `API返回 ${res.statusCode}: ${errBody.slice(0, 500)}` });
              }
              // 重试耗尽/不可重试：清空 controller（通过 abort + 置 null）
              aiAnalyze.abortAiRequest();
            });
            return;
          }

          let buffer = '';
          const decoder = new StringDecoder('utf8');
          res.on('data', (chunk) => {
            buffer += decoder.write(chunk);
            const linesArr = buffer.split('\n');
            buffer = linesArr.pop();

            for (const ln of linesArr) {
              const trimmed = ln.trim();
              if (!trimmed || !trimmed.startsWith('data: ')) continue;

              const data = trimmed.slice(6);
              if (data === '[DONE]') {
                aiAnalyze.pushAiMessages(userContent, fullResponse);
                aiAnalyze.setAiLastResult(fullResponse);
                if (!sender.isDestroyed()) {
                  sender.send('ai:streamEnd', {});
                }
                aiAnalyze.abortAiRequest();
                return;
              }

              try {
                const json = JSON.parse(data);
                const delta = json.choices?.[0]?.delta?.content;
                if (delta && !sender.isDestroyed()) {
                  fullResponse += delta;
                  sender.send('ai:streamChunk', { text: delta });
                }
              } catch {}
            }
          });

          res.on('end', () => {
            const tail = decoder.end();
            if (tail) buffer += tail;
            if (buffer.trim()) {
              const trimmed = buffer.trim();
              if (trimmed.startsWith('data: ') && trimmed.slice(6) !== '[DONE]') {
                try {
                  const json = JSON.parse(trimmed.slice(6));
                  const delta = json.choices?.[0]?.delta?.content;
                  if (delta && !sender.isDestroyed()) {
                    fullResponse += delta;
                    sender.send('ai:streamChunk', { text: delta });
                  }
                } catch {}
              }
            }
            if (aiAnalyze.hasActiveAiRequest() && !sender.isDestroyed()) {
              if (fullResponse) {
                aiAnalyze.pushAiMessages(userContent, fullResponse);
                aiAnalyze.setAiLastResult(fullResponse);
              }
              sender.send('ai:streamEnd', {});
              aiAnalyze.abortAiRequest();
            }
          });

          res.on('error', (e) => {
            if (e.name === 'AbortError' || !aiAnalyze.hasActiveAiRequest()) return;
            if (retryCount < AI_MAX_RETRIES && !fullResponse) {
              retryCount++;
              const nextKey = getNextApiKey();
              console.log(`[AI-AutoDiagnose] 流式网络错误，第 ${retryCount} 次重试`);
              doRequest(nextKey);
              return;
            }
            if (!sender.isDestroyed()) {
              sender.send('ai:streamError', { error: e.message });
            }
            aiAnalyze.abortAiRequest();
          });
        });

        req.on('error', (e) => {
          if (e.name === 'AbortError') {
            if (fullResponse) {
              aiAnalyze.pushAiMessages(userContent, fullResponse);
              aiAnalyze.setAiLastResult(fullResponse);
            }
            if (!sender.isDestroyed()) {
              sender.send('ai:streamEnd', {});
            }
            aiAnalyze.abortAiRequest();
            return;
          }
          if (retryCount < AI_MAX_RETRIES && !fullResponse) {
            retryCount++;
            const nextKey = getNextApiKey();
            console.log(`[AI-AutoDiagnose] 连接错误(${e.message})，第 ${retryCount} 次重试`);
            doRequest(nextKey);
            return;
          }
          if (!sender.isDestroyed()) {
            sender.send('ai:streamError', { error: e.message });
          }
          aiAnalyze.abortAiRequest();
        });

        req.write(requestBody);
        req.end();
      }

      doRequest(AGNES_API_KEYS[getAgnesKeyIndex()]);
      return { ok: true, autoDiagnose: true, issueCount: issues.length };
    } catch (error) {
      console.error('Auto-diagnose analyze error:', error);
      return { ok: false, error: error.message };
    }
  });

  // 切换自动诊断开关
  ipcMain.handle('auto-diagnose:toggle', async (event, args) => {
    if (typeof args?.enabled === 'boolean') {
      autoDiagnoseEnabled = args.enabled;
      if (!autoDiagnoseEnabled) {
        // 关闭时清空所有去抖时间戳，下次重新开启时能立即触发
        resetAutoDiagnoseLastFire();
      } else {
        // XBH_AI_PATCH: 开启时重新扫描已有日志，从头检测一次
        resetAutoDiagnoseLastFire();
        const sender = event.sender;
        // 扫描当前日志源的所有日志
        const logStore = getLogStore();
        const currentEntries = logStore.realtime.length > 0 ? logStore.realtime : logStore.file;
        if (currentEntries.length > 0) {
          console.log(`[AutoDiagnose] 重新开启，扫描已有日志 ${currentEntries.length} 条`);
          setTimeout(() => {
            // XBH_AI_PATCH_START
            // autoDiagnoseScanFile 现在是 async 函数，使用 .catch 处理 Promise rejection
            autoDiagnoseScanFile(currentEntries).catch(e => {
              console.error('[AutoDiagnose] 重新扫描失败:', e.message);
            });
            // XBH_AI_PATCH_END
          }, 300);
        }
      }
    }
    return { ok: true, enabled: autoDiagnoseEnabled };
  });

  // 获取自动诊断状态
  ipcMain.handle('auto-diagnose:status', async () => {
    return { ok: true, enabled: autoDiagnoseEnabled };
  });

  // 清空自动诊断去抖时间戳（用户手动清除后可立即再次触发）
  ipcMain.handle('auto-diagnose:clear', async () => {
    resetAutoDiagnoseLastFire();
    return { ok: true };
  });

  // XBH_AI_PATCH_START
  // 重新扫描指定日志条目（搜索完成 / 返回原日志时触发，保持自动诊断与显示区域同步）
  // args.entries: 要扫描的条目数组；为 null 时使用 logStore[source]
  // args.source: 日志源标识（'realtime' | 'file' | 'search'）
  ipcMain.handle('auto-diagnose:rescan', async (event, args) => {
    if (!autoDiagnoseEnabled) {
      return { ok: false, error: '自动诊断未开启' };
    }
    const { entries: passedEntries, source: passedSource } = args || {};
    const source = passedSource || 'file';

    // 确定要扫描的条目：优先使用传入的，否则根据 source 从对应 logStore 取
    let entriesToScan = passedEntries;
    if (!entriesToScan) {
      const logStore = getLogStore();
      // 返回原日志场景：根据 source 选择对应日志源，避免误扫到另一源的残留数据
      if (source === 'realtime') {
        entriesToScan = logStore.realtime;
      } else if (source === 'file') {
        entriesToScan = logStore.file;
      } else {
        // 未知 source 时退回原逻辑：优先 realtime，其次 file
        entriesToScan = logStore.realtime.length > 0 ? logStore.realtime : logStore.file;
      }
    }

    if (!entriesToScan || entriesToScan.length === 0) {
      return { ok: false, error: '无日志可扫描' };
    }

    // 清空去抖时间戳，确保重新扫描时能立即触发各类问题
    resetAutoDiagnoseLastFire();

    console.log(`[AutoDiagnose] 日志显示区域变更，重新扫描 ${entriesToScan.length} 条（源: ${source}）`);

    // 延迟 100ms 让渲染进程先重置 UI 到 "监控中" 状态
    setTimeout(() => {
      autoDiagnoseScanFile(entriesToScan, source).catch(e => {
        console.error('[AutoDiagnose] 重新扫描失败:', e.message);
      });
    }, 100);

    return { ok: true, count: entriesToScan.length };
  });
  // XBH_AI_PATCH_END
}

module.exports = {
  register,
  autoDiagnoseOnLine,
  autoDiagnoseScanFile,
  resetAutoDiagnoseLastFire,
  isAutoDiagnoseEnabled: () => autoDiagnoseEnabled,
};
