// src/components/MemberCenter.jsx
// 会员中心：状态卡 + 激活区 + 功能对比表
// XBH_AI_PATCH: VIP 会员体系

import { useState } from 'react';
import { Crown, Copy, Check, Lock, Sparkles, ShieldCheck, Brain, Server, Loader2, Smartphone, History } from 'lucide-react';

const FEATURES = [
  { icon: Smartphone, name: '同时管理设备数量', free: '1 台', vip: '不限' },
  { icon: History, name: '连接历史记录', free: '5 条', vip: '不限' },
  { icon: ShieldCheck, name: 'AI 自动诊断', free: '可用', vip: '可用' },
  { icon: Sparkles, name: 'AI 深度分析', free: '不可用', vip: '可用' },
  { icon: Brain, name: '自然语言搜索日志', free: '不可用', vip: '可用' },
  { icon: Server, name: 'MCP 服务集成', free: '不可用', vip: '可用' }
];

const ERROR_TEXT = {
  bad_signature: '激活码无效（签名校验失败），请检查是否复制完整',
  machine_mismatch: '机器码不匹配，请复制本机机器码联系开发者重新签发',
  expired: '激活码已过期，请联系开发者续费',
  bad_format: '激活码格式错误，请检查是否复制完整',
  bad_payload: '激活码内容无效，请检查是否复制完整',
  token_empty: '请粘贴激活码',
  no_token: '',
  loading: ''
};

