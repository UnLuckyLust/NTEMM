import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import type {
  LanguageDirection,
  LanguageOption,
  TranslationFile,
  TranslationParams,
} from "@/i18n/types"

const APP_LANGUAGE_KEY = "appLanguage"
const DEFAULT_LANGUAGE = "en"

const localeModules = import.meta.glob("./locales/*.json", {
  eager: true,
  import: "default",
}) as Record<string, TranslationFile>

const translations = Object.fromEntries(
  Object.entries(localeModules).map(([path, file]) => {
    const code = path.match(/\/([^/]+)\.json$/)?.[1] ?? DEFAULT_LANGUAGE
    return [code, file]
  }),
)

function getStoredLanguage() {
  const stored = localStorage.getItem(APP_LANGUAGE_KEY)
  return stored && translations[stored] ? stored : DEFAULT_LANGUAGE
}

function readPath(file: TranslationFile | undefined, key: string): string | null {
  if (!file) return null

  let current: unknown = file

  for (const part of key.split(".")) {
    if (!current || typeof current !== "object") return null
    current = (current as Record<string, unknown>)[part]
  }

  return typeof current === "string" ? current : null
}

function getLanguageDirection(language: string): LanguageDirection {
  return translations[language]?.$meta?.dir === "rtl" ? "rtl" : "ltr"
}

function applyParams(value: string, params?: TranslationParams) {
  if (!params) return value

  return value.replace(/\{(\w+)\}/g, (_, key: string) => {
    const param = params[key]
    return param === null || param === undefined ? "" : String(param)
  })
}

export const availableLanguages: LanguageOption[] = Object.entries(translations)
  .map(([code, file]) => {
    const dir: LanguageDirection = file.$meta?.dir === "rtl" ? "rtl" : "ltr"

    return {
      code,
      name: file.$meta?.name ?? code,
      nativeName: file.$meta?.nativeName ?? file.$meta?.name ?? code,
      dir,
    }
  })
  .sort((a, b) => a.name.localeCompare(b.name))

export function translate(
  key: string,
  params?: TranslationParams,
  language = getStoredLanguage(),
) {
  const value =
    readPath(translations[language], key) ??
    readPath(translations[DEFAULT_LANGUAGE], key) ??
    key

  return applyParams(value, params)
}

type I18nContextValue = {
  language: string
  dir: LanguageDirection
  isRtl: boolean
  setLanguage: (language: string) => void
  t: (key: string, params?: TranslationParams) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState(getStoredLanguage)

  function setLanguage(nextLanguage: string) {
    if (!translations[nextLanguage]) return

    localStorage.setItem(APP_LANGUAGE_KEY, nextLanguage)
    setLanguageState(nextLanguage)
    window.dispatchEvent(new Event("appLanguageChanged"))
  }

  useEffect(() => {
    function syncLanguage() {
      setLanguageState(getStoredLanguage())
    }

    window.addEventListener("storage", syncLanguage)
    window.addEventListener("appLanguageChanged", syncLanguage)

    return () => {
      window.removeEventListener("storage", syncLanguage)
      window.removeEventListener("appLanguageChanged", syncLanguage)
    }
  }, [])

  const dir = getLanguageDirection(language)
  const isRtl = dir === "rtl"

  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = dir
    document.body.dataset.dir = dir
  }, [dir, language])

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      dir,
      isRtl,
      setLanguage,
      t: (key, params) => translate(key, params, language),
    }),
    [dir, isRtl, language],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export { getLanguageDirection }

export function useI18n() {
  const context = useContext(I18nContext)

  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider")
  }

  return context
}