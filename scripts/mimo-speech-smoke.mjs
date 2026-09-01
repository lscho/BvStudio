import { execFileSync } from "node:child_process";

const baseUrl = "https://api.xiaomimimo.com/v1";

function speechApiKey() {
  const environmentKey = process.env.MIMO_API_KEY?.trim();
  if (environmentKey) return environmentKey;
  if (process.platform !== "darwin") {
    throw new Error("请通过 MIMO_API_KEY 提供测试凭证");
  }
  return execFileSync("security", [
    "find-generic-password",
    "-s", "com.bvideo.studio.speech",
    "-a", "mimo-cloud-speech",
    "-w"
  ], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

function responseText(body) {
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) return content.map((part) => part?.text ?? "").join("").trim();
  return "";
}

async function request(path, key, options = {}) {
  const response = await fetch(`${baseUrl}/${path}`, {
    ...options,
    headers: { authorization: `Bearer ${key}`, ...options.headers }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message || `MiMo 请求失败（HTTP ${response.status}）`);
  return body;
}

function normalizedCharacters(text) {
  return Array.from(text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ""));
}

function characterCoverage(expected, actual) {
  const source = normalizedCharacters(expected);
  const recognized = new Set(normalizedCharacters(actual));
  if (!source.length) return 0;
  return source.filter((character) => recognized.has(character)).length / source.length;
}

async function main() {
  const key = speechApiKey();
  if (!key) throw new Error("MiMo API Key 为空");
  const speechOnly = process.argv.includes("--speech-only");

  const modelsBody = await request("models", key);
  const models = new Set((modelsBody.data ?? []).map((model) => model.id));
  for (const required of ["mimo-v2.5", "mimo-v2.5-tts", "mimo-v2.5-asr"]) {
    if (!models.has(required)) throw new Error(`服务端未返回必需模型 ${required}`);
  }

  let narration = "AI 视频编辑可以根据字幕自动匹配动效。你还可以继续调整文字、颜色、位置和节奏。";
  if (!speechOnly) {
    const copyBody = await request("chat/completions", key, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "mimo-v2.5",
        messages: [{
          role: "user",
          content: "请生成一段适合知识类短视频的中文口播，主题是 AI 视频动效编辑。40 到 60 个汉字，两句话，只输出口播正文。"
        }],
        max_tokens: 200
      })
    });
    narration = responseText(copyBody);
    if (!narration) throw new Error("文案模型没有返回口播正文");
  }

  const ttsBody = await request("chat/completions", key, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: "mimo-v2.5-tts",
      messages: [
        { role: "user", content: "自然、清晰、适合知识讲解，语速适中" },
        { role: "assistant", content: narration }
      ],
      audio: { format: "wav", voice: "冰糖" }
    })
  });
  const encodedAudio = ttsBody?.choices?.[0]?.message?.audio?.data;
  if (typeof encodedAudio !== "string") throw new Error("TTS 响应缺少音频数据");
  const wav = Buffer.from(encodedAudio, "base64");
  if (wav.length <= 44 || wav.subarray(0, 4).toString("ascii") !== "RIFF") {
    throw new Error("TTS 没有返回有效 WAV 音频");
  }

  const asrBody = await request("chat/completions", key, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: "mimo-v2.5-asr",
      messages: [{
        role: "user",
        content: [{
          type: "input_audio",
          input_audio: { data: `data:audio/wav;base64,${wav.toString("base64")}` }
        }]
      }],
      asr_options: { language: "zh" }
    })
  });
  const transcript = responseText(asrBody);
  if (!transcript) throw new Error("ASR 响应没有识别文本");
  const coverage = characterCoverage(narration, transcript);
  if (coverage < 0.7) throw new Error(`TTS → ASR 回环字符覆盖率过低（${Math.round(coverage * 100)}%）`);

  console.log(`模型检查: ${models.size} 个模型`);
  console.log(`${speechOnly ? "固定测试文案" : "文案生成"}: ${normalizedCharacters(narration).length} 个字符`);
  console.log(`TTS: ${wav.length} 字节 WAV`);
  console.log(`ASR: ${normalizedCharacters(transcript).length} 个字符，回环覆盖率 ${Math.round(coverage * 100)}%`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
