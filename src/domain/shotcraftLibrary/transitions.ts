// Active action windows, read from the corresponding source implementations.
// Transition-themed card reveals and navigation scenes remain standalone shots.
export const LIBRARY_TRANSITIONS = [
  { id: "shotcraft-bubble-swarm-takeover", start: 0, cut: 75, end: 122 },
  { id: "shotcraft-barn-door-split", start: 18, cut: 46, end: 55 },
  { id: "shotcraft-cube-rotate", start: 30, cut: 49, end: 68 },
  { id: "shotcraft-glitch-displace", start: 45, cut: 58, end: 62 },
  { id: "shotcraft-invisible-cut", start: 38, cut: 47, end: 60 },
  { id: "shotcraft-light-leak-burn", start: 25, cut: 53, end: 95 },
  { id: "shotcraft-blinds-slice", start: 20, cut: 38, end: 52 },
  { id: "shotcraft-clock-wipe", start: 30, cut: 60, end: 96 }
] as const;

export function libraryTransition(id: string) { return LIBRARY_TRANSITIONS.find((item) => item.id === id); }
