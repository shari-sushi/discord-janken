"use client"

import Image from "next/image"
import { ROLE_DISPLAY, ROLE_ICON } from "../_types"
import type { RoleOrFill } from "../_types"

type Props = {
  name: string
  role: RoleOrFill
  selected: boolean
  onClick: () => void
}

export function RoleButton({ name, role, selected, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      disabled={!name}
      className="mx-auto rounded p-0.5 transition-opacity cursor-pointer hover:bg-zinc-700 disabled:cursor-default disabled:pointer-events-none"
      aria-label={ROLE_DISPLAY[role]}
      aria-pressed={selected}
    >
      <Image src={ROLE_ICON[role]} alt={ROLE_DISPLAY[role]} width={28} height={28} className={`min-w-6 transition-opacity my-1 md:mx-2 ${selected ? "" : "opacity-30"}`} />
    </button>
  )
}