export default function MemberCenter({ theme, vipStatus, onActivated, showToast }) {
  const t = theme || { primary: 'tech' };
  const isDark = t.primary === 'tech';
  const isVip = vipStatus.activated;
  const [tokenInput, setTokenInput] = useState('');
  const [activating, setActivating] = useState(false);
  const [activateError, setActivateError] = useState('');
  const [copied, setCopied] = useState(false);

  const copyMachineId = async () => {
    if (!vipStatus.machineId) return;
    try {
      await navigator.clipboard.writeText(vipStatus.machineId);
      setCopied(true);
      showToast?.('机器码已复制');
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      showToast?.('复制失败');
    }
  };

  const handleActivate = async () => {
    const token = tokenInput.trim();
    if (!token) {
      setActivateError('请粘贴激活码');
      return;
    }
    setActivating(true);
    setActivateError('');
    try {
      const res = await window.electronAPI.vipActivate(token);
      if (res.success) {
        setTokenInput('');
        showToast?.('会员激活成功，感谢支持！');
        await onActivated?.();
      } else {
        setActivateError(ERROR_TEXT[res.error] || ('激活失败：' + res.error));
      }
    } catch (e) {
      setActivateError('激活异常：' + e.message);
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* 状态卡片 */}
      <div className={`p-6 rounded-xl border shadow-sm ${isVip ? 'border-amber-300/50 bg-gradient-to-br from-amber-50 to-yellow-50' : isDark ? 'bg-slate-800/80 border-[#3E4145]' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isVip ? 'bg-gradient-to-br from-amber-400 to-yellow-500 shadow-lg shadow-amber-500/30' : isDark ? 'bg-[#3E4145]' : 'bg-slate-200'}`}>
              {isVip ? <Crown size={28} className="text-white" /> : <Lock size={26} className={isDark ? 'text-[#9AA0A6]' : 'text-slate-500'} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className={`text-xl font-bold ${isVip ? 'text-amber-700' : isDark ? 'text-[#E8EAED]' : 'text-slate-800'}`}>
                  {isVip ? '会员版' : '基础版'}
                </h3>
                {isVip && (
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-700 border border-amber-400/30">
                    {vipStatus.type === 'lifetime' ? '终身' : '订阅'}
                  </span>
                )}
              </div>
              <p className={`text-sm mt-1 ${isVip ? 'text-amber-600' : isDark ? 'text-[#9AA0A6]' : 'text-slate-500'}`}>
                {isVip
                  ? vipStatus.type === 'lifetime' ? '永久有效，感谢您的支持' : `有效期至 ${new Date((vipStatus.expiresAt || 0) * 1000).toLocaleDateString('zh-CN')}`
                  : '升级会员解锁全部功能'}
              </p>
            </div>
          </div>
        </div>

        {/* 机器码 */}
        <div className={`mt-5 pt-5 border-t ${isVip ? 'border-amber-200' : isDark ? 'border-[#3E4145]' : 'border-slate-100'}`}>
          <div className={`text-xs mb-1.5 ${isDark ? 'text-[#80868B]' : 'text-slate-500'}`}>本机机器码</div>
          <div className="flex items-center gap-2">
            <code className={`flex-1 px-3 py-2 rounded-lg font-mono text-xs break-all ${isDark ? 'bg-[#3E4145]/60 text-[#E8EAED]' : 'bg-slate-50 text-slate-700'}`}>
              {vipStatus.machineId || '获取中…'}
            </code>
            <button
              onClick={copyMachineId}
              disabled={!vipStatus.machineId}
              className={`shrink-0 p-2.5 rounded-lg transition-colors disabled:opacity-50 ${isDark ? 'bg-[#3E4145] hover:bg-slate-600 text-[#E8EAED]' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
              title="复制机器码"
            >
              {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* 激活区（仅非会员） */}
      {!isVip && (
        <div className={`p-6 rounded-xl border shadow-sm ${isDark ? 'bg-slate-800/80 border-[#3E4145]' : 'bg-white border-slate-200'}`}>
          <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-[#E8EAED]' : 'text-slate-800'}`}>激活会员</h3>
          <p className={`text-sm mb-4 ${isDark ? 'text-[#9AA0A6]' : 'text-slate-500'}`}>
            复制上方机器码发送给开发者，获取激活码后粘贴到下方激活。
          </p>
          <textarea
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="在此粘贴激活码…"
            rows={3}
            className={`w-full px-3 py-2.5 border rounded-lg text-sm font-mono resize-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none ${isDark ? 'bg-[#3E4145] border-[#5F6368] text-[#E8EAED] placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
          />
          {activateError && (
            <div className="mt-2 px-3 py-2 rounded-lg text-xs bg-red-500/10 text-red-500 border border-red-500/20">
              {activateError}
            </div>
          )}
          <button
            onClick={handleActivate}
            disabled={activating || !tokenInput.trim()}
            className="mt-3 w-full sm:w-auto px-6 py-2.5 rounded-lg font-medium text-white bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 disabled:opacity-50 transition-all active:scale-95 shadow-sm"
          >
            {activating ? <span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" />激活中…</span> : '立即激活'}
          </button>
        </div>
      )}

      {/* 功能对比表 */}
      <div className={`p-6 rounded-xl border shadow-sm ${isDark ? 'bg-slate-800/80 border-[#3E4145]' : 'bg-white border-slate-200'}`}>
        <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-[#E8EAED]' : 'text-slate-800'}`}>功能对比</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={isDark ? 'text-[#9AA0A6]' : 'text-slate-500'}>
                <th className="text-left font-medium pb-3">功能</th>
                <th className="text-center font-medium pb-3 px-4">
                  <div className="flex flex-col items-center gap-1">
                    <Lock size={16} />
                    <span>基础版</span>
                  </div>
                </th>
                <th className="text-center font-medium pb-3 px-4">
                  <div className="flex flex-col items-center gap-1 text-amber-500">
                    <Crown size={16} />
                    <span>会员版</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((f, i) => {
                const Icon = f.icon;
                const freeOk = f.free === '可用';
                return (
                  <tr key={i} className={i < FEATURES.length - 1 ? (isDark ? 'border-b border-[#3E4145]/50' : 'border-b border-slate-100') : ''}>
                    <td className="py-3">
                      <div className="flex items-center gap-2.5">
                        <Icon size={16} className={isDark ? 'text-[#80868B]' : 'text-slate-400'} />
                        <span className={isDark ? 'text-[#E8EAED]' : 'text-slate-700'}>{f.name}</span>
                      </div>
                    </td>
                    <td className="text-center py-3">
                      <span className={freeOk ? 'text-emerald-500 font-medium' : isDark ? 'text-[#80868B]' : 'text-slate-400'}>
                        {freeOk ? <span className="inline-flex items-center gap-1"><Check size={14} />可用</span> : f.free}
                      </span>
                    </td>
                    <td className="text-center py-3">
                      <span className="text-amber-500 font-medium">
                        {f.vip === '可用' ? <span className="inline-flex items-center gap-1"><Check size={14} />可用</span> : f.vip}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
