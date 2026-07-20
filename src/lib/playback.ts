import { supabase } from './supabase'

export type Device = {
  id: string
  name: string
  type: string
  is_active: boolean
}

export type Playlist = { uri: string; name: string; url: string | null }

export type PlayResult =
  | { ok: true; playlist: Playlist }
  | { ok: false; reason: 'no-device'; devices: Device[] }
  | { ok: false; reason: 'premium-required' | 'scope-missing' | 'not-connected' }
  | { ok: false; reason: 'no-playlist' | 'failed'; detail?: string }

/** Cihaz seçimi kalıcı: her çalmada yeniden seçtirmek can sıkıcı olurdu. */
const DEVICE_KEY = 'panel:spotify-device'

export function savedDevice() {
  return localStorage.getItem(DEVICE_KEY)
}

export function rememberDevice(id: string | null) {
  if (id) localStorage.setItem(DEVICE_KEY, id)
  else localStorage.removeItem(DEVICE_KEY)
}

type Mood = { label: string; queries: string[] }

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)]
}

/**
 * Hava koduna karşılık gelen ruh hali ve arama sözcükleri.
 *
 * Spotify'ın audio-features ucu (valence/energy) 2024'te kapandığı için
 * "ruh hali" artık ölçülemiyor; eşleştirme bu yüzden elle yazıldı. Aynı işi
 * Gemini'ye de yaptırabilirdik ama çalma düğmesine basınca 3-5 saniye
 * beklemek ve zaman zaman 503 yemek anlamına gelirdi.
 *
 * Her ruh hali için birden fazla sorgu var: tek sabit sorgu, arama sonucu
 * rastgele seçilse bile hep aynı on listenin içinde dönmek demekti.
 * Etiket sabit kalır (düğme yazısı zıplamasın), sorgu her tıkta değişir.
 */
function weatherMood(code: number | null): Mood {
  if (code === null) {
    return { label: 'sakin', queries: ['sakin', 'chill', 'huzurlu akustik'] }
  }
  if (code <= 1) {
    return {
      label: 'güneşli',
      queries: ['güneşli enerjik', 'yaz pop enerjik', 'neşeli gün', 'feel good'],
    }
  }
  if (code <= 3) {
    return {
      label: 'bulutlu',
      queries: ['bulutlu indie', 'indie folk sakin', 'kapalı hava indie'],
    }
  }
  if (code <= 48) {
    return {
      label: 'sisli',
      queries: ['sisli ambient', 'ambient atmosferik', 'downtempo'],
    }
  }
  if (code <= 57) {
    return {
      label: 'çisenti',
      queries: ['çisenti lofi', 'lofi hafif yağmur', 'yumuşak lofi'],
    }
  }
  if (code <= 67 || (code >= 80 && code <= 86)) {
    return {
      label: 'yağmurlu',
      queries: ['yağmurlu sakin', 'rainy day lofi', 'yağmur akustik', 'rainy jazz'],
    }
  }
  if (code <= 77) {
    return {
      label: 'karlı',
      queries: ['karlı akustik', 'kış akustik', 'snow day chill'],
    }
  }
  return {
    label: 'fırtınalı',
    queries: ['fırtına atmosferik', 'dark ambient', 'cinematic atmosferik'],
  }
}

function timeWords(hour: number): string {
  if (hour < 6) return 'gece'
  if (hour < 11) return 'sabah'
  if (hour < 17) return 'gündüz'
  if (hour < 22) return 'akşam'
  return 'gece'
}

/** Hava + saatten arama sorgusu ve düğmede gösterilecek etiket. */
export function weatherVibe(code: number | null, date = new Date()) {
  const time = timeWords(date.getHours())
  const mood = weatherMood(code)

  return {
    query: `${pick(mood.queries)} ${time}`,
    label: `${mood.label} ${time}`,
  }
}

export const PRESETS = {
  morning: {
    label: 'Sabah',
    queries: ['sabah enerjik uyanma', 'günaydın pop', 'morning motivation'],
  },
  focus: {
    label: 'Odak',
    queries: ['odaklanma çalışma enstrümantal', 'deep focus', 'concentration'],
  },
}

/** Her çağrıda havuzdan farklı bir sorgu — aynı listeye saplanmamak için. */
export function presetQuery(key: keyof typeof PRESETS): string {
  return pick(PRESETS[key].queries)
}

async function call(body: Record<string, unknown>) {
  if (!supabase) return null
  const { data, error } = await supabase.functions.invoke('spotify-play', { body })
  return error ? null : data
}

export async function play(
  query: string,
  deviceId?: string | null,
): Promise<PlayResult> {
  const data = await call({
    action: 'play',
    query,
    ...(deviceId ? { device_id: deviceId } : {}),
  })

  if (!data) return { ok: false, reason: 'failed' }
  if (data.ok) return { ok: true, playlist: data.playlist as Playlist }

  if (data.error === 'no-device') {
    return { ok: false, reason: 'no-device', devices: (data.devices ?? []) as Device[] }
  }

  if (
    data.error === 'premium-required' ||
    data.error === 'scope-missing' ||
    data.error === 'not-connected' ||
    data.error === 'no-playlist'
  ) {
    return { ok: false, reason: data.error }
  }

  return { ok: false, reason: 'failed', detail: String(data.detail ?? data.error ?? '') }
}

export async function pause(): Promise<{ ok: boolean; message?: string }> {
  const data = await call({ action: 'pause' })
  if (data?.ok) return { ok: true }

  return {
    ok: false,
    message: describeFailure(String(data?.error ?? 'failed'), data?.detail),
  }
}

export async function listDevices(): Promise<Device[]> {
  const data = await call({ action: 'devices' })
  return (data?.devices ?? []) as Device[]
}

/**
 * Kullanıcıya gösterilecek hata metni — sebepler farklı çözümler gerektiriyor.
 * Tanınmayan hatalarda sunucudan gelen ham metin de gösterilir: "başlatılamadı"
 * tek başına hiçbir şey söylemiyor.
 */
export function describeFailure(reason: string, detail?: string): string {
  switch (reason) {
    case 'premium-required':
      return 'Çalma kontrolü yalnızca Spotify Premium ile çalışıyor.'
    case 'scope-missing':
      return 'Yeni izinler verilmemiş. Spotify bağlantısını yenile.'
    case 'not-connected':
      return 'Spotify bağlı değil.'
    case 'no-playlist':
      return 'Bu ruh haline uygun çalma listesi bulunamadı.'
    default:
      return detail
        ? `Çalma başlatılamadı — ${detail}`
        : 'Çalma başlatılamadı.'
  }
}

/** PlayResult'tan doğrudan mesaj üretir; detay alanı yalnızca bazı dallarda var. */
export function failureMessage(result: PlayResult): string {
  if (result.ok) return ''
  return describeFailure(
    result.reason,
    'detail' in result ? result.detail : undefined,
  )
}
