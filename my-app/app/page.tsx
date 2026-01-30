"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createData, getData, updateData, deleteData } from "@/libs/redisCrudApi"

export default function Home() {
  const [key, setKey] = useState("")
  const [value, setValue] = useState("")
  const [result, setResult] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // セッショントークンがない場合はログインページにリダイレクト
    const token = localStorage.getItem("sessionToken")
    if (!token) {
      router.push("/login")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCreate = async () => {
    try {
      setIsLoading(true)
      const response = await createData(key, value)
      setResult(JSON.stringify(response, null, 2))
    } catch (error) {
      setResult(`エラーが発生しました: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGet = async () => {
    try {
      setIsLoading(true)
      const response = await getData(key)
      setResult(JSON.stringify(response, null, 2))
    } catch (error) {
      setResult(`エラーが発生しました: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdate = async () => {
    try {
      setIsLoading(true)
      const response = await updateData(key, value)
      setResult(JSON.stringify(response, null, 2))
    } catch (error) {
      setResult(`エラーが発生しました: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    try {
      setIsLoading(true)
      const response = await deleteData(key)
      setResult(JSON.stringify(response, null, 2))
    } catch (error) {
      setResult(`エラーが発生しました: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Redis CRUD 操作画面</h1>

      <div className="bg-zinc-700 p-6 rounded-lg mb-6">
        <div className="mb-4">
          <label className="block mb-2 font-semibold">Key:</label>
          <input className="w-full border border-zinc-300 px-3 py-2 rounded" value={key} onChange={(e) => setKey(e.target.value)} placeholder="例: match:123:blueTeam:member" />
        </div>

        <div className="mb-4">
          <label className="block mb-2 font-semibold">Value:</label>
          <input className="w-full border border-zinc-300 px-3 py-2 rounded" value={value} onChange={(e) => setValue(e.target.value)} placeholder="例: John Doe" />
        </div>

        <div className="flex gap-2 flex-wrap">
          <button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed" onClick={handleCreate} disabled={isLoading || !key || !value}>
            CREATE
          </button>
          <button className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed" onClick={handleGet} disabled={isLoading || !key}>
            GET
          </button>
          <button
            className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleUpdate}
            disabled={isLoading || !key || !value}
          >
            UPDATE
          </button>
          <button className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed" onClick={handleDelete} disabled={isLoading || !key}>
            DELETE
          </button>
        </div>
      </div>

      <div className="bg-zinc-700 p-6 rounded-lg h-60">
        <h2 className="text-xl font-semibold mb-3">操作結果:</h2>
        {isLoading ? (
          <div className="bg-zinc-700 p-4 rounded border border-zinc-300 text-white">処理中...</div>
        ) : result ? (
          <pre className="bg-zinc-700 p-4 rounded border border-zinc-300 overflow-x-auto text-sm text-white">{result}</pre>
        ) : (
          <div className="bg-zinc-700 p-4 rounded border border-zinc-300 text-zinc-400">操作を実行すると、ここに結果が表示されます</div>
        )}
      </div>
    </div>
  )
}
