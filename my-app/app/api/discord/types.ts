// https://discord.com/developers/docs/components/reference#string-select-select-option-structure
export type SelectOptionStructure = {
  label: string
  value: string
  description?: string
  emoji?: string
  default?: boolean
}
