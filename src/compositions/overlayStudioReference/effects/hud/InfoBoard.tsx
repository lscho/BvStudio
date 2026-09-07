import type { EffectDef, EffectProps } from "../types";
import { useCountUp, useEnter } from "../useAnimation";
import { useCardElapsed } from "./useTimelineTime";
import { MediaImg } from "./MediaImg";
import { hasVecIcon, VecIcon } from "./vecIcons";
import {
  ACCENT_OPTIONS,
  ACCENT_VAR,
  OFFSET_CONTROLS,
  OFFSET_DEFAULTS,
  offsetVars,
  THEME_OPTIONS,
} from "./accent";

export interface InfoBoardParams {
  theme: "dark" | "light";
  position: "center" | "left" | "right";
  /** 一行一条,格式「类型|字段…」,支持 10 种类型(见 controls 说明) */
  rows: string;
  /** 每行点亮时刻(距卡片开始的秒数,| 分隔,按 SRT 卡点填) */
  times: string;
  /** 玻璃底板:dark 黑玻璃 / light 白玻璃 / none 无(画面本身够暗时) */
  bg: "dark" | "light" | "none";
  /** 行强调方式:讲到某行时 lit 点亮(默认) / zoom 稍微放大 / both 点亮+放大 */
  rowFx?: "lit" | "zoom" | "both";
  /** 底板透明度(0.2-1,越小越透);预览与导出一致 */
  bgAlpha?: number;
  /** 随讲述长高:还没点亮的行不占位,板跟着内容一行行"长"出来(默认关 = 预留全高) */
  grow?: boolean;
  accent: string;
  offsetX?: number;
  offsetY?: number;
}

interface Row {
  type: string;
  a: string;
  b: string;
  c: string;
  /** 行级缩放(类型后加 @倍数,如 kv@1.4):只放大/缩小这一行,不影响别的行 */
  size?: number;
}

function parseRows(raw: string): Row[] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [typeRaw = "", a = "", b = "", c = ""] = l.split("|").map((s) => s.trim());
      // 类型段支持 @倍数 后缀:kv@1.4 = 这行放大到 1.4 倍(0.5~2.5 之外视为笔误忽略)
      const [type, sizeRaw] = typeRaw.split("@");
      const parsed = parseFloat(sizeRaw);
      const size = Number.isFinite(parsed) && parsed >= 0.5 && parsed <= 2.5 ? parsed : undefined;
      return { type: type.trim(), a, b, c, size };
    });
}

/** 滚动计数行的数字部分:行点亮时开始滚(吃倍速,导出虚拟时间安全) */
function CountRow({ r, on }: { r: Row; on: boolean }) {
  // a=前缀(可空) b=目标数字(可带千分位) c=后缀/单位
  const target = parseFloat(r.b.replace(/[,\s]/g, "")) || 0;
  const shown = useCountUp(on ? target : 0, 1400, on ? 1 : 0);
  return (
    <div className="ibd-count">
      {r.a && <em>{r.a}</em>}
      <b>{Math.round(shown).toLocaleString()}</b>
      {r.c && <i>{r.c}</i>}
    </div>
  );
}

