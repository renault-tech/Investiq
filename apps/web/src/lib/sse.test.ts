import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { streamAnalysis } from "./sse";

/**
 * Regression coverage for the Fase 0 bug: the original implementation used
 * chunk.split('\\n') (a literal backslash-n) and concatenated the raw SSE
 * JSON payload into the displayed text instead of parsing it. These tests
 * exercise the real failure mode — an SSE event split across two stream
 * reads — which only a correct line-buffering implementation survives.
 */

function sseResponse(rawChunks: string[]): Response {
  const encoder = new TextEncoder();
  let i = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < rawChunks.length) {
        controller.enqueue(encoder.encode(rawChunks[i]));
        i++;
      } else {
        controller.close();
      }
    },
  });
  return new Response(stream, { status: 200 });
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("streamAnalysis", () => {
  it("accumulates delta text and resolves provider/model from the done event", async () => {
    const events =
      'data: {"type":"delta","text":"## Resumo\\n"}\n\n' +
      'data: {"type":"delta","text":"Tudo certo."}\n\n' +
      'data: {"type":"done","provider":"claude","model":"claude-sonnet-4-6"}\n\n';
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(sseResponse([events]));

    const onDelta = vi.fn();
    const result = await streamAnalysis({ messages: [{ role: "user", content: "oi" }] }, onDelta);

    expect(result.text).toBe("## Resumo\nTudo certo.");
    expect(result.provider).toBe("claude");
    expect(result.model).toBe("claude-sonnet-4-6");
    expect(onDelta).toHaveBeenCalledWith("## Resumo\n");
    expect(onDelta).toHaveBeenLastCalledWith("## Resumo\nTudo certo.");
  });

  it("survives an SSE event split across two stream reads", async () => {
    // The JSON object itself is cut mid-line, exactly what a raw
    // chunk.split('\\n') implementation cannot reassemble correctly.
    const chunk1 = 'data: {"type":"delta","te';
    const chunk2 = 'xt":"olá mundo"}\n\ndata: {"type":"done","provider":"openai","model":"gpt-4o"}\n\n';
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(sseResponse([chunk1, chunk2]));

    const onDelta = vi.fn();
    const result = await streamAnalysis({ messages: [] }, onDelta);

    expect(result.text).toBe("olá mundo");
    expect(result.provider).toBe("openai");
  });

  it("rejects when the backend emits an error event", async () => {
    const events = 'data: {"type":"error","message":"Sem chave de IA configurada"}\n\n';
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(sseResponse([events]));

    await expect(streamAnalysis({ messages: [] }, vi.fn())).rejects.toThrow(
      "Sem chave de IA configurada"
    );
  });

  it("ignores malformed JSON lines without corrupting accumulated text", async () => {
    const events =
      'data: {"type":"delta","text":"parte 1 "}\n\n' +
      "data: {not valid json\n\n" +
      'data: {"type":"delta","text":"parte 2"}\n\n' +
      'data: {"type":"done"}\n\n';
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(sseResponse([events]));

    const result = await streamAnalysis({ messages: [] }, vi.fn());
    expect(result.text).toBe("parte 1 parte 2");
    // done event without provider/model falls back to "unknown"
    expect(result.provider).toBe("unknown");
    expect(result.model).toBe("unknown");
  });

  it("throws when the initial fetch response is not ok", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(null, { status: 500 }));
    await expect(streamAnalysis({ messages: [] }, vi.fn())).rejects.toThrow();
  });
});
