import { storyboardInformationCardIssue } from "@/domain/storyboard";

const quietCards = ["checklist", "term-card", "ring-metric", "rank-bars", "glow-badges", "strike-flip", "quad-map"] as const;
const profiles: Readonly<Record<string, { label: string; cardIds: readonly string[]; position: "left" }>> = {
  "shotcraft-glow-orb-ambient": { label: "柔和光斑底层＋单一信息主体", cardIds: quietCards, position: "left" },
  "shotcraft-radial-wave": { label: "低对比点阵底层＋指标、并列栏目或风险矩阵", cardIds: ["checklist", "ring-metric", "rank-bars", "glow-badges", "quad-map"], position: "left" }
};

export function shotcraftPairingProfile(id: string): typeof profiles[string] | undefined { return profiles[id]; }

export function shotcraftVisualPairAllowed(baseId: string, cardId: string) {
  return Boolean(profiles[baseId]?.cardIds.includes(cardId) && !storyboardInformationCardIssue(cardId));
}
