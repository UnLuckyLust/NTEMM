export type TranslationPrimitive = string | number | boolean | null | undefined

export type TranslationParams = Record<string, TranslationPrimitive>

export type TranslationTree = {
  [key: string]: string | TranslationTree
}

export type LanguageDirection = "ltr" | "rtl"

export type TranslationFile = TranslationTree & {
  $meta?: {
    name?: string
    nativeName?: string
    dir?: LanguageDirection
  }
}

export type LanguageOption = {
  code: string
  name: string
  nativeName: string
  dir: LanguageDirection
}