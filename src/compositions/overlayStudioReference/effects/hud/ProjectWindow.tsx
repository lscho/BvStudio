import type { EffectDef, EffectProps } from "../types";
import { useEnter } from "../useAnimation";
import { OFFSET_CONTROLS, OFFSET_DEFAULTS, offsetVars, THEME_OPTIONS } from "./accent";

export interface ProjectWindowParams {
  theme: "dark" | "light";
  position: "center" | "left" | "right";
  title: string;
  files: string; // "文件名,动作|..."
  offsetX?: number;
  offsetY?: number;
}

// 动作 → 语义色(你的家族色)
const ACTION_COLOR: Record<string, string> = {
  新建: "var(--hud-teal)",
  新增: "var(--hud-teal)",
  修改: "var(--hud-blue)",
  整理: "var(--hud-violet)",
  删除: "var(--hud-alert)",
};
const STAGGER = 200;

function ProjectWindow({ params, playToken }: EffectProps<ProjectWindowParams>) {
  const { position, title, files } = params;
  const entered = useEnter(playToken);
  const rows = files.split("|").map((f) => {
    const [name, action] = f.split(",");
    return { name: (name ?? "").trim(), action: (action ?? "").trim() };
  });

  return (
    <div
      className={`hud pw hud-anchor hud-anchor--${position} ${entered ? "is-in" : ""}`}
      style={offsetVars(params)}
    >
      <div className="pw-win">
        <div className="pw-bar">
          <span className="pw-dot r" />
          <span className="pw-dot y" />
          <span className="pw-dot g" />
          <span className="pw-title">{title}</span>
        </div>
        <div className="pw-body">
          {rows.map((row, i) => (
            <div className="pw-row" key={i} style={{ transitionDelay: `${i * STAGGER}ms` }}>
              <span className="pw-fic">{"{}"}</span>
              <span className="pw-name">{row.name}</span>
              {row.action && (
                <span
                  className="pw-chip"
                  style={{ ["--pw-c" as string]: ACTION_COLOR[row.action] ?? "var(--hud-muted)" }}
                >
                  {row.action}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const projectWindowDef: EffectDef<ProjectWindowParams> = {
  id: "project-window",
  vTier: "full",
  name: "ProjectWindow",
  description: "项目窗口 · 文件行逐条掉入 + 动作标签",
  tags: ["逐条落位"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "center",
    title: "项目窗口 — 文件变更",
    files: "新建的文件.md,新建|改过的文件.js,修改|整理的文件.css,整理|删掉的文件.txt,删除",
    ...OFFSET_DEFAULTS,
  },
  controls: [
    { key: "theme", label: "底色(此卡独立生效)", type: "select", options: THEME_OPTIONS },
    {
      key: "position",
      label: "落位",
      type: "select",
      options: [
        { label: "居中", value: "center" },
        { label: "右侧", value: "right" },
        { label: "左侧", value: "left" },
      ],
    },
    { key: "title", label: "窗口标题", type: "text" },
    { key: "files", label: "文件(文件名,动作 用 | 分隔;动作:新建/修改/整理/删除)", type: "text" },
    ...OFFSET_CONTROLS,
  ],
  Component: ProjectWindow,
};
