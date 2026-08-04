import { getAccessToken } from "./api-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export type AnalyzePayload = {
  messages: { role: "user" | "assistant"; content: string }[];
  system?: string;
  model?: string;
  portfolio_id?: string;
  previous_analyses?: string[];
};

export type StreamResult = {
  text: string;
  provider: string;
  model: string;
};

type SseEvent =
  | { type: "delta"; text: string }
  | { type: "done"; provider?: string; model?: string }
  | { type: "error"; message: string };

/**
 * Abre o stream SSE de POST /ai/analyze e acumula os deltas de texto.
 *
 * O backend emite eventos `data: {"type":"delta","text":...}` encerrados por
 * `{"type":"done","provider":...,"model":...}` ou `{"type":"error","message":...}`.
 * Eventos podem chegar cortados no meio de um read(), então as linhas são
 * remontadas via buffer antes do JSON.parse.
 */
export async function streamAnalysis(
  payload: AnalyzePayload,
  onDelta: (fullText: string) => void,
  signal?: AbortSignal,
): Promise<StreamResult> {
  const token = getAccessToken();
  const res = await fetch(`${API_URL}/ai/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok || !res.body) {
    throw new Error("Falha ao iniciar o stream de análise");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";
  let text = "";
  let provider = "unknown";
  let model = "unknown";

  const handleLine = (line: string) => {
    if (!line.startsWith("data: ")) return;
    const data = line.slice(6).trim();
    if (!data) return;

    let evt: SseEvent;
    try {
      evt = JSON.parse(data);
    } catch {
      return; // linha malformada — ignora sem corromper o texto
    }

    if (evt.type === "delta") {
      text += evt.text;
      onDelta(text);
    } else if (evt.type === "done") {
      provider = evt.provider ?? provider;
      model = evt.model ?? model;
    } else if (evt.type === "error") {
      throw new Error(evt.message || "Erro no provedor de IA");
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        handleLine(line);
      }
    }
    buffer += decoder.decode();
    if (buffer) handleLine(buffer);
  } finally {
    reader.releaseLock();
  }

  return { text, provider, model };
}
