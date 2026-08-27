import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, Download, HardDrive, LoaderCircle, Square, Trash2 } from "lucide-react";
import {
  cancelAsrJob,
  getAsrModelCatalog,
  getAsrRuntimeStatus,
  removeAsrModel,
  startAsrModelDownload,
  startAsrRuntimeInstall,
  type AsrJobEvent,
  type AsrModelInfo
} from "@/services/asr";
import { isDesktopRuntime } from "@/services/runtime";

interface Props {
  pythonPath: string;
  modelPath: string;
  alignerPath: string;
  onChange: (patch: { pythonPath?: string; modelPath?: string; alignerPath?: string }) => void;
}

function formatBytes(bytes: number) {
  if (bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** index).toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
}

export function AsrModelManager({ pythonPath, modelPath, alignerPath, onChange }: Props) {
  const [models, setModels] = useState<AsrModelInfo[]>([]);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [runtimeMessage, setRuntimeMessage] = useState("");
  const [activeJobId, setActiveJobId] = useState("");
  const [progress, setProgress] = useState<AsrJobEvent | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!isDesktopRuntime()) return;
    const [catalog, runtime] = await Promise.all([
      getAsrModelCatalog(),
      getAsrRuntimeStatus(pythonPath.trim() || "python3")
    ]);
    setModels(catalog);
    setRuntimeReady(runtime.ready);
    setRuntimeMessage(runtime.message);
  }, [pythonPath]);

  useEffect(() => {
    void refresh().catch((exception) => setError(exception instanceof Error ? exception.message : "无法读取本地模型状态"));
  }, [refresh]);

  async function installRuntime() {
    setError("");
    setProgress(null);
    const job = startAsrRuntimeInstall(pythonPath.trim() || "python3", setProgress);
    setActiveJobId(job.jobId);
    try {
      const managedPython = await job.result;
      onChange({ pythonPath: managedPython });
      setRuntimeReady(true);
      setRuntimeMessage("Qwen3-ASR 本地环境可用");
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "运行时安装失败");
    } finally {
      setActiveJobId("");
      await refresh().catch(() => undefined);
    }
  }

  async function download(model: AsrModelInfo) {
    setError("");
    setProgress(null);
    const job = startAsrModelDownload(model.repository, setProgress);
    setActiveJobId(job.jobId);
    try {
      const path = await job.result;
      onChange(model.kind === "aligner" ? { alignerPath: path } : { modelPath: path });
      await refresh();
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "模型下载失败");
    } finally {
      setActiveJobId("");
    }
  }

  async function remove(model: AsrModelInfo) {
    if (!window.confirm(`删除本机模型“${model.name}”？未完成的下载文件也会一并删除。`)) return;
    setError("");
    try {
      await removeAsrModel(model.repository);
      if (model.path === modelPath) onChange({ modelPath: "" });
      if (model.path === alignerPath) onChange({ alignerPath: "" });
      await refresh();
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "模型删除失败");
    }
  }

  async function cancel() {
    if (activeJobId) await cancelAsrJob(activeJobId);
  }

  if (!isDesktopRuntime()) return <p className="muted-text">本地模型管理在桌面客户端中可用。</p>;
  const percent = progress?.totalBytes ? Math.min(100, Math.round(progress.downloadedBytes / progress.totalBytes * 100)) : null;
  return (
    <section className="asr-manager">
      <div className="runtime-row"><span><HardDrive size={15} /><span><strong>本地运行时</strong><small>{runtimeMessage || "检查中"}</small></span></span>{runtimeReady ? <BadgeCheck className="verified" size={17} /> : <button className="button secondary" type="button" disabled={Boolean(activeJobId)} onClick={() => void installRuntime()}>{activeJobId ? <LoaderCircle className="spin" size={14} /> : <Download size={14} />}安装运行时</button>}</div>
      <div className="asr-model-list">{models.map((model) => {
        const selected = model.path === modelPath || model.path === alignerPath;
        return <div key={model.repository}><span><strong>{model.name}</strong><small>{model.kind === "aligner" ? "时间戳对齐" : model.recommended ? "语音识别 · 推荐" : "语音识别"}{model.installedBytes ? ` · ${formatBytes(model.installedBytes)}` : ""}</small></span>{model.installed ? <><button className={`button secondary ${selected ? "selected-model" : ""}`} type="button" disabled={Boolean(activeJobId)} onClick={() => onChange(model.kind === "aligner" ? { alignerPath: model.path } : { modelPath: model.path })}>{selected ? <BadgeCheck size={14} /> : null}{selected ? "已使用" : "使用"}</button><button className="icon-button danger-action" type="button" aria-label={`删除 ${model.name}`} title="删除本地模型" disabled={Boolean(activeJobId)} onClick={() => void remove(model)}><Trash2 size={14} /></button></> : <button className="button secondary" type="button" disabled={Boolean(activeJobId)} onClick={() => void download(model)}><Download size={14} />下载</button>}</div>;
      })}</div>
      {progress && <div className="asr-progress"><div><span style={{ width: `${percent ?? Math.max(8, progress.filesTotal ? progress.filesCompleted / progress.filesTotal * 100 : 15)}%` }} /></div><span><small>{progress.message}</small><small>{percent === null ? `${progress.filesCompleted}/${progress.filesTotal || "-"}` : `${percent}% · ${formatBytes(progress.downloadedBytes)} / ${formatBytes(progress.totalBytes)}`}</small></span>{activeJobId && <button className="icon-button" type="button" aria-label="取消本地模型任务" title="取消" onClick={() => void cancel()}><Square size={12} fill="currentColor" /></button>}</div>}
      {error && <p className="error-text" role="alert">{error}</p>}
    </section>
  );
}