function RowView({ r, on }: { r: Row; on: boolean }) {
  switch (r.type) {
    case "count":
      return <CountRow r={r} on={on} />;
    case "chip":
      // 中性胶囊行:a=文字 b=矢量图标名(可空)——产品名/版本号("DeepSeek V4 PRO · API"式)
      return (
        <div className="ibd-chip">
          {r.b && hasVecIcon(r.b) && <VecIcon name={r.b} size={18} />}
          <span>{r.a}</span>
        </div>
      );
    case "note":
      // mono 小注行:来源/口径("NEWS · 7/14 · 一个人手搓"式)
      return <div className="ibd-note">{r.a}</div>;
    case "mult":
      // 倍数徽章行:a=名目 b=主值 c=×N 徽章("≈333万 · 差 ×34"式量级差)
      return (
        <div className="ibd-mult">
          <span className="ibd-mult-label">{r.a}</span>
          <b>{r.b}</b>
          {r.c && <i>{r.c}</i>}
        </div>
      );
    case "icons": {
      // 横排图标行:a=逗号分隔,每个是矢量图标名或图片路径("Codex+OpenAI logo 一排"式)
      // 每一项可以再跟一个空格 + 标注("target 位置"),标注就落在这枚图标正下方,
      // 比把一串词堆在行尾更好读;不写标注就还是老样子,b 当行尾小注
      const items = r.a.split(",").map((s) => s.trim()).filter(Boolean).map((entry) => {
        const sp = entry.indexOf(" ");
        return sp > 0
          ? { src: entry.slice(0, sp), label: entry.slice(sp + 1).trim() }
          : { src: entry, label: "" };
      });
      const labeled = items.some((it) => it.label);
      return (
        <div className={`ibd-icons${labeled ? " is-labeled" : ""}`}>
          {items.map((it, i) => (
            <span className="ibd-icons-slot" key={i}>
              <span className={`ibd-icons-cell${hasVecIcon(it.src) ? " is-vec" : ""}`}>
                {hasVecIcon(it.src) ? (
                  <VecIcon name={it.src} size={labeled ? 32 : 30} />
                ) : (
                  <MediaImg src={it.src} className="ibd-icons-img" />
                )}
              </span>
              {it.label && <span className="ibd-icons-lab">{it.label}</span>}
            </span>
          ))}
          {r.b && <span className="ibd-icons-note">{r.b}</span>}
        </div>
      );
    }
    case "spark": {
      // 迷你趋势行:a=名目 b=up/down c=幅度注
      // 基线 + 渐隐面积 + 画出的曲线 + 末端光点,比一根斜杠像个图表
      const up = r.b !== "down";
      const line = up
        ? "M3 30 C 26 27, 46 20, 72 13 S 104 6, 121 4"
        : "M3 4 C 26 7, 46 14, 72 21 S 104 28, 121 30";
      const area = `${line} L121 34 L3 34 Z`;
      const endY = up ? 4 : 30;
      return (
        <div className="ibd-spark">
          <span className="ibd-spark-label">{r.a}</span>
          <svg className="ibd-spark-svg" width="126" height="38" viewBox="0 0 126 38" style={{ overflow: "visible" }}>
            <line className="ibd-spark-base" x1="3" y1="34" x2="121" y2="34" />
            <path className={`ibd-spark-area ${up ? "is-up" : "is-down"}`} d={area} />
            <path className={`ibd-spark-path ${up ? "is-up" : "is-down"}`} d={line} pathLength={1} />
            <circle className={`ibd-spark-halo ${up ? "is-up" : "is-down"}`} cx={121} cy={endY} r={7.5} />
            <circle className={`ibd-spark-dot ${up ? "is-up" : "is-down"}`} cx={121} cy={endY} r={3.4} />
          </svg>
          {r.c && <b className={`ibd-spark-val ${up ? "is-up" : "is-down"}`}>{r.c}</b>}
        </div>
      );
    }
    case "ring": {
      // 迷你圆环占比行:a=名目 b=百分比(0-100) c=数值文字(空=显示 b%)
      const pct = Math.max(0, Math.min(100, parseFloat(r.b) || 0));
      return (
        <div className="ibd-ringrow">
          <svg width="46" height="46" viewBox="0 0 46 46">
            <circle className="ibd-ringrow-bg" cx="23" cy="23" r="18" />
            <circle
              className="ibd-ringrow-fg"
              cx="23"
              cy="23"
              r="18"
              pathLength={100}
              style={{ ["--ring-off" as string]: 100 - pct }}
            />
          </svg>
          <div className="ibd-ringrow-txt">
            <b>{r.c || `${pct}%`}</b>
            <span>{r.a}</span>
          </div>
        </div>
      );
    }
    case "dots": {
      // 点阵比例行:a=名目 b=总点数 c=点亮数——"10 个里 8 个"具象化,点逐个亮
      const total = Math.max(1, Math.min(30, parseInt(r.b) || 10));
      const hot = Math.max(0, Math.min(total, parseInt(r.c) || 0));
      return (
        <div className="ibd-dotsrow">
          <span className="ibd-dotsrow-label">{r.a}</span>
          <span className="ibd-dotsrow-grid">
            {Array.from({ length: total }, (_, i) => (
              <i
                key={i}
                className={i < hot ? "is-hot" : ""}
                style={{ transitionDelay: `${i * 55}ms` }}
              />
            ))}
          </span>
          <b className="ibd-dotsrow-val">
            {hot}/{total}
          </b>
        </div>
      );
    }
    case "head":
      return (
        <div className="ibd-head">
          <div className="ibd-head-a">{r.a}</div>
          <div className="ibd-head-b">
            {r.b}
            {r.c && <span className="ibd-head-en">{r.c}</span>}
          </div>
        </div>
      );
    case "tag":
      return (
        <div className="ibd-tag">
          <i />
          <span>{r.a}</span>
        </div>
      );
    case "bar": {
      const pct = Math.max(0, Math.min(100, parseFloat(r.b) || 0));
      return (
        <div className="ibd-bar">
          <span className="ibd-bar-label">{r.a}</span>
          <span className="ibd-bar-track" style={{ ["--bar-pct" as string]: `${pct}%` }}>
            <i />
          </span>
          <span className="ibd-bar-val">{r.c}</span>
        </div>
      );
    }
    case "kv":
      return (
        <div className="ibd-kv">
          <span className="ibd-kv-label">{r.a}</span>
          <span className="ibd-kv-num">{r.b}</span>
          {r.c && <span className="ibd-kv-note">{r.c}</span>}
        </div>
      );
    case "quote":
      return (
        <div className="ibd-quote">
          <div className="ibd-quote-text">
            <em>“</em>
            {r.a}
          </div>
          {r.b && <div className="ibd-quote-tag">{r.b}</div>}
        </div>
      );
    case "shift":
      return (
        <div className="ibd-shift">
          <span className="ibd-shift-label">{r.a}</span>
          <span className="ibd-shift-from">{r.b}</span>
          <span className="ibd-shift-arrow">→</span>
          <span className="ibd-shift-to">{r.c}</span>
        </div>
      );
    case "line": {
      // 时间线行:a = 「标签 ✗/✓ 说明 ; 标签 ✗/✓ 说明 ; …」(✗ 红 ✓ 绿,其余中性)
      const nodes = r.a.split(";").map((seg) => {
        const parts = seg.trim().split(/\s+/);
        const si = parts.findIndex((w) => w === "✗" || w === "✓");
        return {
          label: si >= 0 ? parts.slice(0, si).join(" ") : parts[0] ?? "",
          mark: si >= 0 ? parts[si] : "",
          note: si >= 0 ? parts.slice(si + 1).join(" ") : parts.slice(1).join(" "),
        };
      });
      return (
        <div className="ibd-line">
          <i className="ibd-line-track" />
          {nodes.map((n, i) => (
            <div className="ibd-line-node" key={i}>
              <span className="ibd-line-label">{n.label}</span>
              <i className={`ibd-line-dot ${n.mark === "✗" ? "is-no" : n.mark === "✓" ? "is-yes" : ""}`} />
              {n.note && (
                <span className={`ibd-line-note ${n.mark === "✗" ? "is-no" : n.mark === "✓" ? "is-yes" : ""}`}>
                  {n.note}
                </span>
              )}
            </div>
          ))}
        </div>
      );
    }
    case "vs": {
      // 比分行:a=左值 b=右值 c=名目;大的绿、小的红、平局金
      const l = parseFloat(r.a);
      const rr = parseFloat(r.b);
      const cls = (v: number, o: number) => (v > o ? "is-win" : v < o ? "is-lose" : "is-tie");
      return (
        <div className="ibd-vs">
          {r.c && <span className="ibd-vs-label">{r.c}</span>}
          <b className={cls(l, rr)}>{r.a}</b>
          <i>:</i>
          <b className={cls(rr, l)}>{r.b}</b>
        </div>
      );
    }
    case "ent":
      return (
        <div className="ibd-ent">
          {r.a ? (
            <MediaImg src={r.a} className="ibd-ent-img" />
          ) : (
            <span className="ibd-ent-ph">{(r.b || "?").slice(0, 1)}</span>
          )}
          <div>
            <div className="ibd-ent-name">{r.b}</div>
            {r.c && <div className="ibd-ent-sub">{r.c}</div>}
          </div>
        </div>
      );
    case "formula": {
      // 公式行:a=矢量图标名(可空) b=公式文本(= 和 → 分节自动配色:首白/中间点缀色/→后绿)
      const segs: { op: string | null; text: string }[] = [];
      let buf = "";
      let op: string | null = null;
      for (const ch of r.b) {
        if (ch === "=" || ch === "→") {
          segs.push({ op, text: buf.trim() });
          buf = "";
          op = ch;
        } else buf += ch;
      }
      segs.push({ op, text: buf.trim() });
      const shown = segs.filter((s) => s.text || s.op);
      const lastArrow = shown.map((s) => s.op).lastIndexOf("→");
      return (
        <div className="ibd-formula">
          {r.a && hasVecIcon(r.a) && (
            <span className="ibd-formula-ic">
              <VecIcon name={r.a} size={20} />
            </span>
          )}
          {shown.map((s, i) => (
            <span key={i} className="ibd-formula-seg">
              {s.op && <em>{s.op}</em>}
              <b className={i === 0 ? "is-a" : lastArrow >= 0 && i >= lastArrow ? "is-c" : "is-b"}>
                {s.text}
              </b>
            </span>
          ))}
        </div>
      );
    }
    case "img":
      // 证据图行:a=图/视频路径(空=虚线占位) b=标注小字
      return (
        <div className="ibd-img">
          {r.a ? (
            <MediaImg src={r.a} className="ibd-img-media" />
          ) : (
            <div className="ibd-img-ph">信息板素材</div>
          )}
          {r.b && <div className="ibd-img-cap">{r.b}</div>}
        </div>
      );
    case "strike": {
      // 反转行(strike-flip 板内版):a=被划掉的旧认知 b=砸出的真相
      return (
        <div className="ibd-strike">
          <span className="ibd-strike-old">{r.a}</span>
          <b className="ibd-strike-new">{r.b}</b>
        </div>
      );
    }
    case "check": {
      // 打勾行(checklist 板内版):a=文字 b=x 则为红叉(默认绿勾),一项一行按卡点亮
      const bad = r.b === "x" || r.b === "✗";
      return (
        <div className="ibd-checkrow">
          <span className={`ibd-checkrow-ic ${bad ? "is-bad" : ""}`}>
            <VecIcon name={bad ? "x" : "check"} size={17} />
          </span>
          <span className="ibd-checkrow-txt">{r.a}</span>
        </div>
      );
    }
    case "compare": {
      // 双条对比行(compare-split 板内版):a="强调项 数值" b="对照项 数值" c=名目(可空)
      const pa = r.a.match(/^(.*?)\s+([\d.]+)$/);
      const pb = r.b.match(/^(.*?)\s+([\d.]+)$/);
      const la = pa ? pa[1] : r.a;
      const va = pa ? parseFloat(pa[2]) : 0;
      const lb = pb ? pb[1] : r.b;
      const vb = pb ? parseFloat(pb[2]) : 0;
      const max = Math.max(va, vb, 1);
      return (
        <div className="ibd-cmp">
          {r.c && <div className="ibd-cmp-title">{r.c}</div>}
          <div className="ibd-cmp-line">
            <span className="ibd-cmp-label">{la}</span>
            <span className="ibd-cmp-track">
              <i className="ibd-cmp-a" style={{ width: `${(va / max) * 100}%` }} />
            </span>
            <b className="ibd-cmp-va">{va}</b>
          </div>
          <div className="ibd-cmp-line">
            <span className="ibd-cmp-label">{lb}</span>
            <span className="ibd-cmp-track">
              <i className="ibd-cmp-b" style={{ width: `${(vb / max) * 100}%` }} />
            </span>
            <b className="ibd-cmp-vb">{vb}</b>
          </div>
        </div>
      );
    }
    case "term": {
      // 术语行(term-card 板内版):a=EN b=术语 c=一句话定义
      return (
        <div className="ibd-term">
          <em>{r.a}</em>
          <b>{r.b}</b>
          {r.c && <span>{r.c}</span>}
        </div>
      );
    }
    case "pill": {
      // 胶囊标签行(Levi 黑卡顶部的 COST 式小标签):a/b/c 各一枚,强调色底黑字
      return (
        <div className="ibd-pill">
          {[r.a, r.b, r.c].filter(Boolean).map((t, i) => (
            <b key={i}>{t}</b>
          ))}
        </div>
      );
    }
    case "stat":
      return (
        <div className="ibd-stat">
          {r.c && hasVecIcon(r.c) && (
            <span className="ibd-stat-ic">
              <VecIcon name={r.c} size={24} />
            </span>
          )}
          <span className="ibd-stat-txt">
            {r.a && <em>{r.a}</em>}
            <b>{r.b}</b>
          </span>
          <span className="ibd-stat-warn">
            <VecIcon name="warn" size={22} />
          </span>
        </div>
      );
    case "stamp":
      return (
        <div className="ibd-stamp">
          <div className="ibd-stamp-zh">{r.a}</div>
          {r.b && <div className="ibd-stamp-en">{r.b}</div>}
        </div>
      );
    // seal 和 stamp 说的是同一件事(给论点盖个定论),但视觉语言正好相反:
    // stamp 是「描边 + 倾斜 + 辉光 + 砸下来」,seal 是「实心 + 摆正 + 反白 + 横着抹开」。
    // 同一板里别混用,挑一个。
    case "seal":
      return (
        <div className="ibd-seal">
          <span className="ibd-seal-zh">{r.a}</span>
          {r.b && <span className="ibd-seal-en">{r.b}</span>}
        </div>
      );
    default:
      return <div className="ibd-plain">{r.a}</div>;
  }
}

