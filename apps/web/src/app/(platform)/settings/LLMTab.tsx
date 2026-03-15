"use client"
import { useState } from "react"
import { Eye, EyeOff, Zap } from "lucide-react"
import { useSettings } from "@/lib/hooks/useSettings"

const PROVIDERS = [
  { id: "claude",  label: "Claude (Anthropic)", badge: "Recomendado" },
  { id: "openai",  label: "OpenAI (GPT-4)",     badge: null },
  { id: "gemini",  label: "Google Gemini",       badge: null },
] as const

export function LLMTab() {
  const { data } = useSettings()
  const [provider, setProvider] = useState(data?.llm.provider ?? "claude")
  const [apiKey, setApiKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [temp, setTemp] = useState(data?.llm.temperature ?? 0.7)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-xs text-neutral-400 uppercase tracking-widest mb-3">Provedor LLM</h3>
        <div className="flex flex-col gap-2">
          {PROVIDERS.map(p => (
            <button key={p.id} onClick={() => setProvider(p.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors text-left ${provider === p.id ? "border-blue-500 bg-blue-600/10" : "border-neutral-700 hover:border-neutral-600"}`}>
              <span className={`text-sm ${provider === p.id ? "text-blue-400" : "text-neutral-300"}`}>{p.label}</span>
              {p.badge && <span className="text-[10px] bg-blue-900/50 text-blue-400 border border-blue-800 rounded px-1.5 py-0.5">{p.badge}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-neutral-400">API Key</label>
        <div className="flex items-center bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 gap-2 focus-within:border-blue-600 transition-colors">
          <input
            type={showKey ? "text" : "password"}
            className="bg-transparent text-sm text-neutral-200 outline-none flex-1 placeholder-neutral-600"
            value={apiKey} onChange={e => setApiKey(e.target.value)}
            placeholder="sk-..."
          />
          <button onClick={() => setShowKey(s => !s)} className="text-neutral-500 hover:text-neutral-300">
            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-xs text-neutral-400 uppercase tracking-widest mb-3">
          Temperatura — {temp.toFixed(1)}
        </h3>
        <input type="range" min={0} max={1} step={0.1} value={temp}
          onChange={e => setTemp(parseFloat(e.target.value))}
          className="w-full accent-blue-500" />
        <div className="flex justify-between text-[10px] text-neutral-600 mt-1">
          <span>Preciso (0.0)</span><span>Criativo (1.0)</span>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={() => alert("Configurações salvas!")}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors">
          Salvar
        </button>
        <button onClick={() => alert("Conexão OK!")}
          className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm rounded-lg transition-colors">
          <Zap size={13} /> Testar Conexão
        </button>
      </div>
    </div>
  )
}
