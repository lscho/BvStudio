import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyProject } from "@/domain/project";
import type { MotionMatchingFeedbackRecord } from "@/services/motionMatchingFeedback";
import { MotionMatchingFeedbackDialog } from "@/components/MotionMatchingFeedbackDialog";

const feedbackMocks = vi.hoisted(() => ({
  read: vi.fn(),
  review: vi.fn()
}));

vi.mock("@/services/motionMatchingFeedback", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/services/motionMatchingFeedback")>(),
  readMotionMatchingFeedback: feedbackMocks.read,
  reviewMotionMatchingFeedback: feedbackMocks.review
}));

const record: MotionMatchingFeedbackRecord = {
  id: "feedback-1",
  projectId: "project-1",
  projectName: "测试工程",
  createdAt: "2026-09-08T00:00:00.000Z",
  status: "pending",
  subtitleIds: ["subtitle-1"],
  selection: [{
    segmentId: "segment-1",
    startCaptionIndex: 0,
    endCaptionIndex: 0,
    title: "制作痛点",
    intent: "pain",
    primaryEffectId: "pain-points",
    secondaryEffectId: null,
    materialNeed: ""
  }],
  initialClips: [{
    clipId: "removed-effect",
    sourceSubtitleId: "subtitle-1",
    kind: "composition",
    effectId: "pain-points",
    startUs: 0,
    durationUs: 3_000_000,
    x: 50,
    y: 35,
    scale: 1,
    bindingSignature: ""
  }]
};

describe("MotionMatchingFeedbackDialog", () => {
  beforeEach(() => {
    feedbackMocks.read.mockReset().mockResolvedValue([record]);
    feedbackMocks.review.mockReset().mockImplementation(async (_id, _project, status) => ({
      ...record,
      status,
      reviewedAt: "2026-09-08T01:00:00.000Z",
      finalClips: [],
      report: { retainedCount: 0, removedCount: 1, addedCount: 0, replacedCount: 0, retimedCount: 0, movedCount: 0, resizedCount: 0, materialChangedCount: 0, densityDelta: -1 }
    }));
  });

  it("shows current edits and requires confirmation before forming a preference", async () => {
    const project = createEmptyProject();
    project.name = "测试工程";
    project.id = "project-1";
    render(<MotionMatchingFeedbackDialog open project={project} onOpenChange={vi.fn()} />);

    expect(await screen.findByText(/痛点清单卡/)).toBeInTheDocument();
    expect(screen.getByText("删除")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "采纳为偏好" }));
    await waitFor(() => expect(feedbackMocks.review).toHaveBeenCalledWith("feedback-1", project, "confirmed"));
    expect(await screen.findByText("已采纳")).toBeInTheDocument();
  });
});
