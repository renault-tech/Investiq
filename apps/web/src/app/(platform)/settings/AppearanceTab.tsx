"use client"
import { useUIStore } from "@/store/useUIStore"

const ACCENTS = ["#3b82f6","#8b5cf6","#10b981","#f97316","#ec4899","#06b6d4"]

export function AppearanceTab() {
  const { theme, setTheme, fontScale, setFontScale } = useUIStore()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-xs text-neutral-400 uppercase tracking-widest mb-3">Tema</h3>
        <div className="flex gap-2">
          {(["dark","light"] as const).map(t => (
            <button key={t} onClick={() => setTheme(t)}
              className={`px-4 py-2 text-sm rounded-lg border transition-colors ${theme === t ? "border-blue-500 bg-blue-600/10 text-blue-400" : "border-neutral-700 text-neutral-400 hover:border-neutral-600"}`}>
              {t === "dark" ? "🌙 Escuro" : "☀️ Claro"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xs text-neutral-400 uppercase tracking-widest mb-3">Cor de Destaque</h3>
        <div className="flex gap-2">
          {ACCENTS.map(color => (
            <button key={color} onClick={() => {}}
              className="w-7 h-7 rounded-full border-2 border-neutral-700 hover:border-neutral-400 transition-colors"
              style={{ background: color }}
            />
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xs text-neutral-400 uppercase tracking-widest mb-3">
          Tamanho da Fonte — {Math.round(fontScale * 100)}%
        </h3>
        <input
          type="range" min={0.75} max={1.5} step={0.05} value={fontScale}
          onChange={e => setFontScale(parseFloat(e.target.value))}
          className="w-full accent-blue-500"
        />
        <div className="flex justify-between text-[10px] text-neutral-600 mt-1">
          <span>75%</span><span>100%</span><span>150%</span>
        </div>
      </div>
    </div>
  )
}
