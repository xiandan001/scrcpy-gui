// src/components/MemberCenter.jsx
// 会员中心：状态卡 + 开通支付向导 + 激活区 + 功能对比表
// XBH_AI_PATCH: VIP 会员体系

import { useState, useEffect } from 'react';
import { Crown, Copy, Check, Lock, Sparkles, ShieldCheck, Brain, Server, Loader2, Smartphone, History, X, ChevronRight, Wallet, QrCode } from 'lucide-react';

// 功能对比表
const FEATURES = [
  { icon: Smartphone, name: '同时管理设备数量', free: '1 台', vip: '不限' },
  { icon: History, name: '连接历史记录', free: '5 条', vip: '不限' },
  { icon: ShieldCheck, name: 'AI 自动诊断', free: '可用', vip: '可用' },
  { icon: Sparkles, name: 'AI 深度分析', free: '不可用', vip: '可用' },
  { icon: Brain, name: '自然语言搜索日志', free: '不可用', vip: '可用' },
  { icon: Server, name: 'MCP 服务集成', free: '不可用', vip: '可用' }
];

// XBH_AI_PATCH_START
// 支付预留：套餐与支付方式数据结构（常量化，便于未来接入在线支付）
// 未来接入在线支付时，只需修改 PAYMENT_METHODS 中的 handler，UI 无需改动
const PLANS = [
  {
    id: 'lifetime',
    name: '终身买断',
    price: 99,
    priceLabel: '¥99',
    desc: '一次开通，永久使用全部功能',
    badge: '推荐',
    type: 'lifetime',
    expiresAt: null
  },
  // 预留订阅套餐（未来上线时取消注释）
  // { id: 'yearly', name: '年度订阅', price: 39, priceLabel: '¥39/年', desc: '全年享受全部会员功能', badge: null, type: 'subscription', durationDays: 365 },
  // { id: 'monthly', name: '月度订阅', price: 9, priceLabel: '¥9/月', desc: '灵活订阅，随时取消', badge: null, type: 'subscription', durationDays: 30 },
];

const PAYMENT_METHODS = [
  {
    id: 'alipay',
    name: '支付宝',
    icon: Wallet,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10 border-blue-500/30',
    // 占位图路径：替换 src/assets/payment-alipay.png 即可显示真实收款码
    qrPlaceholder: 'data:image/svg+xml,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#f0f0f0"/><text x="100" y="100" text-anchor="middle" font-size="14" fill="#999" dy=".3em">支付宝收款码</text><text x="100" y="130" text-anchor="middle" font-size="11" fill="#bbb">替换 assets/payment-alipay.png</text></svg>'
    )
  },
  {
    id: 'wechat',
    name: '微信支付',
    icon: QrCode,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10 border-green-500/30',
    qrPlaceholder: 'data:image/svg+xml,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#f0f0f0"/><text x="100" y="100" text-anchor="middle" font-size="14" fill="#999" dy=".3em">微信收款码</text><text x="100" y="130" text-anchor="middle" font-size="11" fill="#bbb">替换 assets/payment-wechat.png</text></svg>'
    )
  }
];

