#!/usr/bin/env python3
"""Local Qwen3-ASR worker used by the Tauri client."""

import argparse
import json
from pathlib import Path


def write_progress(path, phase, message, progress):
    if not path:
        return
    Path(path).write_text(
        json.dumps({"phase": phase, "message": message, "progress": progress}, ensure_ascii=False),
        encoding="utf-8",
    )


def value(item, *names, default=None):
    if isinstance(item, dict):
        for name in names:
            if name in item:
                return item[name]
    for name in names:
        if hasattr(item, name):
            return getattr(item, name)
    return default


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--audio", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--aligner", default="")
    parser.add_argument("--language", default="")
    parser.add_argument("--device", default="auto")
    parser.add_argument("--output", required=True)
    parser.add_argument("--progress", default="")
    args = parser.parse_args()

    write_progress(args.progress, "runtime", "正在加载本地 ASR 运行环境", 0.24)
    import torch
    from qwen_asr import Qwen3ASRModel

    if args.device == "auto":
        if torch.cuda.is_available():
            device = "cuda:0"
        elif getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
            device = "mps"
        else:
            device = "cpu"
    else:
        device = args.device

    write_progress(args.progress, "loading", f"正在将 Qwen3-ASR 加载到 {device}", 0.36)
    dtype = torch.bfloat16 if device.startswith("cuda") else (torch.float16 if device == "mps" else torch.float32)
    kwargs = {
        "dtype": dtype,
        "device_map": device,
        "max_inference_batch_size": 1,
        "max_new_tokens": 4096,
    }
    if args.aligner:
        kwargs["forced_aligner"] = args.aligner
        kwargs["forced_aligner_kwargs"] = {"dtype": dtype, "device_map": device}

    model = Qwen3ASRModel.from_pretrained(args.model, **kwargs)
    write_progress(
        args.progress,
        "aligning" if args.aligner else "transcribing",
        "正在识别并生成精确时间戳" if args.aligner else "正在本地识别音频",
        0.64,
    )
    result = model.transcribe(
        audio=args.audio,
        language=args.language or None,
        return_time_stamps=bool(args.aligner),
    )[0]

    write_progress(args.progress, "writing", "正在整理字幕片段", 0.91)
    segments = []
    for item in (value(result, "time_stamps", "timestamps", default=[]) or []):
        start = float(value(item, "start_time", "start", default=0.0) or 0.0)
        end = float(value(item, "end_time", "end", default=start) or start)
        text = str(value(item, "text", default="") or "").strip()
        if text and end > start:
            segments.append({"startSeconds": start, "endSeconds": end, "text": text})

    payload = {
        "language": str(value(result, "language", default="") or ""),
        "text": str(value(result, "text", default="") or "").strip(),
        "segments": segments,
        "device": device,
    }
    Path(args.output).write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    write_progress(args.progress, "ready", "本地字幕识别完成", 1.0)


if __name__ == "__main__":
    main()
