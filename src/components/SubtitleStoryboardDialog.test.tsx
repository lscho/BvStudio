import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { SubtitleStoryboardDialog } from "@/components/SubtitleStoryboardDialog";

it("没有字幕时提示先导入，不能发送请求", () => {
  render(<SubtitleStoryboardDialog open onOpenChange={vi.fn()} onGenerate={vi.fn()} subtitleCount={0} durationSeconds={20} />);
  expect(screen.getByRole("button", { name: "按字幕生成分镜" })).toBeDisabled();
});

it("提交纯模式和分镜要求，冲突要求留在本地", async () => {
  const generate = vi.fn();
  render(<SubtitleStoryboardDialog open onOpenChange={vi.fn()} onGenerate={generate} subtitleCount={5} durationSeconds={20} />);
  fireEvent.pointerDown(screen.getByRole("combobox", { name: "分镜画面模式" }), { button: 0, pointerType: "mouse", ctrlKey: false });
  fireEvent.click(await screen.findByRole("option", { name: "纯 A-roll · 口播为主" }));
  fireEvent.change(screen.getByRole("textbox", { name: "分镜要求" }), { target: { value: "0-5秒 B-roll 展示产品" } });
  fireEvent.click(screen.getByRole("button", { name: "按字幕生成分镜" }));
  expect(screen.getByRole("alert")).toHaveTextContent("冲突");expect(generate).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole("textbox", { name: "分镜要求" }), { target: { value: "0-5秒 A-roll 保留口播" } });
  fireEvent.click(screen.getByRole("button", { name: "按字幕生成分镜" }));
  expect(generate).toHaveBeenCalledWith({ mode: "a-roll", prompt: "0-5秒 A-roll 保留口播" });
});
