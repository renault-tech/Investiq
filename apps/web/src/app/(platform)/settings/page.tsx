"use client"
import { useState } from "react"
import { User, Palette, Key, Cpu } from "lucide-react"
import { ProfileTab }    from "./ProfileTab"
import { AppearanceTab } from "./AppearanceTab"
import { ApiKeysTab }    from "./ApiKeysTab"
import { LLMTab }        from "./LLMTab"

const TABS = [
  { id: "profile",    label: "Perfil",      icon: User,    component: ProfileTab },
  { id: "appearance", label: "Aparência",   icon: Palette, component: AppearanceTab },
  { id: "apikeys",    label: "API Keys",    icon: Key,     component: ApiKeysTab },
  { id: "llm",        label: "LLM / IA",    icon: Cpu,     component: LLMTab },
] as const

type TabId = typeof TABS[number]["id"]

export default function SettingsPage() {
  const [active, setActive] = useState<TabId>("profile")
  const current = TABS.find(t => t.id === active)!
  const Component = current.component

  return (
    <div className="h-full overflow-auto p-4 flex gap-6">
      <nav className="w-48 shrink-0 flex flex-col gap-1">
        <h1 className="text-xs text-neutral-500 uppercase tracking-widest px-3 py-2">Configurações</h1>
        {TABS.map(tab => {
          const Icon = tab.icon
          return (
            <button key={tab.id} onClick={() => setActive(tab.id)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left ${active === tab.id ? "bg-blue-600/10 text-blue-400 border border-blue-800/50" : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"}`}>
              <Icon size={15} />
              {tab.label}
            </button>
          )
        })}
      </nav>

      <div className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg p-6">
        <h2 className="text-base font-semibold text-neutral-100 mb-6">{current.label}</h2>
        <Component />
      </div>
    </div>
  )
}
