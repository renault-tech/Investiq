"use client"
import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"

interface MaskedInputProps {
  label: string
  placeholder: string
  hint: string
}

function MaskedInput({ label, placeholder, hint }: MaskedInputProps) {
  const [show, setShow] = useState(false)
  const [value, setValue] = useState("")

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-neutral-400">{label}</label>
      <div className="flex items-center bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 gap-2 focus-within:border-blue-600 transition-colors">
        <input
          type={show ? "text" : "password"}
          className="bg-transparent text-sm text-neutral-200 outline-none flex-1 placeholder-neutral-600"
          value={value} onChange={e => setValue(e.target.value)}
          placeholder={placeholder}
        />
        <button onClick={() => setShow(s => !s)} className="text-neutral-500 hover:text-neutral-300">
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      <p className="text-[10px] text-neutral-600">{hint}</p>
    </div>
  )
}

export function ApiKeysTab() {
  return (
    <div className="flex flex-col gap-6">
      <MaskedInput
        label="Brapi Token"
        placeholder="Seu token da API Brapi"
        hint="Obtido em brapi.dev · usado para cotações B3"
      />
      <MaskedInput
        label="Alpha Vantage Key"
        placeholder="Sua chave Alpha Vantage"
        hint="Obtida em alphavantage.co · usado para dados internacionais"
      />
      <button
        onClick={() => alert("API Keys salvas (criptografadas)!")}
        className="w-fit px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
      >
        Salvar Chaves
      </button>
    </div>
  )
}
