"use client"
import { useState } from "react"
import { useSettings } from "@/lib/hooks/useSettings"

export function ProfileTab() {
  const { data } = useSettings()
  const [name, setName] = useState(data?.profile.full_name ?? "")

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-neutral-400">Nome Completo</label>
        <input
          className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-200 outline-none focus:border-blue-600 transition-colors"
          value={name} onChange={e => setName(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-neutral-400">Email</label>
        <input
          className="bg-neutral-800/50 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-400 cursor-not-allowed"
          value={data?.profile.email ?? ""} readOnly
        />
        <p className="text-[10px] text-neutral-600">Email não pode ser alterado.</p>
      </div>
      <button
        onClick={() => alert("Salvo!")}
        className="w-fit px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
      >
        Salvar Perfil
      </button>
    </div>
  )
}
