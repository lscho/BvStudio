import { expect, it } from "vitest";
import { shotcraftWords } from "@/domain/shotcraftTypography";

it("保留中文连续排版与英文词间空白", () => {
  expect(shotcraftWords("生成很快", "生成")).toEqual([{ text: "生成", space: "" }, { text: "很快", space: "" }]);
  const input = "Introducing  BVideo Studio";
  expect(shotcraftWords(input, "BVideo").map((word) => word.text + word.space).join("")).toBe(input);
  expect(shotcraftWords("  ")).toEqual([]);
});
