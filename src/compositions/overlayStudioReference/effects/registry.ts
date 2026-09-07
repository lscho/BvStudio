import type { AnyEffectDef } from "./types";
import { metricFocusDef } from "./MetricFocus";
import { compareSplitDef } from "./CompareSplit";
import { quoteLockupDef } from "./QuoteLockup";
import { stepTimelineDef } from "./hud/StepTimeline";
import { rankBarsDef } from "./hud/RankBars";
import { scaleSwapDef } from "./hud/ScaleSwap";
import { stackShareDef } from "./hud/StackShare";
import { columnStackDef } from "./hud/ColumnStack";
import { stairBarsDef } from "./hud/StairBars";
import { multiplyGridDef } from "./hud/MultiplyGrid";
import { actionBandDef } from "./hud/ActionBand";
import { compareBarsDef } from "./hud/CompareBars";
import { chipClusterDef } from "./hud/ChipCluster";
import { punchPillDef } from "./hud/PunchPill";
import { painPointsDef } from "./hud/PainPoints";
import { termCardDef } from "./hud/TermCard";
import { checklistDef } from "./hud/Checklist";
import { quoteCiteDef } from "./hud/QuoteCite";
import { markerHighlightDef } from "./hud/MarkerHighlight";
import { terminal3DDef } from "./hud/Terminal3D";
import { ringMetricDef } from "./hud/RingMetric";
import { ecosystemHubDef } from "./hud/EcosystemHub";
import { flowChartDef } from "./hud/FlowChart";
import { projectWindowDef } from "./hud/ProjectWindow";
import { steerHintDef } from "./hud/SteerHint";
import { timelineHDef } from "./hud/TimelineH";
import { versusCardDef } from "./hud/VersusCard";
import { uiCalloutDef } from "./hud/UICallout";
import { lightSweepDef } from "./hud/LightSweep";
import { convergeDef } from "./hud/Converge";
import { kineticWordsDef } from "./hud/KineticWords";
import { karaokeLineDef } from "./hud/KaraokeLine";
import { strikeFlipDef } from "./hud/StrikeFlip";
import { numberBeatsDef } from "./hud/NumberBeats";
import { wordSpinDef } from "./hud/WordSpin";
import { outlineTreeDef } from "./hud/OutlineTree";
import { charAssembleDef } from "./hud/CharAssemble";
import { typeShiftDef } from "./hud/TypeShift";
import { blurTextDef } from "./hud/BlurText";
import { decryptTextDef } from "./hud/DecryptText";
import { trueFocusDef } from "./hud/TrueFocus";
import { odometerDef } from "./hud/Odometer";
import { cardSwapDef } from "./hud/CardSwap";
import { stepperFlowDef } from "./hud/StepperFlow";
import { letterGlitchDef } from "./hud/LetterGlitch";
import { magicBentoDef } from "./hud/MagicBento";
import { screenDemoDef } from "./hud/ScreenDemo";
import { camPanDef } from "./hud/CamPan";
import { focusCardDef } from "./hud/FocusCard";
import { coverStackDef } from "./hud/CoverStack";
import { coverFlowDef } from "./hud/CoverFlow";
import { dustFieldDef } from "./hud/DustField";
import { chapterBarDef } from "./hud/ChapterBar";
import { captionTrackDef } from "./hud/CaptionTrack";
import { statProofDef } from "./hud/StatProof";
import { burstHaloDef } from "./hud/BurstHalo";
import { punchZoomDef } from "./hud/PunchZoom";
import { ambientWashDef } from "./hud/AmbientWash";
import { glassPaneDef } from "./hud/GlassPane";
import { frostScreenDef } from "./hud/FrostScreen";
import { camFrameDef } from "./hud/CamFrame";
import { studioBuildDef } from "./hud/StudioBuild";
import { replicateLoopDef } from "./hud/ReplicateLoop";
import { duoTitleDef } from "./hud/DuoTitle";
import { ghostVideoDef } from "./hud/GhostVideo";
import { phoneShotDef } from "./hud/PhoneShot";
import { docScrollDef } from "./hud/DocScroll";
import { factStackDef } from "./hud/FactStack";
import { proofShotDef } from "./hud/ProofShot";
import { proofWallDef } from "./hud/ProofWall";
import { winLoseDef } from "./hud/WinLose";
import { ruleCardDef } from "./hud/RuleCard";
import { barRaceDef } from "./hud/BarRace";
import { growthCurveDef } from "./hud/GrowthCurve";
import { quadMapDef } from "./hud/QuadMap";
import { mapTerritoryDef } from "./hud/MapTerritory";
import { glowBadgesDef } from "./hud/GlowBadges";
import { infoBoardDef } from "./hud/InfoBoard";
import { entityChipsDef } from "./hud/EntityChips";
import { dotCrowdDef } from "./hud/DotCrowd";
import { photoHaloDef } from "./hud/PhotoHalo";
import { wordFlankDef } from "./hud/WordFlank";
import { focusTakeoverDef } from "./hud/FocusTakeover";
import { iconPopDef } from "./hud/IconPop";
import { sectionHeadDef } from "./hud/SectionHead";
import { divergeLinesDef } from "./hud/DivergeLines";
import { dropArrowDef } from "./hud/DropArrow";
import { formulaPillDef } from "./hud/FormulaPill";
import { iconVetoDef } from "./hud/IconVeto";
import { demoTourDef } from "./hud/DemoTour";
import { warpTitleDef } from "./hud/WarpTitle";
import { strokeTitleDef } from "./hud/StrokeTitle";
import { pinBoardDef } from "./hud/PinBoard";
import { handLiftDef } from "./hud/HandLift";
import { clipParadeDef } from "./hud/ClipParade";
import { videoShowcaseDef } from "./hud/VideoShowcase";
import { demoRailDef } from "./hud/DemoRail";
import { iconSwarmDef } from "./hud/IconSwarm";
import { costCutDef } from "./hud/CostCut";
import { clipFlowDef } from "./hud/ClipFlow";
import { stickFallDef } from "./hud/StickFall";
import { chatVolleyDef } from "./hud/ChatVolley";

