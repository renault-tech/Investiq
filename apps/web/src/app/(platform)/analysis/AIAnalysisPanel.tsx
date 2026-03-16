"use client"
import { useState, useRef, useEffect } from "react"
import { Sparkles } from "lucide-react"

const MOCK_ANALYSIS = `Analisando %TICKER%...

**Resumo Técnico:**
Com base nos indicadores disponíveis, o ativo apresenta momentum positivo no curto prazo. RSI em 62.4 indica região neutra, sem sinais de sobrecompra. MACD positivo e acima da linha de sinal, sugerindo tendência de alta.

**Médias Móveis:**
O preço está acima das SMA 20, 50 e 200, configurando alinhamento altista em todos os prazos. Isso é tipicamente um sinal de força técnica.

**Bollinger Bands:**
Preço dentro das bandas, sem sinais de volatilidade extrema. Região de suporte próxima à SMA 20.

**Conclusão:**
Perspectiva técnica de curto prazo: NEUTRA a POSITIVA. Recomenda-se aguardar confirmação de rompimento antes de novas posições.

⚠️ Esta análise é apenas informativa e não constitui recomendação de investimento.`

interface Props { ticker: string }

export function AIAnalysisPanel({ ticker }: Props) {
  const [prompt, setPrompt] = useState("")
  const [output, setOutput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function startStream() {
    if (streaming) return
    const text = MOCK_ANALYSIS.replace("%TICKER%", ticker)
    setOutput("")
    setStreaming(true)
    let i = 0
    timerRef.current = setInterval(() => {
      i += 3
      setOutput(text.slice(0, i))
      if (i >= text.length) {
        clearInterval(timerRef.current!)
        setStreaming(false)
      }
    }, 20)
  }

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg flex flex-col">
      <div className="px-4 py-3 border-b border-neutral-800 flex items-center gap-2">
        <Sparkles size={14} className="text-blue-400" />
        <h2 className="text-sm font-semibold text-neutral-200">Análise IA</h2>
      </div>
      <div className="p-4 flex flex-col gap-3 flex-1">
        <textarea
          className="bg-neutral-800 border border-neutral-700 rounded text-xs text-neutral-200 placeholder-neutral-500 p-2 resize-none outline-none focus:border-blue-600 transition-colors"
          rows={3}
          placeholder={`Pergunte sobre ${ticker}... (ex: "Qual a perspectiva técnica?")`}
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
        />
        <button
          onClick={startStream}
          disabled={streaming}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs rounded transition-colors"
        >
          <Sparkles size={12} />
          {streaming ? "Analisando..." : "Analisar"}
        </button>
        {output && (
          <div className="bg-neutral-800/50 rounded p-3 text-xs text-neutral-300 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
            {output}
            {streaming && <span className="animate-pulse">▋</span>}
          </div>
        )}
      </div>
    </div>
  )
}
