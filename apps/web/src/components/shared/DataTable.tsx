"use client"
import type { ReactNode } from "react"

export interface Column<T> {
  key: string
  header: string
  render?: (row: T) => ReactNode
  align?: "left" | "right" | "center"
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  onRowClick?: (row: T) => void
  emptyMessage?: string
  keyField?: keyof T
}

export function DataTable<T>({ columns, data, onRowClick, emptyMessage = "Nenhum dado", keyField }: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-neutral-800">
            {columns.map(col => (
              <th
                key={col.key}
                className={`py-2 px-3 text-neutral-400 font-medium whitespace-nowrap text-${col.align ?? "left"}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-10 text-center text-neutral-500">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={keyField ? String(row[keyField]) : i}
                onClick={() => onRowClick?.(row)}
                className={`border-b border-neutral-800/40 hover:bg-neutral-800/40 transition-colors ${onRowClick ? "cursor-pointer" : ""}`}
              >
                {columns.map(col => (
                  <td
                    key={col.key}
                    className={`py-2 px-3 text-neutral-200 whitespace-nowrap text-${col.align ?? "left"}`}
                  >
                    {col.render
                      ? col.render(row)
                      : String((row as Record<string, unknown>)[col.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
