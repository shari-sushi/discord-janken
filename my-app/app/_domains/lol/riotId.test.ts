// cSpell:disable
import { describe, it, expect } from "vitest"
import { validateRiotId } from "./riotId"

describe("validateRiotId", () => {
  // --- 正常系 ---

  it("success: 標準的なRiot IDを受け入れる", () => {
    expect(validateRiotId("Player#JP1")).toEqual({ valid: true })
  })

  it("success: ゲーム名が3文字（最小）でも受け入れる", () => {
    expect(validateRiotId("abc#JP1")).toEqual({ valid: true })
  })

  it("success: ゲーム名が16文字（最大）でも受け入れる", () => {
    expect(validateRiotId("abcdefghijklmnop#JP1")).toEqual({ valid: true })
  })

  it("success: タグラインが3文字（最小）でも受け入れる", () => {
    expect(validateRiotId("Player#JP1")).toEqual({ valid: true })
  })

  it("success: タグラインが5文字（最大）でも受け入れる", () => {
    expect(validateRiotId("Player#ABCDE")).toEqual({ valid: true })
  })

  it("success: タグラインに数字が含まれても受け入れる", () => {
    expect(validateRiotId("Player#12345")).toEqual({ valid: true })
  })

  it("success: タグラインに英数字混在でも受け入れる", () => {
    expect(validateRiotId("Player#A1B2C")).toEqual({ valid: true })
  })

  it("success: ゲーム名に日本語が含まれても受け入れる（文字種制限なし）", () => {
    expect(validateRiotId("月に変わってお仕置きよ#JP1")).toEqual({ valid: true })
  })

  it("success: ゲーム名にスペースが含まれても受け入れる", () => {
    expect(validateRiotId("じゅん じゅわー#jun")).toEqual({ valid: true })
  })

  it("success: タグラインが大文字小文字混在でも受け入れる", () => {
    expect(validateRiotId("Player#Jp1")).toEqual({ valid: true })
  })

  // --- 異常系: フォーマット ---

  it("failure: #が含まれない場合はエラー", () => {
    const result = validateRiotId("PlayerJP1")
    expect(result).toEqual({ valid: false, error: "「ゲーム名#タグライン」の形式で入力してください（例: Player#JP1）" })
  })

  it("failure: #が2つ以上含まれる場合はエラー", () => {
    const result = validateRiotId("Player#JP1#extra")
    expect(result).toEqual({ valid: false, error: "「ゲーム名#タグライン」の形式で入力してください（例: Player#JP1）" })
  })

  // --- 異常系: ゲーム名 ---

  it("failure: ゲーム名が2文字（最小未満）の場合はエラー", () => {
    const result = validateRiotId("ab#JP1")
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.error).toContain("ゲーム名は3〜16文字")
  })

  it("failure: ゲーム名が17文字（最大超過）の場合はエラー", () => {
    const result = validateRiotId("abcdefghijklmnopq#JP1")
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.error).toContain("ゲーム名は3〜16文字")
  })

  it("failure: ゲーム名が空の場合はエラー", () => {
    const result = validateRiotId("#JP1")
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.error).toContain("ゲーム名は3〜16文字")
  })

  // --- 異常系: タグライン ---

  it("failure: タグラインが2文字（最小未満）の場合はエラー", () => {
    const result = validateRiotId("Player#JP")
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.error).toContain("タグラインは3〜5文字")
  })

  it("failure: タグラインが6文字（最大超過）の場合はエラー", () => {
    const result = validateRiotId("Player#ABCDEF")
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.error).toContain("タグラインは3〜5文字")
  })

  it("failure: タグラインが空の場合はエラー", () => {
    const result = validateRiotId("Player#")
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.error).toContain("タグラインは3〜5文字")
  })

  it("failure: タグラインに日本語が含まれる場合はエラー（3文字で文字種チェックが発動）", () => {
    // "御殿a" は3文字でサイズ条件はパスするが、英数字以外を含むためエラー
    const result = validateRiotId("Player#御殿a")
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.error).toContain("タグラインは半角英数字のみ")
  })

  it("failure: タグラインに記号が含まれる場合はエラー", () => {
    const result = validateRiotId("Player#JP-1")
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.error).toContain("タグラインは半角英数字のみ")
  })

  it("failure: タグラインにスペースが含まれる場合はエラー", () => {
    const result = validateRiotId("Player#JP 1")
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.error).toContain("タグラインは半角英数字のみ")
  })
})
