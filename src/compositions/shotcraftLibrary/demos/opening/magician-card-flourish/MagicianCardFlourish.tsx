// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import React, { useId } from 'react';
import { useCurrentFrame, interpolate, Easing } from "@/compositions/shotcraftLibrary/runtime";
import { CameraMotionBlur } from "@/compositions/shotcraftLibrary/runtime";
import { G } from '@/compositions/shotcraftLibrary/demos/_fixtures/Fixtures';
import type { ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

export function createDemo(_content: ShotcraftContent) {
const CARD_W = 380;
const CARD_H = 540;
const AX = CARD_W / Math.hypot(CARD_W, CARD_H);
const AY = CARD_H / Math.hypot(CARD_W, CARD_H);
const TAKEOFF = 9;
const FLASH_END = 12;
const FLIGHT = 50;
const LAND = TAKEOFF + FLIGHT;
const SHEEN_START = LAND + 8;
const SHEEN_DUR = 26;
const TURNS = 13;
const FINAL_SCALE = 1.88;
const CardFace: React.FC = () => (
  <div style={{
    width: CARD_W, height: CARD_H, borderRadius: 22, background: G.card,
    border: `2px solid ${G.border}`, boxSizing: 'border-box', padding: 26,
    display: 'flex', flexDirection: 'column', gap: 16, overflow: 'hidden',
  }}>
    <div style={{ height: 26, width: '62%', background: G.bar, borderRadius: 13 }} />
    <div style={{ height: 12, width: '84%', background: G.line, borderRadius: 6 }} />
    <div style={{
      flex: 1, borderRadius: 14, background: `linear-gradient(145deg, #e6e6e4, ${G.bar})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ width: 110, height: 110, borderRadius: 55, background: G.mid, opacity: 0.55 }} />
    </div>
    <div style={{ height: 12, width: '74%', background: G.line, borderRadius: 6 }} />
    <div style={{ height: 12, width: '52%', background: G.line, borderRadius: 6 }} />
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
      <div style={{ width: 34, height: 34, borderRadius: 17, background: G.mid }} />
      <div style={{ height: 11, width: 90, background: G.line, borderRadius: 5 }} />
      <div style={{ marginLeft: 'auto', width: 58, height: 24, borderRadius: 12, background: G.ink, opacity: 0.75 }} />
    </div>
  </div>
);
const CardBack: React.FC = () => (
  <div style={{
    position: 'absolute', inset: 0, borderRadius: 22, background: '#3c3c40',
    border: '2px solid #55555a', boxSizing: 'border-box', overflow: 'hidden',
  }}>
    <div style={{
      position: 'absolute', inset: 0,
      background: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.07) 0 14px, transparent 14px 28px)',
    }} />
    <div style={{
      position: 'absolute', inset: 34, borderRadius: 12, border: '2px solid rgba(255,255,255,0.16)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ width: 72, height: 72, borderRadius: 36, border: '3px solid rgba(255,255,255,0.22)' }} />
    </div>
  </div>
);
const SpawnFlash: React.FC<{ f: number }> = ({ f }) => {
  // 渐变 ID 按实例生成，多实例同场不串引（useId 的 «:» 在 url() 里非法，需清洗）
  // hooks 必须在条件 return 之前调用
  const SPIKE_ID = `mcf-needle-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  if (f > FLASH_END) return null;
  const grow = interpolate(f, [0, 2.5], [0.2, 1], {
    extrapolateRight: 'clamp', easing: Easing.out(Easing.quad),
  });
  const shrink = interpolate(f, [6, TAKEOFF, FLASH_END], [1, 0.3, 0.05], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.quad),
  });
  const s = grow * shrink;
  // 亮度微闪（真实光源级细微抖动）
  const flicker = 0.94 + 0.06 * (0.5 + 0.5 * Math.sin(f * 1.9) * Math.sin(f * 0.83 + 1.7));
  const opacity = interpolate(f, [0, 2, 6, FLASH_END], [0, 1, 1, 0], {
    extrapolateRight: 'clamp',
  }) * flicker;
  // v9：用户意见"开场光点的光芒要旋转90度"——闪光期间星芒动态旋转 90°
  const rot = interpolate(f, [0, FLASH_END], [0, 90], { extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad) });
  // 针状光束：极细楔形（根部窄、尖端归零）+ 亮度指数渐隐——对照参考图
  // v9（批次 18）：用户意见"开场光点的光芒要旋转90度"——整体转 90°：长轴 -38°→52°（陡斜近竖贯），短轴 52°→142°
  const needle = (deg: number, len: number, w0: number, op: number) => (
    <g key={`${deg}-${len}`} transform={`rotate(${deg})`} opacity={op}>
      <path d={`M 0 ${-w0 / 2} L ${len} 0 L 0 ${w0 / 2} Z`} fill={`url(#${SPIKE_ID})`} />
      <path d={`M 0 ${-w0 / 2} L ${len} 0 L 0 ${w0 / 2} Z`} fill={`url(#${SPIKE_ID})`} transform="scale(-1,1)" />
    </g>
  );
  return (
    <div style={{
      position: 'absolute', left: 960, top: 540, width: 0, height: 0,
      transform: `scale(${s})`, opacity, pointerEvents: 'none',
    }}>
      {/* v9.6 中心重做（对照用户参考图②）：不是白色圆球——
          极小过曝亮点 + 蓝色辉光 + 一圈放射状小光芒（短刺） */}
      <div style={{
        position: 'absolute', left: -13, top: -13, width: 26, height: 26, borderRadius: 13,
        background: 'radial-gradient(circle, #ffffff 0%, rgba(225,245,255,0.95) 45%, rgba(140,215,255,0) 80%)',
        filter: 'blur(0.6px)',
      }} />
      <div style={{
        position: 'absolute', left: -70, top: -70, width: 140, height: 140, borderRadius: 70,
        background: 'radial-gradient(circle, rgba(90,175,255,0.75) 0%, rgba(50,130,245,0.35) 45%, rgba(40,110,235,0) 75%)',
        filter: 'blur(4px)',
      }} />
      {/* 放射状小光芒：核心周围一圈短刺（参考图中心的 starburst 细节） */}
      <svg width={260} height={260} viewBox="-130 -130 260 260" style={{
        position: 'absolute', left: -130, top: -130, transform: `rotate(${-rot * 0.6}deg)`,
      }}>
        {[15, 52, 88, 123, 160, 197, 231, 268, 305, 341].map((deg, i) => {
          const ln = 46 + ((i * 37) % 3) * 16;
          return (
            <g key={deg} transform={`rotate(${deg})`} opacity={0.75}>
              <path d={`M 8 -1.1 L ${ln} 0 L 8 1.1 Z`} fill="rgba(150,210,255,0.85)" filter="blur(0.8px)" />
            </g>
          );
        })}
      </svg>
      {/* X 形对角针状星芒——对照 IMG_2505 复刻要点：光束通体明亮饱和
          （青蓝贯穿全长、只在最末端才灭），束身带同色辉光包裹 */}
      <svg width={3200} height={3200} viewBox="-1600 -1600 3200 3200" style={{
        position: 'absolute', left: -1600, top: -1600, transform: `rotate(${rot}deg)`,
      }}>
        <defs>
          {/* v9.6：更纯蓝（参考图光束是饱和蓝，白段只在根部一瞬） */}
          <linearGradient id={SPIKE_ID} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#eaf6ff" stopOpacity="1" />
            <stop offset="0.05" stopColor="#8cc8ff" stopOpacity="0.95" />
            <stop offset="0.3" stopColor="#3f9bff" stopOpacity="0.88" />
            <stop offset="0.62" stopColor="#2277f2" stopOpacity="0.6" />
            <stop offset="0.88" stopColor="#1b64e0" stopOpacity="0.25" />
            <stop offset="1" stopColor="#1a5fd8" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* 长对角轴：辉光包层（宽糊、同色发光）+ 明亮主束 + 过曝细芯 */}
        <g filter="blur(7px)" opacity={0.75}>
          {needle(-38, 826, 26, 1)}
        </g>
        <g filter="blur(1.8px)">
          {needle(-38, 840, 8, 1)}
        </g>
        {needle(-38, 819, 3, 1)}
        {/* 短对角轴：同三层 */}
        <g filter="blur(5px)" opacity={0.75}>
          {needle(52, 413, 20, 1)}
        </g>
        <g filter="blur(1.5px)">
          {needle(52, 420, 6.5, 1)}
        </g>
        {needle(52, 410, 2.6, 1)}
      </svg>
    </div>
  );
};
const Scene: React.FC = () => {
  const f = useCurrentFrame();
  // 硬定格：闪光后 f=TAKEOFF 起飞，到达（f=LAND）后时间冻结——所有量按 tEff 计算
  const tEff = Math.min(1, Math.max(0, (f - TAKEOFF) / FLIGHT));
  const airborne = f >= TAKEOFF;

  // —— 自旋（v7）：用户意见"靠近镜头时，卡片自旋速度开始随距离靠近而衰减"
  // 前 40% 行程近匀速极快，之后角速度随 tEff 持续衰减（easeOut 2.4 次幂），
  // spinP(1)=1 保证整圈数——定格瞬间仍恰好正面朝镜头
  const spinP = tEff < 0.4
    ? tEff * 1.55
    : 0.62 + 0.38 * (1 - Math.pow(1 - (tEff - 0.4) / 0.6, 2.4));
  const theta = TURNS * 360 * Math.min(1, spinP);

  // —— 轨迹：画面中心的 3D 纵深远处（极小）→ 弧线飞向镜头 → 近满幅定格于中心 ——
  // v6 弹射曲线（用户意见"刚开始弹射出来速度慢，然后划弧线的过程减速"）：
  // slow-in（前 14% 慢速蓄力挤出 6% 行程）→ 斜率跳变=弹射踢出 →
  // 弧线段 easeOut(cubic) 全程减速抵达中心
  const tp = tEff < 0.14
    ? 0.06 * (tEff / 0.14) * (tEff / 0.14)
    : 0.06 + 0.94 * (1 - Math.pow(1 - (tEff - 0.14) / 0.86, 3));
  const arc = Math.sin(tp * Math.PI);
  const cx = 960 + arc * 360;
  const cy = 540 - arc * 250;
  // 纵深：真透视 scale=F/(F+z)×FINAL_SCALE，z 从极远推近到 0——
  // 终态卡高≈94% 画面高（基本贴近上下界）
  const FOCAL = 900;
  const z = interpolate(tp, [0, 1], [14000, 0]);
  const scale = FINAL_SCALE * (FOCAL / (FOCAL + z)); // 0.11 → 1.88，无过冲

  // 背面判定
  const facingBack = Math.cos((theta * Math.PI) / 180) < 0;

  // —— 定格后 sheen 扫光：一道高光斜带从卡面左侧扫到右侧（一次性）——
  const sheenP = interpolate(f, [SHEEN_START, SHEEN_START + SHEEN_DUR], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  const sheenVisible = f >= SHEEN_START && f <= SHEEN_START + SHEEN_DUR;
  // 扫光经过时整卡亮度微抬升（正弦单拱），保证"整体光泽"肉眼可感
  const sheenLift = sheenVisible ? 0.07 * Math.sin(sheenP * Math.PI) : 0;

  return (
    <div style={{ width: 1920, height: 1080, background: '#000000', position: 'relative', overflow: 'hidden' }}>
      {/* —— 卡片：闪光过后从中心飞出，纯黑空间中飞行 —— */}
      <div style={{
        position: 'absolute', left: cx - CARD_W / 2, top: cy - CARD_H / 2,
        width: CARD_W, height: CARD_H,
        transform: `scale(${scale})`,
        transformOrigin: '50% 50%',
        opacity: airborne ? 1 : 0,
      }}>
        <div style={{
          width: '100%', height: '100%',
          transform: `perspective(1300px) rotate3d(${AX}, ${AY}, 0, ${theta}deg)`,
          transformOrigin: '50% 50%',
          position: 'relative',
          borderRadius: 22,
          filter: sheenLift > 0 ? `brightness(${1 + sheenLift})` : undefined,
        }}>
          <CardFace />
          <div style={{ opacity: facingBack ? 1 : 0, position: 'absolute', inset: 0 }}>
            <CardBack />
          </div>
          {/* 转动中的动态侧光（贴在卡面上，非环境光）；定格后随 theta 冻结 */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 22, pointerEvents: 'none',
            background: `linear-gradient(${115 + Math.sin((theta * Math.PI) / 180) * 30}deg, rgba(255,255,255,0) 30%, rgba(255,255,255,${0.14 + 0.14 * Math.abs(Math.sin((theta * Math.PI) / 180))}) 50%, rgba(255,255,255,0) 70%)`,
            mixBlendMode: 'screen',
          }} />
          {/* 定格后的一次性 sheen 扫光：斜高光带左→右扫过整卡 */}
          {sheenVisible && (
            <div style={{
              position: 'absolute', inset: 0, borderRadius: 22, overflow: 'hidden',
              pointerEvents: 'none',
            }}>
              <div style={{
                position: 'absolute', top: '-45%', bottom: '-45%',
                left: `${-70 + sheenP * 215}%`, width: '42%',
                background: 'linear-gradient(100deg, rgba(200,200,205,0) 0%, rgba(225,225,230,0.5) 34%, rgba(255,255,255,0.9) 50%, rgba(225,225,230,0.5) 66%, rgba(200,200,205,0) 100%)',
                transform: 'rotate(16deg)',
                mixBlendMode: 'overlay',
              }} />
              {/* 叠一层 screen 提亮，让灰色区块上的高光带更亮 */}
              <div style={{
                position: 'absolute', top: '-45%', bottom: '-45%',
                left: `${-70 + sheenP * 215}%`, width: '26%',
                background: 'linear-gradient(100deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.45) 45%, rgba(255,255,255,0.8) 50%, rgba(255,255,255,0.45) 55%, rgba(255,255,255,0) 100%)',
                transform: 'rotate(16deg)',
                mixBlendMode: 'screen',
              }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
const FlashLayer: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <SpawnFlash f={f} />
    </div>
  );
};
const MagicianCardFlourish: React.FC = () => (
  <>
    <CameraMotionBlur shutterAngle={150} samples={7}>
      <Scene />
    </CameraMotionBlur>
    <FlashLayer />
  </>
);
return MagicianCardFlourish;
}
