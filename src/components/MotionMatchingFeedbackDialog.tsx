import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, History, LoaderCircle, X } from "lucide-react";
import { allCompositions } from "@/domain/effects";
import type { EditorProject } from "@/domain/project";
import {
  buildMotionFeedbackReport,
  readMotionMatchingFeedback,
  reviewMotionMatchingFeedback,
  type MotionFeedbackReport,
  type MotionMatchingFeedbackRecord
} from "@/services/motionMatchingFeedback";

interface Props {
  open: boolean;
  project: EditorProject;
  onOpenChange: (open: boolean) => void;
}

const effectNames = new Map(allCompositions().map((effect) => [effect.id, effect.name]));

function feedbackReport(record: MotionMatchingFeedbackRecord, project: EditorProject) {
  return record.status === "pending" ? buildMotionFeedbackReport(record, project) : record.report ?? buildMotionFeedbackReport(record, project);
}

function reportItems(report: MotionFeedbackReport) {
  return [
    { label: "保留", value: report.retainedCount },
    { label: "删除", value: report.removedCount },
    { label: "新增", value: report.addedCount },
    { label: "替换", value: report.replacedCount },
    { label: "改时长", value: report.retimedCount },
    { label: "改位置", value: report.movedCount },
    { label: "改大小", value: report.resizedCount },
    { label: "换素材", value: report.materialChangedCount }
  ].filter((item) => item.value > 0 || item.label === "保留");
}

function selectionNames(record: MotionMatchingFeedbackRecord) {
  const ids = [...new Set(record.selection.flatMap((segment) => [segment.primaryEffectId, segment.secondaryEffectId].filter((id): id is string => Boolean(id))))];
  return ids.map((id) => effectNames.get(id) ?? id).join("、") || "未选择动效";
}

export function MotionMatchingFeedbackDialog({ open, project, onOpenChange }: Props) {
  const [records, setRecords] = useState<MotionMatchingFeedbackRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError("");
    void readMotionMatchingFeedback(project.id).then((result) => {
      if (active) setRecords(result);
    }).catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : "无法读取匹配记录");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [open, project.id]);

  const pendingCount = useMemo(() => records.filter((record) => record.status === "pending").length, [records]);

  async function review(recordId: string, status: "confirmed" | "ignored") {
    setReviewingId(recordId);
    setError("");
    try {
      const reviewed = await reviewMotionMatchingFeedback(recordId, project, status);
      setRecords((current) => current.map((record) => record.id === reviewed.id ? reviewed : record));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法更新匹配记录");
    } finally {
      setReviewingId(null);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content motion-feedback-dialog" aria-describedby="motion-feedback-description">
          <Dialog.Close className="icon-button dialog-close" aria-label="关闭"><X size={18} /></Dialog.Close>
          <div className="dialog-title-row">
            <History size={19} aria-hidden="true" />
            <div>
              <span className="eyebrow">MATCH REVIEW</span>
              <Dialog.Title>动效匹配记录</Dialog.Title>
              <Dialog.Description id="motion-feedback-description">对比 AI 初选与当前时间线。只有采纳的记录会作为后续匹配的软偏好。</Dialog.Description>
            </div>
          </div>
          <div className="motion-feedback-summary">
            <span><strong>{records.length}</strong> 次匹配</span>
            <span><strong>{pendingCount}</strong> 条待确认</span>
          </div>
          {loading ? <div className="motion-feedback-empty"><LoaderCircle className="spin" size={16} />正在读取记录</div>
            : records.length ? <div className="motion-feedback-list">
              {records.map((record) => {
                const report = feedbackReport(record, project);
                const reviewing = reviewingId === record.id;
                return <article className="motion-feedback-record" key={record.id}>
                  <header>
                    <span><strong>{new Date(record.createdAt).toLocaleString("zh-CN", { hour12: false })}</strong><small>{record.selection.length} 个语义段 · {selectionNames(record)}</small></span>
                    <i data-status={record.status}>{record.status === "pending" ? "待确认" : record.status === "confirmed" ? "已采纳" : "已忽略"}</i>
                  </header>
                  <div className="motion-feedback-diffs" aria-label="匹配修改统计">
                    {reportItems(report).map((item) => <span key={item.label}><b>{item.value}</b>{item.label}</span>)}
                  </div>
                  <footer>
                    <small>层数变化 {report.densityDelta > 0 ? `+${report.densityDelta}` : report.densityDelta}</small>
                    {record.status === "pending" && <div>
                      <button className="button secondary" type="button" disabled={reviewing} onClick={() => void review(record.id, "ignored")}>忽略</button>
                      <button className="button primary" type="button" disabled={reviewing} onClick={() => void review(record.id, "confirmed")}>{reviewing ? <LoaderCircle className="spin" size={14} /> : <Check size={14} />}采纳为偏好</button>
                    </div>}
                  </footer>
                </article>;
              })}
            </div> : <div className="motion-feedback-empty">完成一次动效匹配后，这里会记录 AI 初选与后续编辑差异。</div>}
          {error && <p className="error-text" role="alert">{error}</p>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
