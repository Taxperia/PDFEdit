import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Lang } from '../types'
import { translations, type TKey } from './translations'

interface I18nValue {
  lang: Lang
  setLang: (l: Lang) => void
  t: (k: TKey) => string
}

const I18nCtx = createContext<I18nValue>({
  lang: 'en',
  setLang: () => {},
  t: (k) => translations.en[k],
})

function storedLang(): Lang {
  try {
    const v = localStorage.getItem('pdfedit-lang')
    return v === 'tr' ? 'tr' : 'en'
  } catch {
    return 'en'
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(storedLang)
  useEffect(() => { document.documentElement.lang = lang }, [lang])
  const value = useMemo<I18nValue>(
    () => ({
      lang,
      setLang: (l) => {
        setLangState(l)
        try {
          localStorage.setItem('pdfedit-lang', l)
        } catch {
          /* ignore */
        }
        document.documentElement.lang = l
      },
      t: (k) => translations[lang][k] ?? k,
    }),
    [lang],
  )
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>
}

export function useI18n(): I18nValue {
  return useContext(I18nCtx)
}
