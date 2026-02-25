// リクエスト型
export interface CreateRequest {
  key: string
  value: string
}

export interface GetRequest {
  key: string
}

export interface UpdateRequest {
  key: string
  value: string
}

export interface DeleteRequest {
  key: string
}

// レスポンス型
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export interface CreateResponse {
  key: string
  value: string
  created: boolean
}

export interface GetResponse {
  key: string
  value: string | null
  exists: boolean
}

export interface UpdateResponse {
  key: string
  value: string
  updated: boolean
}

export interface DeleteResponse {
  key: string
  deleted: boolean
}
