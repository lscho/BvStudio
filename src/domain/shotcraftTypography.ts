export function shotcraftWords(text: string, highlight = "") {
  const words: { text: string; space: string }[] = [];
  const parts = text.trim().split(/(\s+)/u);
  for (const part of parts) {
    if (!part) continue;
    if (/^\s+$/u.test(part)) { if (words.length) words[words.length - 1].space = part; continue; }
    const at = highlight ? part.indexOf(highlight) : -1;
    const tokens = at >= 0 ? [part.slice(0, at), highlight, part.slice(at + highlight.length)].filter(Boolean)
      : /\p{Script=Han}/u.test(part) ? Array.from(new Intl.Segmenter("zh", { granularity: "word" }).segment(part), (entry) => entry.segment) : [part];
    words.push(...tokens.map((word) => ({ text: word, space: "" })));
  }
  return words;
}