/**
 * 累积信息板:一块常驻在画面一侧的"论点板",
 * 随讲述按 times 逐行点亮——大标题、红框标签、数据条、大数字、
 * 引语、前后对比、红章。已讲过的行压暗,正在讲的行最亮,
 * 整板陪跑一个论点(常 15~30s),代替"加一堆快闪小卡"。
 */
function InfoBoard({ params, playToken }: EffectProps<InfoBoardParams>) {
  const { position, rows, times, bg, rowFx, bgAlpha, grow, accent } = params;
  const entered = useEnter(playToken);
  const elapsed = useCardElapsed(params, playToken);
  const list = parseRows(rows);
  const ts = times.split("|").map((s) => parseFloat(s.trim()));

  let latest = -1;
  list.forEach((_, i) => {
    if (elapsed >= (Number.isFinite(ts[i]) ? ts[i] : i * 2.5)) latest = i;
  });

  return (
    <div
      className={`hud ibd hud-anchor hud-anchor--${position} ${entered ? "is-in" : ""} ${
        bg === "none" ? "ibd--nobg" : bg === "light" ? "ibd--light" : ""
      } ${rowFx === "zoom" || rowFx === "both" ? `ibd--fx-${rowFx}` : ""} ${grow ? "ibd--grow" : ""}`}
      style={{
        ["--hud-acc" as string]: ACCENT_VAR[accent],
        ...(typeof bgAlpha === "number" ? { ["--ibd-bg-alpha" as string]: bgAlpha } : {}),
        ...offsetVars(params),
      }}
    >
      <div className="ibd-panel">
        {(grow ? list.slice(0, latest + 1) : list).map((r, i) => (
          <div
            className={`ibd-row ${i <= latest ? "is-on" : ""} ${
              i < latest ? "is-past" : ""
            }`}
            key={i}
            /* zoom 参与布局(行不会互相压住),预览与导出同为 Chromium,表现一致 */
            style={r.size ? { zoom: r.size } : undefined}
          >
            <RowView r={r} on={i <= latest} />
          </div>
        ))}
      </div>
    </div>
  );
}