/** 按用途分组:同组内是"同一类需求的可选项",挑一张用即可 */
export interface EffectGroup {
  title: string;
  effects: AnyEffectDef[];
}

export const EFFECT_GROUPS: EffectGroup[] = [
  {
    /* 全程在场的层:一张卡从 0 拉到视频结尾,让画面没有一帧"没人管" */
    title: "常驻层",
    effects: [chapterBarDef, pinBoardDef, captionTrackDef, glassPaneDef, frostScreenDef],
  },
  {
    /* 证据实证:观点用真素材/真数字背书,语义可视化的核心 */
    title: "证据实证",
    effects: [
      infoBoardDef,
      dotCrowdDef,
      statProofDef,
      proofShotDef,
      proofWallDef,
      ghostVideoDef,
      phoneShotDef,
      docScrollDef,
      factStackDef,
      winLoseDef,
      ruleCardDef,
      barRaceDef,
      photoHaloDef,
      stickFallDef,
    ],
  },
  {
    title: "数据指标",
    effects: [metricFocusDef, ringMetricDef, odometerDef, numberBeatsDef, rankBarsDef, scaleSwapDef, stackShareDef, columnStackDef, stairBarsDef, multiplyGridDef, growthCurveDef, divergeLinesDef, dropArrowDef],
  },
  {
    title: "对比取舍",
    effects: [compareSplitDef, costCutDef, versusCardDef, compareBarsDef, strikeFlipDef, iconVetoDef],
  },
  {
    title: "金句观点",
    effects: [
      quoteLockupDef,
      quoteCiteDef,
      punchPillDef,
      formulaPillDef,
      kineticWordsDef,
      karaokeLineDef,
      wordSpinDef,
    ],
  },
  {
    title: "步骤流程",
    effects: [
      clipFlowDef,
      stepTimelineDef,
      chatVolleyDef,
      checklistDef,
      actionBandDef,
      stepperFlowDef,
      studioBuildDef,
      replicateLoopDef,
      timelineHDef,
      flowChartDef,
      convergeDef,
    ],
  },
  {
    title: "信息结构",
    effects: [sectionHeadDef, iconSwarmDef, strokeTitleDef, duoTitleDef, chipClusterDef, glowBadgesDef, outlineTreeDef, ecosystemHubDef, magicBentoDef, quadMapDef, mapTerritoryDef, cardSwapDef],
  },
  {
    title: "教程标注",
    effects: [termCardDef, uiCalloutDef, iconPopDef, markerHighlightDef, steerHintDef, painPointsDef],
  },
  {
    title: "文字进场",
    effects: [
      blurTextDef,
      decryptTextDef,
      trueFocusDef,
      charAssembleDef,
      typeShiftDef,
      wordFlankDef,
    ],
  },
  {
    /* 人物锚定:效果直接"碰"人物——爆点光环、镜头推近 */
    title: "人物锚定",
    effects: [entityChipsDef, handLiftDef, punchZoomDef],
  },
  {
    title: "场景 · 运镜",
    effects: [screenDemoDef, demoTourDef, camPanDef, camFrameDef, focusCardDef, focusTakeoverDef, coverStackDef, coverFlowDef, videoShowcaseDef, clipParadeDef, demoRailDef],
  },
  {
    title: "场景 · B-roll",
    effects: [terminal3DDef, projectWindowDef],
  },
  {
    /* 转场:段落之间的切换件,本身不承载内容 */
    title: "转场",
    effects: [lightSweepDef, warpTitleDef],
  },
  {
    /* 情绪爆点:短促、卡点、砸一下就走 */
    title: "情绪爆点",
    effects: [burstHaloDef],
  },
  {
    /* 氛围底噪:长时间铺底、不抢戏,给画面一层会动的底 */
    title: "氛围底噪",
    effects: [ambientWashDef, dustFieldDef, letterGlitchDef],
  },
];

// 平铺列表(消费端按 id 取用;id 即 overlay JSON 的 kind)
export const EFFECTS: AnyEffectDef[] = EFFECT_GROUPS.flatMap((g) => g.effects);
