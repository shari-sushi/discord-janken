import LolHeader from "./_components/LolHeader"

export default function LolLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <LolHeader />
      {children}
    </div>
  )
}
