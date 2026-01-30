import type {
  CreateRequest,
  GetRequest,
  UpdateRequest,
  DeleteRequest,
  ApiResponse,
  CreateResponse,
  GetResponse,
  UpdateResponse,
  DeleteResponse,
} from "@/types/api"

const API_BASE = "/api/web/crud"

async function fetchWithAuth<T>(
  endpoint: string,
  body: object
): Promise<ApiResponse<T>> {
  // localStorageからセッショントークンを取得
  const sessionToken = typeof window !== "undefined"
    ? localStorage.getItem("sessionToken")
    : null

  if (!sessionToken) {
    throw new Error("セッショントークンがありません。ログインしてください。")
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify(body),
  })
  return await response.json()
}

export async function createData(
  key: string,
  value: string
): Promise<ApiResponse<CreateResponse>> {
  const body: CreateRequest = { key, value }
  return fetchWithAuth<CreateResponse>("/create", body)
}

export async function getData(
  key: string
): Promise<ApiResponse<GetResponse>> {
  const body: GetRequest = { key }
  return fetchWithAuth<GetResponse>("/get", body)
}

export async function updateData(
  key: string,
  value: string
): Promise<ApiResponse<UpdateResponse>> {
  const body: UpdateRequest = { key, value }
  return fetchWithAuth<UpdateResponse>("/update", body)
}

export async function deleteData(
  key: string
): Promise<ApiResponse<DeleteResponse>> {
  const body: DeleteRequest = { key }
  return fetchWithAuth<DeleteResponse>("/delete", body)
}