// 开发者联系方式（预留）
const CONTACT_INFO = {
  wechat: '请扫描左侧微信收款码加好友',
  note: '付款后请将「本机机器码」发送给开发者，获取专属激活码'
};
// XBH_AI_PATCH_END

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
  const isLoading = vipStatus.reason === 'loading';
  const [tokenInput, setTokenInput] = useState('');
  const [activating, setActivating] = useState(false);
  const [activateError, setActivateError] = useState('');
  const [copied, setCopied] = useState(false);

  // XBH_AI_PATCH_START
  // 支付向导状态
  const [payWizardOpen, setPayWizardOpen] = useState(false);
  const [payStep, setPayStep] = useState(0); // 0=选套餐, 1=选支付方式, 2=扫码支付, 3=完成
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState(null);
  // 机器码默认隐藏，仅支付完成后或已是会员时解锁可复制
  // loading 状态下初始为 true（避免先隐藏再显示的闪烁），加载完成后按真实状态修正
  const [machineIdUnlocked, setMachineIdUnlocked] = useState(isLoading || vipStatus.activated === true);
  // 已是会员时自动解锁（异步加载 vipStatus 场景）
  useEffect(() => {
    if (vipStatus.activated) setMachineIdUnlocked(true);
  }, [vipStatus.activated]);
  // XBH_AI_PATCH_END

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

  // XBH_AI_PATCH_START
  // 支付向导：打开/关闭
  const openPayWizard = () => {
    setPayStep(0);
    setSelectedPlan(null);
    setSelectedMethod(null);
    setPayWizardOpen(true);
  };
  const closePayWizard = () => {
    setPayWizardOpen(false);
    setPayStep(0);
    setSelectedPlan(null);
    setSelectedMethod(null);
  };
  // 支付完成 → 解锁机器码 + 跳转到激活步骤
  const onPayComplete = () => {
    setMachineIdUnlocked(true);
    closePayWizard();
    showToast?.('机器码已解锁，请复制发送给开发者获取激活码');
  };
  // XBH_AI_PATCH_END

  // loading 骨架屏：状态加载中不显示具体套餐，避免先闪基础版再切会员版
  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className={`p-6 rounded-xl border shadow-sm animate-pulse ${isDark ? 'bg-slate-800/80 border-[#3E4145]' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl ${isDark ? 'bg-[#3E4145]' : 'bg-slate-200'}`} />
            <div className="flex-1 space-y-2">
              <div className={`h-5 w-24 rounded ${isDark ? 'bg-[#3E4145]' : 'bg-slate-200'}`} />
              <div className={`h-3 w-40 rounded ${isDark ? 'bg-[#3E4145]' : 'bg-slate-100'}`} />
            </div>
          </div>
          <div className={`mt-5 pt-5 border-t ${isDark ? 'border-[#3E4145]' : 'border-slate-100'}`}>
            <div className={`h-3 w-20 rounded mb-2 ${isDark ? 'bg-[#3E4145]' : 'bg-slate-100'}`} />
            <div className={`h-8 w-full rounded-lg ${isDark ? 'bg-[#3E4145]' : 'bg-slate-100'}`} />
          </div>
        </div>
        <div className={`flex items-center justify-center py-8 ${isDark ? 'text-[#80868B]' : 'text-slate-400'}`}>
          <Loader2 size={20} className="animate-spin mr-2" />
          <span className="text-sm">正在加载会员信息…</span>
        </div>
      </div>
    );
  }

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

          {/* XBH_AI_PATCH: 非会员显示"立即开通"按钮 */}
          {!isVip && (
            <button
              onClick={openPayWizard}
              className="shrink-0 px-5 py-2.5 rounded-lg font-medium text-white bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 transition-all active:scale-95 shadow-lg shadow-amber-500/20 flex items-center gap-2"
            >
              <Crown size={18} />
              立即开通
            </button>
          )}
        </div>

        {/* 机器码 */}
        <div className={`mt-5 pt-5 border-t ${isVip ? 'border-amber-200' : isDark ? 'border-[#3E4145]' : 'border-slate-100'}`}>
          <div className={`text-xs mb-1.5 ${isDark ? 'text-[#80868B]' : 'text-slate-500'}`}>本机机器码</div>
          {/* XBH_AI_PATCH: 非会员默认隐藏机器码，支付完成后解锁 */}
          {machineIdUnlocked ? (
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
          ) : (
            <button
              onClick={openPayWizard}
              className={`w-full px-3 py-2.5 rounded-lg border-2 border-dashed transition-colors flex items-center justify-center gap-2 ${isDark ? 'border-[#3E4145] bg-[#3E4145]/30 hover:border-amber-500/40 hover:bg-amber-500/5' : 'border-slate-200 bg-slate-50 hover:border-amber-300 hover:bg-amber-50'}`}
            >
              <Lock size={14} className="text-amber-400" />
              <span className={`text-xs ${isDark ? 'text-[#80868B]' : 'text-slate-400'}`}>完成支付后解锁机器码</span>
            </button>
          )}
        </div>
      </div>

      {/* 激活区（仅非会员） */}
      {!isVip && (
        <div className={`p-6 rounded-xl border shadow-sm ${isDark ? 'bg-slate-800/80 border-[#3E4145]' : 'bg-white border-slate-200'}`}>
          <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-[#E8EAED]' : 'text-slate-800'}`}>激活会员</h3>
          <p className={`text-sm mb-4 ${isDark ? 'text-[#9AA0A6]' : 'text-slate-500'}`}>
            已有激活码？复制上方机器码发送给开发者，获取激活码后粘贴到下方激活。
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

      {/* XBH_AI_PATCH_START */}
      {/* 支付向导模态框 */}
      {payWizardOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={closePayWizard}>
          <div
            className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden ${isDark ? 'bg-[#2D2F33] border-[#3E4145]' : 'bg-white border-slate-200'}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative px-6 py-5 bg-gradient-to-br from-amber-500/20 via-yellow-500/15 to-orange-500/10 border-b border-amber-500/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-lg">
                  <Crown size={22} className="text-white" />
                </div>
                <div className="flex-1">
                  <h3 className={`text-lg font-bold ${isDark ? 'text-[#E8EAED]' : 'text-slate-800'}`}>开通会员</h3>
                  {/* 步骤指示器 */}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {['选套餐', '选支付', '扫码', '完成'].map((label, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${i <= payStep ? 'bg-amber-500 text-white' : isDark ? 'bg-[#3E4145] text-[#80868B]' : 'bg-slate-200 text-slate-400'}`}>
                          {i < payStep ? <Check size={11} /> : i + 1}
                        </div>
                        {i < 3 && <div className={`w-4 h-px ${i < payStep ? 'bg-amber-500' : isDark ? 'bg-[#3E4145]' : 'bg-slate-200'}`} />}
                      </div>
                    ))}
                  </div>
                </div>
                <button onClick={closePayWizard} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-[#9AA0A6] hover:bg-[#3E4145] hover:text-[#E8EAED]' : 'text-[#9AA0A6] hover:bg-slate-100 hover:text-slate-600'}`}>
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5 min-h-[280px]">
              {/* Step 0: 选择套餐 */}
              {payStep === 0 && (
                <div className="space-y-3">
                  <p className={`text-sm mb-4 ${isDark ? 'text-[#9AA0A6]' : 'text-slate-500'}`}>选择您需要的会员套餐</p>
                  {PLANS.map((plan) => (
                    <button
                      key={plan.id}
                      onClick={() => { setSelectedPlan(plan); setPayStep(1); }}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all hover:shadow-md ${selectedPlan?.id === plan.id ? 'border-amber-500 bg-amber-500/5' : isDark ? 'border-[#3E4145] hover:border-[#5F6368]' : 'border-slate-200 hover:border-slate-300'}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center">
                            <Crown size={20} className="text-white" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`font-semibold ${isDark ? 'text-[#E8EAED]' : 'text-slate-800'}`}>{plan.name}</span>
                              {plan.badge && (
                                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-500/20 text-amber-600 border border-amber-500/30">{plan.badge}</span>
                              )}
                            </div>
                            <p className={`text-xs mt-0.5 ${isDark ? 'text-[#80868B]' : 'text-slate-400'}`}>{plan.desc}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-bold text-amber-500">{plan.priceLabel}</span>
                          <ChevronRight size={18} className={isDark ? 'text-[#5F6368]' : 'text-slate-300'} />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Step 1: 选择支付方式 */}
              {payStep === 1 && (
                <div className="space-y-3">
                  <p className={`text-sm mb-4 ${isDark ? 'text-[#9AA0A6]' : 'text-slate-500'}`}>
                    选择支付方式 · <span className="text-amber-500 font-medium">{selectedPlan?.name} {selectedPlan?.priceLabel}</span>
                  </p>
                  {PAYMENT_METHODS.map((method) => {
                    const Icon = method.icon;
                    return (
                      <button
                        key={method.id}
                        onClick={() => { setSelectedMethod(method); setPayStep(2); }}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all hover:shadow-md ${selectedMethod?.id === method.id ? 'border-amber-500 bg-amber-500/5' : isDark ? 'border-[#3E4145] hover:border-[#5F6368]' : 'border-slate-200 hover:border-slate-300'}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${method.bgColor}`}>
                              <Icon size={20} className={method.color} />
                            </div>
                            <span className={`font-medium ${isDark ? 'text-[#E8EAED]' : 'text-slate-700'}`}>{method.name}</span>
                          </div>
                          <ChevronRight size={18} className={isDark ? 'text-[#5F6368]' : 'text-slate-300'} />
                        </div>
                      </button>
                    );
                  })}
                  <button onClick={() => setPayStep(0)} className={`mt-2 text-xs ${isDark ? 'text-[#80868B] hover:text-[#E8EAED]' : 'text-slate-400 hover:text-slate-600'} transition-colors`}>
                    ← 返回选择套餐
                  </button>
                </div>
              )}

              {/* Step 2: 扫码支付 */}
              {payStep === 2 && (
                <div className="flex flex-col items-center">
                  <p className={`text-sm mb-4 ${isDark ? 'text-[#9AA0A6]' : 'text-slate-500'}`}>
                    请使用<span className={`font-medium ${selectedMethod?.color}`}> {selectedMethod?.name} </span>扫描下方二维码付款
                  </p>
                  {/* 二维码占位图（替换 assets/ 下的真实图片即可） */}
                  <div className="w-48 h-48 rounded-xl overflow-hidden border-2 border-slate-200 shadow-md">
                    <img src={selectedMethod?.qrPlaceholder} alt={`${selectedMethod?.name}收款码`} className="w-full h-full object-cover" />
                  </div>
                  <div className="mt-4 text-center">
                    <span className={`text-2xl font-bold text-amber-500`}>{selectedPlan?.priceLabel}</span>
                    <p className={`text-xs mt-1 ${isDark ? 'text-[#80868B]' : 'text-slate-400'}`}>{selectedPlan?.name}</p>
                  </div>
                  <div className="flex gap-2 mt-5">
                    <button onClick={() => setPayStep(1)} className={`px-4 py-2 text-sm rounded-lg transition-colors ${isDark ? 'bg-[#3E4145] text-[#E8EAED] hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                      返回
                    </button>
                    <button
                      onClick={() => setPayStep(3)}
                      className="px-5 py-2 text-sm rounded-lg font-medium text-white bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 transition-all active:scale-95"
                    >
                      我已完成支付
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: 完成 */}
              {payStep === 3 && (
                <div className="flex flex-col items-center py-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
                    <Check size={32} className="text-emerald-500" />
                  </div>
                  <h4 className={`text-lg font-bold mb-2 ${isDark ? 'text-[#E8EAED]' : 'text-slate-800'}`}>支付信息已记录</h4>
                  <p className={`text-sm text-center max-w-xs mb-4 ${isDark ? 'text-[#9AA0A6]' : 'text-slate-500'}`}>
                    {CONTACT_INFO.note}
                  </p>
                  {/* 一键复制机器码 */}
                  <button
                    onClick={copyMachineId}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-mono transition-colors ${isDark ? 'bg-[#3E4145] text-[#E8EAED] hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                  >
                    {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    {copied ? '已复制！' : '复制本机机器码'}
                  </button>
                  <button
                    onClick={onPayComplete}
                    className="mt-5 px-6 py-2.5 rounded-lg font-medium text-white bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 transition-all active:scale-95 shadow-sm"
                  >
                    去激活
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* XBH_AI_PATCH_END */}
    </div>
  );
}
