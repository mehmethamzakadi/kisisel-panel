import { currentWeather, requestFocus } from './bus'
import {
  failureMessage,
  pause,
  play,
  presetQuery,
  savedDevice,
  weatherVibe,
} from './playback'
import { addIngredients, describeResult } from './shopping'

/**
 * Komut paletinin çalıştırdığı iş. Dönen metin kullanıcıya geri bildirim
 * olarak gösterilir; null ise palet sessizce kapanır (gezinme komutları gibi,
 * sonucu zaten ekranın kendisi anlatıyor).
 */
export type Command = {
  id: string
  label: string
  group: 'Git' | 'Müzik' | 'Odak' | 'Liste'
  /** Aramada eşleşsin diye ek sözcükler: kısaltmalar, İngilizce karşılıklar. */
  keywords?: string[]
  /**
   * Serbest metin alan komutlar için tetikleyici sözcük. "ekle süt" yazıldığında
   * komut bu önekle bulunur, kalanı argüman olur — palet hızının asıl kaynağı
   * iki adım yerine tek satırda iş bitirmek.
   */
  prefix?: string
  /** prefix varken argümanın ne olduğunu anlatan ipucu. */
  argumentHint?: string
  run: (argument: string) => Promise<string | null> | string | null
}

/** Çalma sonucunu kullanıcıya tek cümlede anlatır. */
async function startPlayback(query: string, what: string) {
  const result = await play(query, savedDevice()?.id)
  return result.ok ? `${what}: ${result.playlist.name}` : failureMessage(result)
}

export function buildCommands(navigate: (to: string) => void): Command[] {
  return [
    {
      id: 'go-panel',
      label: 'Panele git',
      group: 'Git',
      keywords: ['ana', 'dashboard', 'kartlar'],
      run: () => {
        navigate('/')
        return null
      },
    },
    {
      id: 'go-notes',
      label: 'Notlara git',
      group: 'Git',
      keywords: ['not', 'hatirlatma', 'notlar'],
      run: () => {
        navigate('/notlar')
        return null
      },
    },
    {
      id: 'go-meals',
      label: 'Tariflere git',
      group: 'Git',
      keywords: ['yemek', 'tarif', 'mutfak'],
      run: () => {
        navigate('/tarifler')
        return null
      },
    },
    {
      id: 'go-music',
      label: 'Müzik arşivine git',
      group: 'Git',
      keywords: ['spotify', 'dinleme', 'arsiv'],
      run: () => {
        navigate('/muzik')
        return null
      },
    },

    {
      id: 'play-weather',
      label: 'Havaya göre çal',
      group: 'Müzik',
      keywords: ['hava', 'vibe', 'oneri'],
      run: () => {
        // Hava WeatherCard'da yaşıyor; bus son değeri tuttuğu için palet
        // panelin dışındayken de doğru sorguyu üretebiliyor.
        const vibe = weatherVibe(currentWeather()?.code ?? null)
        return startPlayback(vibe.query, vibe.label)
      },
    },
    {
      id: 'play-focus',
      label: 'Odak listesi çal',
      group: 'Müzik',
      keywords: ['calisma', 'konsantrasyon', 'deep focus'],
      run: () => startPlayback(presetQuery('focus'), 'Odak'),
    },
    {
      id: 'play-morning',
      label: 'Sabah listesi çal',
      group: 'Müzik',
      keywords: ['gunaydin', 'rutin'],
      run: () => startPlayback(presetQuery('morning'), 'Sabah'),
    },
    {
      id: 'pause',
      label: 'Müziği duraklat',
      group: 'Müzik',
      keywords: ['dur', 'sustur', 'stop'],
      run: async () => {
        await pause()
        return 'Müzik duraklatıldı'
      },
    },

    ...[15, 25, 50].map(
      (minutes): Command => ({
        id: `focus-${minutes}`,
        label: `${minutes} dakikalık odak seansı başlat`,
        group: 'Odak',
        keywords: ['pomodoro', 'calis', String(minutes)],
        run: () => {
          // Seansı FocusCard yürütüyor; panelde değilsek oraya götür ki
          // sayaç görünsün.
          requestFocus(minutes)
          navigate('/')
          return null
        },
      }),
    ),

    {
      id: 'shopping-add',
      label: 'Alışveriş listesine ekle',
      group: 'Liste',
      keywords: ['market', 'alisveris', 'liste'],
      prefix: 'ekle',
      argumentHint: 'ürün adı',
      run: async (argument) => {
        if (!argument.trim()) return 'Ne ekleneceğini yaz: "ekle süt"'
        // Virgülle birden çok ürün: "ekle süt, ekmek, yumurta"
        const items = argument.split(',').map((s) => s.trim()).filter(Boolean)
        return describeResult(await addIngredients(items))
      },
    },
  ]
}

/** Göstergede yazan kısayol. Mac'te ⌘, diğer her yerde Ctrl. */
export function paletteShortcut() {
  const mac =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)
  return mac ? '⌘K' : 'Ctrl K'
}

const fold = (s: string) => s.toLocaleLowerCase('tr')

export type Match = { command: Command; argument: string }

/**
 * Girdiyi komutlarla eşler.
 *
 * Önce önek denenir: "ekle süt" yazıldığında yalnızca ekleme komutu kalır ve
 * "süt" argüman olur. Aksi halde etiket ve anahtar sözcüklerde basit bir alt
 * dize araması yapılır — komut sayısı iki haneli, bulanık aramaya gerek yok.
 */
export function matchCommands(commands: Command[], input: string): Match[] {
  const query = fold(input.trim())
  if (!query) return commands.map((command) => ({ command, argument: '' }))

  for (const command of commands) {
    if (!command.prefix) continue
    const prefix = fold(command.prefix)
    if (query === prefix || query.startsWith(prefix + ' ')) {
      return [{ command, argument: input.trim().slice(command.prefix.length).trim() }]
    }
  }

  return commands
    .filter((command) => {
      const haystack = [command.label, command.group, ...(command.keywords ?? [])]
      return haystack.some((part) => fold(part).includes(query))
    })
    .map((command) => ({ command, argument: '' }))
}