export const infoBoardDef: EffectDef<InfoBoardParams> = {
  id: "info-board",
  vTier: "full",
  name: "InfoBoard",
  description: "累积信息板 · 论点板逐行点亮长驻留",
  tags: ["逐条落位"],
  selfPosition: true,
  defaults: {
    theme: "dark",
    position: "left",
    rows:
      "head|大标题写这一行|强调词变红|HEADLINE\n" +
      "tag|红框标签 · 给论点定性\n" +
      "bar|数据条的名目|72|72%\n" +
      "kv|大数字|¥1,000 万|小注跟在后面\n" +
      "quote|引语放这一行 一句就好|署名 · 出处写在这\n" +
      "ent||实体名牌写人名或机构|身份小注(头像传图后填路径)\n" +
      "vs|72|28|比分行写名目\n" +
      "line|早先 ✗ 第一次没成 ; 后来 ✓ 这次成了\n" +
      "shift|前后对比|之前的值|之后的值\n" +
      "stamp|盖章定论|STAMP\n" +
      "seal|实心定论条|SEAL",
    times: "0.3|2|3.6|5.2|6.8|8.4|10|11.6|13.2|14.8",
    bg: "dark",
    rowFx: "lit",
    bgAlpha: 0.6,
    grow: false,
    accent: "blue",
    ...OFFSET_DEFAULTS,
  },
  controls: [
    { key: "theme", label: "底色(此卡独立生效)", type: "select", options: THEME_OPTIONS },
    {
      key: "position",
      label: "落位",
      type: "select",
      options: [
        { label: "左侧", value: "left" },
        { label: "居中", value: "center" },
        { label: "右侧", value: "right" },
      ],
    },
    {
      key: "rows",
      label: "板上各行(一行一条,格式「类型|字段…」;类型后加 @倍数 单独缩放该行,如 kv@1.4)",
      help: [
        "━━ 标题 · 文字 ━━",
        "大标题     head|主行|强调行|右上EN",
        "定性标签   tag|文字",
        "引语       quote|引语|署名·出处",
        "来源小字   note|mono小字(来源/口径)",
        "术语       term|EN|术语|定义",
        "盖章定论   stamp|中文|EN      (描边斜章,砸下来)",
        "实心定论   seal|中文|EN       (实心反白条,横着抹开)",
        "",
        "━━ 数字 · 数据 ━━",
        "大数字     kv|名目|大数字|小注",
        "滚动计数   count|前缀|数字|单位",
        "数据条     bar|名目|0-100|数值文字",
        "圆环占比   ring|名目|百分比|数值文字",
        "点阵比例   dots|名目|总数|点亮数",
        "迷你趋势   spark|名目|up或down|幅度注",
        "倍数徽章   mult|名目|主值|×N",
        "",
        "━━ 对比 · 变化 ━━",
        "比分       vs|左值|右值|名目(大绿小红)",
        "双条对比   compare|强调项 数值|对照项 数值|名目",
        "前后对比   shift|名目|之前|之后",
        "划线反转   strike|旧认知|真相",
        "时间线     line|标签 ✗ 说明;标签 ✓ 说明(;分隔节点)",
        "",
        "━━ 实体 · 证据 ━━",
        "人物名牌   ent|头像图|名字|身份",
        "证据图     img|图或视频路径|标注",
        "横排logo   icons|图标路径逗号分隔|小注",
        "           每项可跟标注:icons|target 位置,palette 颜色|(字落在图标下)",
        "中性胶囊   chip|文字|图标名",
        "公式       formula|图标名|A = B → C",
        "状态行     stat|EN标签|中文|图标名(带⚠)",
        "",
        "━━ 清单 · 点缀 ━━",
        "打勾行     check|文字|空或x(一项一行)",
        "胶囊标签   pill|标签1|标签2(彩底黑字)",
        "",
        "━━ 行级缩放 ━━",
        "类型@倍数  kv@1.4|…重点放大  note@0.8|…次要缩小",
        "           范围 0.5~2.5;一块板最多放大 1-2 行",
      ].join("\n"),
      type: "textarea",
      rows: 7,
    },
    { key: "times", label: "每行点亮秒数(距卡片开始,| 分隔,卡点用)", type: "text" },
    {
      key: "bg",
      label: "玻璃底板",
      type: "select",
      options: [
        { label: "黑玻璃", value: "dark" },
        { label: "白玻璃", value: "light" },
        { label: "无(画面够暗时)", value: "none" },
      ],
    },
    {
      key: "rowFx",
      label: "行强调(讲到那行时)",
      type: "select",
      options: [
        { label: "点亮", value: "lit" },
        { label: "稍微放大", value: "zoom" },
        { label: "点亮 + 放大", value: "both" },
      ],
    },
    { key: "grow", label: "随讲述长高(未点亮的行不占位)", type: "toggle" },
    { key: "bgAlpha", label: "底板透明度(越小越透)", type: "range", min: 0.2, max: 1, step: 0.05, unit: "" },
    { key: "accent", label: "强调色(标签/红章/对比后值)", type: "select", options: ACCENT_OPTIONS },
    ...OFFSET_CONTROLS,
  ],
  Component: InfoBoard,
};
