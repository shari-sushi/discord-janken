import { NextResponse } from "next/server"
import { redisGet, redisSet, redisUpdate, redisDelete, redisExists } from "@/app/libs/redis/redis"

interface ValidationResult {
  valid: boolean
  error?: string
}

// NOTE: `:`を許容しているため、ユーザー入力でkeyの階層構造が意図せず崩れる可能性がある
// 現在は開発者の動作確認用のためこの実装になっている。
// 問題が起こる場合は認証を厳しくするか、実装を消す。
// 例: userName.replace(/:/g, '-')
export function validateKey(key: unknown): ValidationResult {
  if (typeof key !== "string" || key.length === 0) {
    return { valid: false, error: "Key must be a non-empty string" }
  }

  if (key.length > 256) {
    return { valid: false, error: "Key must not exceed 256 characters" }
  }

  const validKeyPattern = /^[a-zA-Z0-9_:-]+$/
  if (!validKeyPattern.test(key)) {
    return {
      valid: false,
      error: "Key contains invalid characters. Only alphanumeric, hyphen, underscore, and colon are allowed",
    }
  }

  return { valid: true }
}

export function validateValue(value: unknown): ValidationResult {
  if (typeof value !== "string") {
    return { valid: false, error: "Value must be a string" }
  }

  const MAX_VALUE_SIZE = 10 * 1024 * 1024 // 10MB in bytes
  const byteLength = Buffer.byteLength(value, "utf8")

  if (byteLength > MAX_VALUE_SIZE) {
    return {
      valid: false,
      error: `Value size exceeds maximum allowed size of ${MAX_VALUE_SIZE} bytes`,
    }
  }

  return { valid: true }
}

export async function handleCreate(key: string, value: string) {
  try {
    const exists = await redisExists(key)
    if (exists) {
      return NextResponse.json({ success: false, error: "Key already exists" }, { status: 409 })
    }

    await redisSet(key, value)

    return NextResponse.json({
      success: true,
      data: { key, value, created: true },
    })
  } catch (error) {
    console.error("Redis create error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

export async function handleGet(key: string) {
  try {
    const value = await redisGet<string>(key)

    return NextResponse.json({
      success: true,
      data: {
        key,
        value: value,
        exists: value !== null,
      },
    })
  } catch (error) {
    console.error("Redis get error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

export async function handleUpdate(key: string, value: string) {
  try {
    const updated = await redisUpdate(key, value)

    if (!updated) {
      return NextResponse.json({ success: false, error: "Key not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: { key, value, updated: true },
    })
  } catch (error) {
    console.error("Redis update error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

export async function handleDelete(key: string) {
  try {
    const deleted = await redisDelete(key)

    return NextResponse.json({
      success: true,
      data: { key, deleted },
    })
  } catch (error) {
    console.error("Redis delete error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
