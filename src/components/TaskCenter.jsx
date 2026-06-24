// 任务中心：复现脚本、多设备批量执行和运行历史。

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ClipboardList,
  FolderOpen,
  Gauge,
  Loader2,
  Package,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  Smartphone,
  Square,
  Terminal,
  Trash2,
  Upload
} from 'lucide-react';

const STEP_TYPES = [
  { value: 'shell', label: 'Shell 命令', description: '执行一条 ADB shell 命令', icon: Terminal },
  { value: 'installApk', label: '安装 APK', description: '安装本地 APK 到设备', icon: Package },
  { value: 'pushFile', label: '推送文件', description: '推送本地文件到设备路径', icon: Upload },
  { value: 'screenshot', label: '截图', description: '保存当前设备画面', icon: Camera },
  { value: 'perfSnapshot', label: '性能采样', description: '采集一次性能快照', icon: Gauge },
  { value: 'inspection', label: '巡检摘要', description: '生成巡检报告和证据包', icon: ClipboardList },
  { value: 'waitLog', label: '等待日志', description: '轮询直到日志命中', icon: Search },
  { value: 'delay', label: '等待', description: '等待指定毫秒数', icon: Clock3 }
];

function TaskCenter({ devices, theme, taskCenterPath, showToast }) {
  const t = theme;
  const isDark = t.primary === 'tech';
  const onlineDevices = useMemo(() => devices.filter(device => device.status === 'device'), [devices]);
  const [scripts, setScripts] = useState([]);
  const [selectedScriptId, setSelectedScriptId] = useState('');
  const [draft, setDraft] = useState(createEmptyScript());
  const [selectedDeviceIds, setSelectedDeviceIds] = useState([]);
  const [activeTasks, setActiveTasks] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const panelClass = isDark ? 'bg-slate-800/80 border-[#3E4145]' : 'bg-white border-slate-200';
  const softClass = isDark ? 'bg-[#2D2F33] border-[#3E4145]' : 'bg-slate-50 border-slate-200';
  const muted = isDark ? 'text-[#9AA0A6]' : 'text-slate-500';
  const text = isDark ? 'text-[#E8EAED]' : 'text-slate-800';

  useEffect(() => {
    let alive = true;
    async function loadState() {
      setLoading(true);
      try {
        const [scriptRes, stateRes] = await Promise.all([
          window.electronAPI?.taskScriptsList?.(),
          window.electronAPI?.taskState?.()
        ]);
        if (!alive) return;
        const nextScripts = scriptRes?.scripts || [];
        setScripts(nextScripts);
        const first = nextScripts[0] || createEmptyScript();
        setSelectedScriptId(first.id);
        setDraft(cloneScript(first));
        setActiveTasks(stateRes?.activeTasks || []);
        setHistory(stateRes?.history || []);
      } finally {
        if (alive) setLoading(false);
      }
    }
    loadState();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    setSelectedDeviceIds(prev => {
      if (prev.length === 0 && onlineDevices.length > 0) {
        return [onlineDevices[0].id];
      }
      return prev.filter(id => onlineDevices.some(device => device.id === id));
    });
  }, [onlineDevices]);

  useEffect(() => {
    if (!window.electronAPI?.onTaskCenterUpdate) return undefined;
    return window.electronAPI.onTaskCenterUpdate((event) => {
      if (Array.isArray(event?.activeTasks)) setActiveTasks(event.activeTasks);
      if (Array.isArray(event?.history)) setHistory(event.history);
    });
  }, []);

  const activeCount = activeTasks.filter(task => task.status === 'running' || task.status === 'queued').length;
  const selectedScript = scripts.find(script => script.id === selectedScriptId);

  const selectScript = (script) => {
    setSelectedScriptId(script.id);
    setDraft(cloneScript(script));
  };

  const createScript = () => {
    const next = createEmptyScript();
    setSelectedScriptId(next.id);
    setDraft(next);
  };

  const saveScript = async () => {
    setSaving(true);
    try {
      const res = await window.electronAPI?.taskScriptSave?.({ script: draft });
      if (res?.ok) {
        setScripts(res.scripts || []);
        setSelectedScriptId(res.script.id);
        setDraft(cloneScript(res.script));
        showToast?.('复现脚本已保存');
      } else {
        showToast?.(`保存失败：${res?.error || '未知错误'}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteScript = async () => {
    if (!selectedScript || !window.confirm(`确定删除脚本「${selectedScript.name}」吗？`)) return;
    const res = await window.electronAPI?.taskScriptDelete?.({ id: selectedScript.id });
    if (!res?.ok) {
      showToast?.(`删除失败：${res?.error || '未知错误'}`);
      return;
    }
    const nextScripts = res.scripts || [];
    setScripts(nextScripts);
    const next = nextScripts[0] || createEmptyScript();
    setSelectedScriptId(next.id);
    setDraft(cloneScript(next));
    showToast?.('脚本已删除');
  };

  const runScript = async () => {
    if (selectedDeviceIds.length === 0) {
      showToast?.('请至少选择一台在线设备');
      return;
    }
    const res = await window.electronAPI?.taskRun?.({
      script: draft,
      deviceIds: selectedDeviceIds,
      outputBaseDir: taskCenterPath,
      continueOnError: draft.continueOnError,
      concurrency: 1
    });
    if (res?.ok) {
      showToast?.('任务已加入队列');
    } else {
      showToast?.(`启动失败：${res?.error || '未知错误'}`);
    }
  };

  const cancelTask = async (taskId) => {
    const res = await window.electronAPI?.taskCancel?.({ taskId });
    if (!res?.ok) showToast?.(`取消失败：${res?.error || '未知错误'}`);
  };

  const clearHistory = async () => {
    if (!window.confirm('确定清空任务历史吗？')) return;
    const res = await window.electronAPI?.taskHistoryClear?.();
    if (res?.ok) {
      setHistory([]);
      showToast?.('任务历史已清空');
    }
  };

  const toggleDevice = (deviceId) => {
    setSelectedDeviceIds(prev => prev.includes(deviceId) ? prev.filter(id => id !== deviceId) : [...prev, deviceId]);
  };

  const updateStep = (index, patch) => {
    setDraft(prev => ({
      ...prev,
      steps: prev.steps.map((step, i) => i === index ? { ...step, ...patch } : step)
    }));
  };

  const addStep = (type) => {
    setDraft(prev => ({
      ...prev,
      steps: [...prev.steps, createStep(type)]
    }));
  };

  const removeStep = (index) => {
    setDraft(prev => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index)
    }));
  };

  const moveStep = (index, delta) => {
    setDraft(prev => {
      const nextIndex = index + delta;
      if (nextIndex < 0 || nextIndex >= prev.steps.length) return prev;
      const next = [...prev.steps];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return { ...prev, steps: next };
    });
  };

  if (loading) {
    return (
      <div className={`rounded-xl border p-8 text-center ${panelClass}`}>
        <Loader2 size={28} className="mx-auto mb-3 animate-spin text-emerald-500" />
        <div className={muted}>正在加载任务中心...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className={`rounded-xl border p-5 shadow-sm ${panelClass}`}>
        <div className="flex flex-col xl:flex-row xl:items-center gap-4">
          <div className="flex-1 min-w-0">
            <h3 className={`text-lg font-semibold flex items-center gap-2 ${text}`}>
              <ClipboardList size={20} className="text-emerald-500" />
              任务中心
            </h3>
            <p className={`text-sm mt-1 ${muted}`}>保存复现脚本，批量运行到多台设备，并沉淀执行证据。</p>
          </div>
          <div className="grid grid-cols-3 gap-3 min-w-[360px]">
            <StatCard label="在线设备" value={onlineDevices.length} theme={t} />
            <StatCard label="运行任务" value={activeCount} theme={t} />
            <StatCard label="历史记录" value={history.length} theme={t} />
          </div>
        </div>
      </div>

      <div className="grid gap-6 2xl:grid-cols-[280px_minmax(0,1fr)_420px]">
        <section className={`rounded-xl border shadow-sm overflow-hidden ${panelClass}`}>
          <div className={`px-4 py-3 border-b flex items-center justify-between ${isDark ? 'border-[#3E4145]' : 'border-slate-100'}`}>
            <div className={`font-semibold ${text}`}>复现脚本</div>
            <button onClick={createScript} className={`p-2 rounded-lg border ${t.button.secondary}`} title="新建脚本">
              <Plus size={15} />
            </button>
          </div>
          <div className="max-h-[720px] overflow-y-auto p-3 space-y-2">
            {scripts.length === 0 ? (
              <div className={`py-12 text-center text-sm ${muted}`}>暂无脚本</div>
            ) : scripts.map(script => (
              <button
                key={script.id}
                onClick={() => selectScript(script)}
                className={`w-full text-left rounded-lg border p-3 transition-colors ${draft.id === script.id ? 'border-emerald-500/40 bg-emerald-500/10' : isDark ? 'border-[#3E4145] hover:bg-[#2D2F33]' : 'border-slate-200 hover:bg-slate-50'}`}
              >
                <div className={`font-medium truncate ${text}`}>{script.name}</div>
                <div className={`text-xs mt-1 line-clamp-2 ${muted}`}>{script.description || '无描述'}</div>
                <div className={`text-[11px] mt-2 ${muted}`}>{script.steps?.length || 0} 个步骤</div>
              </button>
            ))}
          </div>
        </section>

        <section className={`rounded-xl border shadow-sm ${panelClass}`}>
          <div className={`px-5 py-4 border-b flex flex-wrap items-center gap-3 ${isDark ? 'border-[#3E4145]' : 'border-slate-100'}`}>
            <div className="flex-1 min-w-[260px]">
              <input
                value={draft.name}
                onChange={(e) => setDraft(prev => ({ ...prev, name: e.target.value }))}
                className={`w-full text-lg font-semibold bg-transparent outline-none ${text}`}
                placeholder="脚本名称"
              />
              <input
                value={draft.description}
                onChange={(e) => setDraft(prev => ({ ...prev, description: e.target.value }))}
                className={`w-full mt-1 text-sm bg-transparent outline-none ${muted}`}
                placeholder="描述这个脚本的用途"
              />
            </div>
            <label className={`flex items-center gap-2 text-xs ${muted}`}>
              <input
                type="checkbox"
                checked={draft.continueOnError}
                onChange={(e) => setDraft(prev => ({ ...prev, continueOnError: e.target.checked }))}
                className="accent-emerald-500"
              />
              失败后继续执行
            </label>
            <button onClick={saveScript} disabled={saving} className={`px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50 ${t.button.secondary}`}>
              {saving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
              保存
            </button>
            <button onClick={deleteScript} className="px-4 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 flex items-center gap-2">
              <Trash2 size={15} />
              删除
            </button>
          </div>

          <div className="p-5 space-y-5">
            <div className={`rounded-xl border p-4 ${softClass}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className={`font-semibold ${text}`}>运行目标</div>
                  <div className={`text-xs mt-1 ${muted}`}>默认串行执行，保护 ADB 和设备稳定性。</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSelectedDeviceIds(onlineDevices.map(device => device.id))} className={`px-3 py-2 text-xs rounded-lg border ${t.button.secondary}`}>全选</button>
                  <button onClick={() => setSelectedDeviceIds([])} className={`px-3 py-2 text-xs rounded-lg border ${t.button.secondary}`}>清空</button>
                  <button onClick={runScript} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium flex items-center gap-2">
                    <Play size={15} />
                    运行
                  </button>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {onlineDevices.length === 0 ? (
                  <div className={`text-sm ${muted}`}>暂无在线设备</div>
                ) : onlineDevices.map(device => {
                  const selected = selectedDeviceIds.includes(device.id);
                  return (
                    <button
                      key={device.id}
                      onClick={() => toggleDevice(device.id)}
                      className={`px-3 py-2 rounded-lg border text-sm flex items-center gap-2 transition-colors ${selected ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' : isDark ? 'border-[#5F6368] text-[#E8EAED] hover:bg-[#3E4145]' : 'border-slate-200 text-slate-700 hover:bg-white'}`}
                    >
                      <Smartphone size={14} />
                      <span>{device.model || device.id}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={`rounded-xl border overflow-hidden ${softClass}`}>
              <div className={`px-4 py-3 border-b flex flex-wrap items-center justify-between gap-3 ${isDark ? 'border-[#3E4145]' : 'border-slate-200'}`}>
                <div>
                  <div className={`font-semibold ${text}`}>步骤编排</div>
                  <div className={`text-xs mt-1 ${muted}`}>{draft.steps.length} 个步骤</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {STEP_TYPES.map(type => {
                    const Icon = type.icon;
                    return (
                      <button key={type.value} onClick={() => addStep(type.value)} className={`px-2.5 py-1.5 text-xs rounded-lg border flex items-center gap-1.5 ${t.button.secondary}`}>
                        <Icon size={12} />
                        {type.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="p-4 space-y-3">
                {draft.steps.length === 0 ? (
                  <div className={`py-12 text-center text-sm ${muted}`}>添加一个步骤开始编排复现流程</div>
                ) : draft.steps.map((step, index) => (
                  <StepEditor
                    key={step.id}
                    step={step}
                    index={index}
                    theme={t}
                    isDark={isDark}
                    onChange={(patch) => updateStep(index, patch)}
                    onRemove={() => removeStep(index)}
                    onMoveUp={() => moveStep(index, -1)}
                    onMoveDown={() => moveStep(index, 1)}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <TaskList
            title="运行中"
            tasks={activeTasks}
            empty="当前没有运行中的任务"
            theme={t}
            onCancel={cancelTask}
            onOpenPath={(targetPath) => window.electronAPI?.openFolder?.(targetPath)}
          />
          <TaskList
            title="运行历史"
            tasks={history}
            empty="暂无运行历史"
            theme={t}
            onClear={history.length > 0 ? clearHistory : null}
            onOpenPath={(targetPath) => window.electronAPI?.openFolder?.(targetPath)}
          />
        </section>
      </div>
    </div>
  );
}

function StepTypeDropdown({ value, isDark, onChange }) {
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
  const selectedIndex = Math.max(0, STEP_TYPES.findIndex(type => type.value === value));
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const selected = STEP_TYPES[selectedIndex] || STEP_TYPES[0];
  const SelectedIcon = selected.icon;

  useEffect(() => {
    if (!open) return undefined;
    const updatePosition = () => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const viewportWidth = window.innerWidth || 1024;
      const viewportHeight = window.innerHeight || 768;
      const gap = 8;
      const width = Math.min(320, Math.max(288, rect.width));
      const spaceBelow = viewportHeight - rect.bottom - gap;
      const spaceAbove = rect.top - gap;
      const openUp = spaceBelow < 240 && spaceAbove > spaceBelow;
      const availableHeight = openUp ? spaceAbove - gap : spaceBelow - gap;
      const maxHeight = Math.max(180, Math.min(320, availableHeight));
      const top = openUp
        ? Math.max(gap, rect.top - maxHeight - gap)
        : Math.min(viewportHeight - maxHeight - gap, rect.bottom + gap);
      const left = Math.min(viewportWidth - width - gap, Math.max(gap, rect.right - width));
      setMenuStyle({ top, left, width, maxHeight });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex(prev => (prev + 1) % STEP_TYPES.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex(prev => (prev - 1 + STEP_TYPES.length) % STEP_TYPES.length);
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        const next = STEP_TYPES[activeIndex] || STEP_TYPES[0];
        onChange(next.value);
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [activeIndex, onChange, open]);

  useEffect(() => {
    setActiveIndex(selectedIndex);
  }, [selectedIndex]);

  const menu = open && menuStyle && typeof document !== 'undefined' ? createPortal(
    <div
      ref={menuRef}
      role="listbox"
      style={{
        position: 'fixed',
        top: menuStyle.top,
        left: menuStyle.left,
        width: menuStyle.width,
        maxHeight: menuStyle.maxHeight
      }}
      className={`z-[120] overflow-y-auto rounded-xl border p-1.5 shadow-2xl ${isDark ? 'bg-[#202124] border-[#3E4145]' : 'bg-white border-slate-200'}`}
    >
      {STEP_TYPES.map((type, index) => {
        const Icon = type.icon;
        const selectedOption = type.value === value;
        const active = index === activeIndex;
        return (
          <button
            key={type.value}
            type="button"
            role="option"
            aria-selected={selectedOption}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => {
              onChange(type.value);
              setOpen(false);
            }}
            className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors flex items-start gap-3 ${active ? 'bg-emerald-500/10' : isDark ? 'hover:bg-[#2D2F33]' : 'hover:bg-slate-50'}`}
          >
            <span className={`mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${selectedOption ? 'bg-emerald-500 text-white' : 'bg-emerald-500/10 text-emerald-400'}`}>
              <Icon size={15} />
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block text-sm font-medium ${isDark ? 'text-[#E8EAED]' : 'text-slate-800'}`}>{type.label}</span>
              <span className={`block text-xs mt-0.5 leading-snug ${isDark ? 'text-[#9AA0A6]' : 'text-slate-500'}`}>{type.description}</span>
            </span>
            {selectedOption && <Check size={15} className="mt-1 text-emerald-400 shrink-0" />}
          </button>
        );
      })}
    </div>,
    document.body
  ) : null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className={`min-w-[160px] px-3 py-2 rounded-lg border text-sm transition-colors flex items-center justify-between gap-3 ${isDark ? 'bg-[#2D2F33] border-[#5F6368] text-[#E8EAED] hover:bg-[#3E4145]' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 min-w-0">
          <SelectedIcon size={15} className="text-emerald-400 shrink-0" />
          <span className="truncate">{selected.label}</span>
        </span>
        <ChevronDown size={15} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {menu}
    </div>
  );
}

function StepEditor({ step, index, theme, isDark, onChange, onRemove, onMoveUp, onMoveDown }) {
  const t = theme;
  const text = isDark ? 'text-[#E8EAED]' : 'text-slate-800';
  const muted = isDark ? 'text-[#9AA0A6]' : 'text-slate-500';
  const selectedType = STEP_TYPES.find(type => type.value === step.type) || STEP_TYPES[0];
  const Icon = selectedType.icon;

  return (
    <div className={`rounded-lg border p-4 ${isDark ? 'bg-[#202124] border-[#3E4145]' : 'bg-white border-slate-200'}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-[240px]">
          <input
            value={step.label}
            onChange={(e) => onChange({ label: e.target.value })}
            className={`w-full font-medium bg-transparent outline-none ${text}`}
            placeholder="步骤名称"
          />
          <div className={`text-xs mt-0.5 ${muted}`}>步骤 {index + 1}</div>
        </div>
        <StepTypeDropdown
          value={step.type}
          isDark={isDark}
          onChange={(value) => onChange({ ...createStep(value), id: step.id, label: getTypeLabel(value) })}
        />
        <button onClick={onMoveUp} className={`px-2 py-2 rounded-lg border text-xs ${t.button.secondary}`}>上移</button>
        <button onClick={onMoveDown} className={`px-2 py-2 rounded-lg border text-xs ${t.button.secondary}`}>下移</button>
        <button onClick={onRemove} className="p-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10" title="删除步骤">
          <Trash2 size={14} />
        </button>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {renderStepFields(step, onChange, isDark)}
        <NumberField label="超时(ms)" value={step.timeoutMs} onChange={(value) => onChange({ timeoutMs: value })} isDark={isDark} />
      </div>
    </div>
  );
}

function renderStepFields(step, onChange, isDark) {
  if (step.type === 'shell') {
    return (
      <label className="lg:col-span-2 block">
        <FieldLabel label="Shell 命令" isDark={isDark} />
        <textarea
          value={step.command}
          onChange={(e) => onChange({ command: e.target.value })}
          rows={3}
          placeholder="例如：dumpsys window | grep mCurrentFocus"
          className={fieldClass(isDark, 'font-mono')}
        />
      </label>
    );
  }
  if (step.type === 'installApk') {
    return <TextField label="APK 路径" value={step.localPath} onChange={(value) => onChange({ localPath: value })} placeholder="C:\\path\\app.apk" isDark={isDark} />;
  }
  if (step.type === 'pushFile') {
    return (
      <>
        <TextField label="本地文件" value={step.localPath} onChange={(value) => onChange({ localPath: value })} placeholder="C:\\path\\file.txt" isDark={isDark} />
        <TextField label="设备路径" value={step.remotePath} onChange={(value) => onChange({ remotePath: value })} placeholder="/sdcard/" isDark={isDark} />
      </>
    );
  }
  if (step.type === 'screenshot') {
    return <TextField label="保存路径（可选）" value={step.localPath} onChange={(value) => onChange({ localPath: value })} placeholder="留空则保存到任务产物目录" isDark={isDark} />;
  }
  if (step.type === 'inspection') {
    return (
      <>
        <label className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${isDark ? 'border-[#5F6368] bg-[#2D2F33]' : 'border-slate-200 bg-white'}`}>
          <span className={isDark ? 'text-[#E8EAED]' : 'text-slate-700'}>包含 bugreport</span>
          <input
            type="checkbox"
            checked={step.includeBugreport === true}
            onChange={(e) => onChange({ includeBugreport: e.target.checked })}
            className="h-4 w-4 accent-emerald-500"
          />
        </label>
        <label className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${isDark ? 'border-[#5F6368] bg-[#2D2F33]' : 'border-slate-200 bg-white'}`}>
          <span className={isDark ? 'text-[#E8EAED]' : 'text-slate-700'}>包含 AI 总结</span>
          <input
            type="checkbox"
            checked={step.includeAiSummary !== false}
            onChange={(e) => onChange({ includeAiSummary: e.target.checked })}
            className="h-4 w-4 accent-emerald-500"
          />
        </label>
      </>
    );
  }
  if (step.type === 'waitLog') {
    return (
      <>
        <TextField label="关键词" value={step.keyword} onChange={(value) => onChange({ keyword: value })} placeholder="等待出现的日志关键词" isDark={isDark} />
        <TextField label="正则（可选）" value={step.regex} onChange={(value) => onChange({ regex: value })} placeholder="优先使用正则匹配" isDark={isDark} />
        <NumberField label="轮询间隔(ms)" value={step.intervalMs} onChange={(value) => onChange({ intervalMs: value })} isDark={isDark} />
      </>
    );
  }
  if (step.type === 'delay') {
    return <NumberField label="等待时长(ms)" value={step.durationMs} onChange={(value) => onChange({ durationMs: value })} isDark={isDark} />;
  }
  return (
    <div className={`text-sm ${isDark ? 'text-[#9AA0A6]' : 'text-slate-500'}`}>
      该步骤无需额外参数。
    </div>
  );
}

function TaskList({ title, tasks, empty, theme, onCancel, onClear, onOpenPath }) {
  const isDark = theme.primary === 'tech';
  const muted = isDark ? 'text-[#9AA0A6]' : 'text-slate-500';
  const text = isDark ? 'text-[#E8EAED]' : 'text-slate-800';
  return (
    <div className={`rounded-xl border shadow-sm overflow-hidden ${isDark ? 'bg-slate-800/80 border-[#3E4145]' : 'bg-white border-slate-200'}`}>
      <div className={`px-4 py-3 border-b flex items-center justify-between ${isDark ? 'border-[#3E4145]' : 'border-slate-100'}`}>
        <div className={`font-semibold ${text}`}>{title}</div>
        {onClear && <button onClick={onClear} className="text-xs text-red-400 hover:underline">清空</button>}
      </div>
      <div className="max-h-[440px] overflow-y-auto p-3 space-y-3">
        {tasks.length === 0 ? (
          <div className={`py-10 text-center text-sm ${muted}`}>{empty}</div>
        ) : tasks.map(task => (
          <TaskCard key={task.id} task={task} theme={theme} onCancel={onCancel} onOpenPath={onOpenPath} />
        ))}
      </div>
    </div>
  );
}

function TaskCard({ task, theme, onCancel, onOpenPath }) {
  const isDark = theme.primary === 'tech';
  const muted = isDark ? 'text-[#9AA0A6]' : 'text-slate-500';
  const text = isDark ? 'text-[#E8EAED]' : 'text-slate-800';
  const progress = task.totalSteps ? Math.round(((task.completedSteps + task.failedSteps) / task.totalSteps) * 100) : 0;
  const running = task.status === 'running' || task.status === 'queued';
  return (
    <div className={`rounded-lg border p-3 ${isDark ? 'bg-[#202124] border-[#3E4145]' : 'bg-slate-50 border-slate-200'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={`font-medium truncate ${text}`}>{task.scriptName}</div>
          <div className={`text-xs mt-1 ${muted}`}>{formatTime(task.startedAt || task.createdAt)} · {task.deviceRuns?.length || 0} 台设备</div>
        </div>
        <StatusPill status={task.status} />
      </div>
      <div className={`mt-3 h-2 rounded-full overflow-hidden ${isDark ? 'bg-[#2D2F33]' : 'bg-slate-200'}`}>
        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
      </div>
      <div className={`mt-2 text-xs ${muted}`}>完成 {task.completedSteps || 0}，失败 {task.failedSteps || 0}，总计 {task.totalSteps || 0}</div>
      {task.artifactDir && (
        <div className={`mt-2 rounded border px-2 py-2 ${isDark ? 'border-[#3E4145] bg-[#2D2F33]' : 'border-slate-200 bg-white'}`}>
          <div className={`text-[11px] truncate ${muted}`}>{task.artifactDir}</div>
          <button
            onClick={() => onOpenPath?.(task.artifactDir)}
            className={`mt-2 w-full px-2 py-1.5 rounded-lg border text-xs flex items-center justify-center gap-1.5 ${theme.button.secondary}`}
          >
            <FolderOpen size={12} />
            打开目录
          </button>
        </div>
      )}
      {running && (
        <div className="mt-3 space-y-2">
          {(task.deviceRuns || []).map(run => (
            <div key={run.deviceId} className={`rounded border px-2 py-1.5 ${isDark ? 'border-[#3E4145]' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className={`text-xs font-mono truncate ${text}`}>{run.deviceId}</span>
                <StatusPill status={run.status} compact />
              </div>
              {(run.steps || []).slice(-2).map(step => (
                <div key={`${step.id}-${step.index}`} className={`text-[11px] mt-1 truncate ${step.status === 'failed' ? 'text-red-400' : muted}`}>
                  {step.label}{step.error ? `：${step.error}` : step.artifact ? `：${step.artifact}` : ''}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {running && onCancel && (
        <button onClick={() => onCancel(task.id)} className="mt-3 w-full px-3 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 flex items-center justify-center gap-2">
          <Square size={13} />
          取消任务
        </button>
      )}
    </div>
  );
}

function StatusPill({ status, compact }) {
  const map = {
    queued: ['等待中', 'bg-slate-500/10 text-slate-400 border-slate-500/20', Clock3],
    running: ['执行中', 'bg-blue-500/10 text-blue-400 border-blue-500/20', Loader2],
    success: ['成功', 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', CheckCircle2],
    failed: ['失败', 'bg-red-500/10 text-red-400 border-red-500/20', AlertCircle],
    cancelled: ['已取消', 'bg-amber-500/10 text-amber-400 border-amber-500/20', AlertCircle]
  };
  const [label, cls, Icon] = map[status] || map.queued;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border ${compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'} ${cls}`}>
      <Icon size={compact ? 10 : 12} className={status === 'running' ? 'animate-spin' : ''} />
      {label}
    </span>
  );
}

function StatCard({ label, value, theme }) {
  const isDark = theme.primary === 'tech';
  return (
    <div className={`rounded-lg border px-4 py-3 ${isDark ? 'bg-[#2D2F33] border-[#3E4145]' : 'bg-slate-50 border-slate-200'}`}>
      <div className={`text-xs ${isDark ? 'text-[#9AA0A6]' : 'text-slate-500'}`}>{label}</div>
      <div className={`text-xl font-bold mt-1 ${isDark ? 'text-[#E8EAED]' : 'text-slate-800'}`}>{value}</div>
    </div>
  );
}

function TextField({ label, value, onChange, placeholder, isDark }) {
  return (
    <label className="block">
      <FieldLabel label={label} isDark={isDark} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={fieldClass(isDark)} />
    </label>
  );
}

function NumberField({ label, value, onChange, isDark }) {
  return (
    <label className="block">
      <FieldLabel label={label} isDark={isDark} />
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} className={fieldClass(isDark)} />
    </label>
  );
}

function FieldLabel({ label, isDark }) {
  return <span className={`block text-xs font-medium mb-1 ${isDark ? 'text-[#9AA0A6]' : 'text-slate-500'}`}>{label}</span>;
}

function fieldClass(isDark, extra = '') {
  return `w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-emerald-500 ${isDark ? 'bg-[#2D2F33] border-[#5F6368] text-[#E8EAED] placeholder-slate-500' : 'bg-white border-slate-200 text-slate-700 placeholder-slate-400'} ${extra}`;
}

function createEmptyScript() {
  return {
    id: `script-${Date.now()}`,
    name: '新复现脚本',
    description: '',
    continueOnError: true,
    steps: [createStep('shell')]
  };
}

function createStep(type) {
  return {
    id: `step-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    label: getTypeLabel(type),
    command: type === 'shell' ? 'getprop ro.product.model' : '',
    localPath: '',
    remotePath: type === 'pushFile' ? '/sdcard/' : '',
    keyword: '',
    regex: '',
    outputBaseDir: '',
    includeBugreport: false,
    includeAiSummary: true,
    timeoutMs: type === 'waitLog' ? 60000 : 30000,
    intervalMs: 2000,
    durationMs: 1000,
    continueOnError: false
  };
}

function getTypeLabel(type) {
  return STEP_TYPES.find(item => item.value === type)?.label || '执行步骤';
}

function cloneScript(script) {
  return JSON.parse(JSON.stringify(script || createEmptyScript()));
}

function formatTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('zh-CN');
}

export default TaskCenter;
