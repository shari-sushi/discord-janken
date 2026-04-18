"use client"

interface Tab<T extends string> {
  id: T
  label: string
}

interface TabSelectorProps<T extends string> {
  tabs: Tab<T>[]
  selected: T
  onChange: (id: T) => void
}

export function TabSelector<T extends string>({ tabs, selected, onChange }: TabSelectorProps<T>) {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-zinc-800 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${selected === tab.id ? "bg-zinc-600 text-white" : "text-zinc-400 hover:text-white"}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
