// $XBH_AI_PATCH_START
// 性能监控面板：设备指标实时采样、曲线、阈值、告警和会员导出。

import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, AlertTriangle, Cpu, Database, Download, Gauge, Lock, Play, RefreshCw, Save, Smartphone, Square, Thermometer, Zap } from 'lucide-react';

const METRICS = [
  { key: 'cpu', label: 'CPU', color: '#22c55e' },
  { key: 'memory', label: '内存', color: '#38bdf8' },
  { key: 'data', label: '/data', color: '#f59e0b' },
  { key: 'temp', label: '温度', color: '#ef4444' }
];

function PerformanceDashboard({ devices, theme, vipStatus, showToast, onOpenMemberCenter }) {
  const t = theme;
  const isDark = t.primary === 'tech';
  const isVip = vipStatus?.activated === true;
  const onlineDevices = useMemo(() => devices.filter(device => device.status === 'device'), [devices]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [running, setRunning] = useState(false);
  const [intervalMs, setIntervalMs] = useState(5000);
  const [snapshot, setSnapshot] = useState(null);
  const [history, setHistory] = useState([]);
  const [thresholds, setThresholds] = useState({ cpu: 85, memory: 85, batteryTemp: 45, dataUsed: 90 });
  const [loading, setLoading] = useState(false);
  const [savingThresholds, setSavingThresholds] = useState(false);
  // $XBH_AI_PATCH_START
  // 记录后端实际运行中的监控设备，切换页面/设备时用于停止后台采样。
  const runningDeviceRef = useRef('');
  // $XBH_AI_PATCH_END

  const selectedDevice = onlineDevices.find(device => device.id === selectedDeviceId);
  const chartPoints = useMemo(() => history.slice(-80).map(item => ({
    timestamp: item.timestamp,
    cpu: item.cpu?.usage,
    memory: item.memory?.usage,
    data: getDataDisk(item)?.usage,
    temp: getDeviceTemperature(item)
  })), [history]);
  const dataDisk = getDataDisk(snapshot);
  const deviceTemperature = getDeviceTemperature(snapshot);

  useEffect(() => {
    if (!selectedDeviceId && onlineDevices.length > 0) setSelectedDeviceId(onlineDevices[0].id);
    if (selectedDeviceId && !onlineDevices.some(device => device.id === selectedDeviceId)) {
      // $XBH_AI_PATCH_START
      // $XBH_AI_PATCH_MODIFY: 设备离线时同步停止该设备的后台采样，避免 ADB 定时任务残留。
      if (runningDeviceRef.current === selectedDeviceId) {
        window.electronAPI?.perfStop?.({ deviceId: selectedDeviceId });
        runningDeviceRef.current = '';
      }
      // $XBH_AI_PATCH_END
      setSelectedDeviceId(onlineDevices[0]?.id || '');
      setRunning(false);
      setSnapshot(null);
      setHistory([]);
    }
  }, [onlineDevices, selectedDeviceId]);

  // $XBH_AI_PATCH_START
  // 离开性能监控页面时停止后台采样，避免 UI 已卸载但主进程仍持续调用 ADB。
  useEffect(() => {
    return () => {
      const runningDeviceId = runningDeviceRef.current;
      if (runningDeviceId) {
        window.electronAPI?.perfStop?.({ deviceId: runningDeviceId });
        runningDeviceRef.current = '';
      }
    };
  }, []);
  // $XBH_AI_PATCH_END

  useEffect(() => {
    window.electronAPI?.perfGetThresholds?.().then(res => {
      if (res.ok) setThresholds(res.thresholds);
    });
  }, []);

  useEffect(() => {
    if (!window.electronAPI?.onPerformanceUpdate) return undefined;
    return window.electronAPI.onPerformanceUpdate((event) => {
      if (event.deviceId !== selectedDeviceId || !event.ok) return;
      setSnapshot(event.snapshot);
      setHistory(prev => [...prev, event.snapshot].slice(-720));
    });
  }, [selectedDeviceId]);

  const requireVip = (featureName) => {
    if (isVip) return true;
    showToast?.(`${featureName}需要会员版`);
    onOpenMemberCenter?.();
    return false;
  };

  const startMonitor = async () => {
    if (!selectedDeviceId) return;
    setLoading(true);
    try {
      // $XBH_AI_PATCH_START
      // $XBH_AI_PATCH_MODIFY: 若旧设备仍在监控，先停止旧采样，保证后台只有当前设备任务。
      if (runningDeviceRef.current && runningDeviceRef.current !== selectedDeviceId) {
        await window.electronAPI?.perfStop?.({ deviceId: runningDeviceRef.current });
        runningDeviceRef.current = '';
      }
      // $XBH_AI_PATCH_END
      const res = await window.electronAPI.perfStart({
        deviceId: selectedDeviceId,
        intervalMs,
        includeProcesses: isVip
      });
      if (res.ok) {
        setRunning(true);
        // $XBH_AI_PATCH_START
        runningDeviceRef.current = selectedDeviceId;
        // $XBH_AI_PATCH_END
        setIntervalMs(res.intervalMs);
        showToast?.('性能监控已启动');
      } else {
        showToast?.(`启动失败：${res.error || '未知错误'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const stopMonitor = async () => {
    // $XBH_AI_PATCH_START
    // $XBH_AI_PATCH_MODIFY: 优先停止真实运行中的设备，避免切换选择后停错对象。
    const targetDeviceId = runningDeviceRef.current || selectedDeviceId;
    if (!targetDeviceId) return;
    const res = await window.electronAPI.perfStop({ deviceId: targetDeviceId });
    // $XBH_AI_PATCH_END
    if (res.ok) {
      setRunning(false);
      // $XBH_AI_PATCH_START
      if (runningDeviceRef.current === targetDeviceId) runningDeviceRef.current = '';
      // $XBH_AI_PATCH_END
      showToast?.('性能监控已停止');
    }
  };

  // $XBH_AI_PATCH_START
  // 设备切换时停止旧设备采样，并重置当前视图数据，避免后台和界面状态错位。
  const switchDevice = async (nextDeviceId) => {
    const runningDeviceId = runningDeviceRef.current;
    if (runningDeviceId && runningDeviceId !== nextDeviceId) {
      await window.electronAPI?.perfStop?.({ deviceId: runningDeviceId });
      runningDeviceRef.current = '';
    }
    setSelectedDeviceId(nextDeviceId);
    setSnapshot(null);
    setHistory([]);
    setRunning(false);
  };
  // $XBH_AI_PATCH_END

  const takeSnapshot = async () => {
    if (!selectedDeviceId) return;
    setLoading(true);
    try {
      const res = await window.electronAPI.perfSnapshot({ deviceId: selectedDeviceId });
      if (res.ok) {
        setSnapshot(res.snapshot);
        setHistory(prev => [...prev, res.snapshot].slice(-720));
      } else {
        showToast?.(`采样失败：${res.error || '未知错误'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const exportHistory = async () => {
    if (!requireVip('性能数据导出')) return;
    const res = await window.electronAPI.perfExport({ deviceId: selectedDeviceId });
    if (res.ok) showToast?.(`已导出：${res.path}`);
    else showToast?.(`导出失败：${res.error || '未知错误'}`);
  };

  const saveThresholds = async () => {
    if (!requireVip('阈值设置')) return;
    setSavingThresholds(true);
    try {
      const res = await window.electronAPI.perfSetThresholds({ thresholds });
      if (res.ok) {
        setThresholds(res.thresholds);
        showToast?.('阈值已保存');
      } else {
        showToast?.(`保存失败：${res.error || '未知错误'}`);
      }
    } finally {
      setSavingThresholds(false);
    }
  };

  const panelClass = isDark ? 'bg-slate-800/80 border-[#3E4145]' : 'bg-white border-slate-200';
  const muted = isDark ? 'text-[#9AA0A6]' : 'text-slate-500';

  return (
    <div className="space-y-6">
      <div className={`p-5 rounded-xl border shadow-sm ${panelClass}`}>
        <div className="flex flex-col xl:flex-row xl:items-center gap-4">
          <div className="flex-1 min-w-0">
            <h3 className={`text-lg font-semibold flex items-center gap-2 ${isDark ? 'text-[#E8EAED]' : 'text-slate-800'}`}>
              <Gauge size={20} className="text-emerald-500" />
              性能监控
            </h3>
            <div className={`text-sm mt-1 ${muted}`}>{selectedDevice?.name || selectedDevice?.id || '未选择设备'}</div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={selectedDeviceId}
              onChange={(e) => switchDevice(e.target.value)}
              className={`px-3 py-2 rounded-lg border text-sm min-w-64 ${isDark ? 'bg-[#2D2F33] border-[#5F6368] text-[#E8EAED]' : 'bg-white border-slate-200 text-slate-700'}`}
            >
              {onlineDevices.length === 0 ? <option value="">暂无在线设备</option> : onlineDevices.map(device => (
                <option key={device.id} value={device.id}>{device.name || device.id}</option>
              ))}
            </select>
            <select
              value={intervalMs}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (value < 5000 && !isVip) {
                  requireVip('高频采样');
                  return;
                }
                setIntervalMs(value);
              }}
              className={`px-3 py-2 rounded-lg border text-sm ${isDark ? 'bg-[#2D2F33] border-[#5F6368] text-[#E8EAED]' : 'bg-white border-slate-200 text-slate-700'}`}
            >
              <option value={1000}>1 秒</option>
              <option value={3000}>3 秒</option>
              <option value={5000}>5 秒</option>
              <option value={10000}>10 秒</option>
            </select>
            {running ? (
              <button onClick={stopMonitor} className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 flex items-center gap-2">
                <Square size={16} />
                停止
              </button>
            ) : (
              <button onClick={startMonitor} disabled={!selectedDeviceId || loading} className="px-4 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 flex items-center gap-2">
                {loading ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
                开始
              </button>
            )}
            <button onClick={takeSnapshot} disabled={!selectedDeviceId || loading} className={`px-4 py-2 rounded-lg border flex items-center gap-2 disabled:opacity-50 ${isDark ? 'border-[#5F6368] text-[#E8EAED] hover:bg-[#3E4145]' : 'border-slate-200 text-slate-700 hover:bg-slate-100'}`}>
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              采样
            </button>
            <button onClick={exportHistory} disabled={!selectedDeviceId || history.length === 0} className={`px-4 py-2 rounded-lg border flex items-center gap-2 disabled:opacity-50 ${isVip ? (isDark ? 'border-[#5F6368] text-[#E8EAED] hover:bg-[#3E4145]' : 'border-slate-200 text-slate-700 hover:bg-slate-100') : 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10'}`}>
              {isVip ? <Download size={16} /> : <Lock size={16} />}
              导出
            </button>
          </div>
        </div>
      </div>

      {onlineDevices.length === 0 ? (
        <div className={`py-20 rounded-xl border border-dashed text-center ${isDark ? 'border-[#3E4145] text-[#80868B]' : 'border-slate-300 text-slate-400'}`}>
          <Smartphone size={44} className="mx-auto mb-3 opacity-50" />
          <div>暂无在线设备</div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={<Cpu size={20} />} label="CPU" value={formatPercent(snapshot?.cpu?.usage)} sub={running ? '实时' : '最近采样'} color="emerald" theme={t} />
            <MetricCard icon={<Activity size={20} />} label="内存" value={formatPercent(snapshot?.memory?.usage)} sub={formatKb(snapshot?.memory?.usedKb, snapshot?.memory?.totalKb)} color="sky" theme={t} />
            <MetricCard icon={<Database size={20} />} label="/data" value={formatPercent(dataDisk?.usage)} sub={formatKb(dataDisk?.usedKb, dataDisk?.sizeKb)} color="amber" theme={t} />
            <MetricCard icon={<Thermometer size={20} />} label="温度" value={formatTemp(deviceTemperature)} sub={formatBatterySub(snapshot?.battery)} color="red" theme={t} />
          </div>

          {snapshot?.warnings?.length > 0 && (
            <div className={`p-4 rounded-xl border flex items-start gap-3 ${isDark ? 'bg-red-500/10 border-red-500/20 text-red-300' : 'bg-red-50 border-red-200 text-red-600'}`}>
              <AlertTriangle size={18} className="mt-0.5" />
              <div className="flex flex-wrap gap-2 text-sm">
                {snapshot.warnings.map(item => <span key={`${item.type}-${item.label}`} className="px-2 py-1 rounded bg-red-500/10">{item.label}</span>)}
              </div>
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className={`p-5 rounded-xl border shadow-sm ${panelClass}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-base font-semibold ${isDark ? 'text-[#E8EAED]' : 'text-slate-800'}`}>趋势</h3>
                <div className="flex items-center gap-3 text-xs">
                  {METRICS.map(metric => <span key={metric.key} className={muted}><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: metric.color }} />{metric.label}</span>)}
                </div>
              </div>
              <PerformanceChart points={chartPoints} isDark={isDark} />
            </div>

            <div className={`p-5 rounded-xl border shadow-sm ${panelClass}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-base font-semibold ${isDark ? 'text-[#E8EAED]' : 'text-slate-800'}`}>阈值</h3>
                {!isVip && <span className="text-xs text-amber-400 flex items-center gap-1"><Lock size={12} />会员</span>}
              </div>
              <div className="space-y-4">
                <ThresholdInput label="CPU" value={thresholds.cpu} suffix="%" onChange={(value) => setThresholds(prev => ({ ...prev, cpu: value }))} isDark={isDark} />
                <ThresholdInput label="内存" value={thresholds.memory} suffix="%" onChange={(value) => setThresholds(prev => ({ ...prev, memory: value }))} isDark={isDark} />
                <ThresholdInput label="电池温度" value={thresholds.batteryTemp} suffix="°C" onChange={(value) => setThresholds(prev => ({ ...prev, batteryTemp: value }))} isDark={isDark} />
                <ThresholdInput label="/data" value={thresholds.dataUsed} suffix="%" onChange={(value) => setThresholds(prev => ({ ...prev, dataUsed: value }))} isDark={isDark} />
                <button onClick={saveThresholds} disabled={savingThresholds} className="w-full px-4 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center gap-2">
                  {savingThresholds ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                  保存阈值
                </button>
              </div>
            </div>
          </div>

          <div className={`rounded-xl border shadow-sm overflow-hidden ${panelClass}`}>
            <div className={`px-5 py-4 border-b flex items-center justify-between ${isDark ? 'border-[#3E4145]' : 'border-slate-100'}`}>
              <h3 className={`text-base font-semibold flex items-center gap-2 ${isDark ? 'text-[#E8EAED]' : 'text-slate-800'}`}>
                <Zap size={17} className="text-yellow-500" />
                进程占用
              </h3>
              {!isVip && <button onClick={() => requireVip('进程占用明细')} className="text-xs text-amber-400 flex items-center gap-1"><Lock size={12} />会员</button>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className={isDark ? 'bg-[#2D2F33] text-[#9AA0A6]' : 'bg-slate-50 text-slate-500'}>
                  <tr>
                    <th className="text-left px-5 py-3 font-medium">PID</th>
                    <th className="text-left px-5 py-3 font-medium">进程</th>
                    <th className="text-right px-5 py-3 font-medium">CPU</th>
                    <th className="text-right px-5 py-3 font-medium">内存</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-[#3E4145]' : 'divide-slate-100'}`}>
                  {!isVip ? (
                    <tr><td colSpan="4" className={`px-5 py-8 text-center ${muted}`}>会员版可查看进程占用明细</td></tr>
                  ) : (snapshot?.processes || []).length === 0 ? (
                    <tr><td colSpan="4" className={`px-5 py-8 text-center ${muted}`}>暂无进程数据</td></tr>
                  ) : snapshot.processes.map(proc => (
                    <tr key={`${proc.pid}-${proc.name}`} className={isDark ? 'text-[#E8EAED]' : 'text-slate-700'}>
                      <td className="px-5 py-3 font-mono text-xs">{proc.pid}</td>
                      <td className="px-5 py-3 max-w-[520px] truncate">{proc.name}</td>
                      <td className="px-5 py-3 text-right">{proc.cpu.toFixed(1)}%</td>
                      <td className="px-5 py-3 text-right">{proc.memory.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MetricCard({ icon, label, value, sub, color, theme }) {
  const isDark = theme.primary === 'tech';
  const colorClass = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    sky: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    red: 'text-red-400 bg-red-500/10 border-red-500/20'
  }[color];
  return (
    <div className={`p-5 rounded-xl border shadow-sm ${isDark ? 'bg-slate-800/80 border-[#3E4145]' : 'bg-white border-slate-200'}`}>
      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${colorClass}`}>{icon}</div>
        <span className={`text-xs ${isDark ? 'text-[#9AA0A6]' : 'text-slate-500'}`}>{label}</span>
      </div>
      <div className={`text-3xl font-bold mt-4 ${isDark ? 'text-[#E8EAED]' : 'text-slate-800'}`}>{value}</div>
      <div className={`text-xs mt-1 ${isDark ? 'text-[#9AA0A6]' : 'text-slate-500'}`}>{sub}</div>
    </div>
  );
}

function PerformanceChart({ points, isDark }) {
  const width = 720;
  const height = 260;
  const pad = 28;
  const series = METRICS.map(metric => ({
    ...metric,
    path: makePath(points.map(item => item[metric.key]), width, height, pad)
  }));
  return (
    <div className={`h-[300px] rounded-lg border ${isDark ? 'bg-[#202124] border-[#3E4145]' : 'bg-slate-50 border-slate-200'}`}>
      {points.length < 2 ? (
        <div className={`h-full flex items-center justify-center text-sm ${isDark ? 'text-[#80868B]' : 'text-slate-400'}`}>暂无趋势数据</div>
      ) : (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
          {[0, 25, 50, 75, 100].map(value => {
            const y = pad + (100 - value) / 100 * (height - pad * 2);
            return <line key={value} x1={pad} x2={width - pad} y1={y} y2={y} stroke={isDark ? '#334155' : '#e2e8f0'} strokeDasharray="4 6" />;
          })}
          {series.map(item => <path key={item.key} d={item.path} fill="none" stroke={item.color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />)}
        </svg>
      )}
    </div>
  );
}

function ThresholdInput({ label, value, suffix, onChange, isDark }) {
  return (
    <label className="block">
      <div className={`flex items-center justify-between mb-1 text-sm ${isDark ? 'text-[#E8EAED]' : 'text-slate-700'}`}>
        <span>{label}</span>
        <span>{value}{suffix}</span>
      </div>
      <input type="range" min="1" max="100" value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-emerald-500" />
    </label>
  );
}

function makePath(values, width, height, pad) {
  const usableW = width - pad * 2;
  const usableH = height - pad * 2;
  const clean = values.map(value => Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : null);
  if (clean.filter(value => value != null).length < 2) return '';
  return clean.map((value, index) => {
    const x = pad + (index / Math.max(clean.length - 1, 1)) * usableW;
    const y = pad + (100 - (value ?? 0)) / 100 * usableH;
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
}

function formatPercent(value) {
  return value == null ? '--' : `${Number(value).toFixed(1)}%`;
}

function formatTemp(value) {
  return value == null ? '--' : `${Number(value).toFixed(1)}°C`;
}

function formatKb(used, total) {
  if (!used || !total) return '-';
  return `${(used / 1024 / 1024).toFixed(1)} / ${(total / 1024 / 1024).toFixed(1)} GB`;
}

function getDataDisk(snapshot) {
  const disks = snapshot?.disk || [];
  return disks.find(item => item.mount === '/data') || disks.find(item => item.mount === '/storage/emulated') || null;
}

function getDeviceTemperature(snapshot) {
  const batteryTemp = snapshot?.battery?.temperature;
  if (batteryTemp != null && batteryTemp > 0) return batteryTemp;
  return snapshot?.thermal?.hottest ?? null;
}

function formatBatterySub(battery) {
  if (!battery) return '电量 -';
  if (battery.present === false) return '无电池设备';
  return `电量 ${battery.level ?? '-'}%`;
}

export default PerformanceDashboard;

// $XBH_AI_PATCH_END
