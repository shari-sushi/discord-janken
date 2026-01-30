"use client"
import { useState } from "react"

export default function Home() {
  const [inputValue, setInputValue] = useState("")
  const [result, setResult] = useState("")

  const handleSubmit = async () => {
    try {
      const response = await fetch("/api", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: inputValue }),
      })

      const data = await response.json()
      setResult(`サーバーからの応答: ${data.message}`)
    } catch {
      setResult("エラーが発生しました")
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center py-32 px-16 bg-white dark:bg-black sm:items-start">
        test!!
        <div className="bg-zinc-800 p-4 rounded">
          <input className="w-full bg-white text-black px-2 py-1 rounded" value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder="入力してください" />
          <div className="bg-blue-300 w-20 m-1 text-center cursor-pointer hover:bg-blue-400 rounded px-2 py-1" onClick={handleSubmit}>
            送信
          </div>

          <div>
            <div className="text-white mt-2">結果</div>
            {result && <div className="text-white bg-zinc-700 p-2 mt-1 rounded">{result}</div>}
          </div>
        </div>
      </main>
    </div>
  )
}
