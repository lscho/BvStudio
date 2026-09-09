import restrictions from "@/domain/shotcraftLibrary/aiRestrictions.json";

export function shotcraftAdaptationIssue(id: string) {
  const item = restrictions.find((entry) => entry.id === id);
  if (!item) return undefined;
  return item.kind === "layout"
    ? "此镜头按参考页面坐标裁切素材，需要适配页面布局，暂不参与 AI 自动编排。"
    : "此镜头含尚未参数化的示例内容，需要定制后用于产品成片，暂不参与 AI 自动编排。";
}
