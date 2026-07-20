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

export type ChosenDevice = { id: string; name: string }

/** Ad da saklanıyor: id opak, kartta "iPhone" yazabilmek gerekiyor. */
export function savedDevice(): ChosenDevice | null {
  const raw = localStorage.getItem(DEVICE_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    return parsed?.id ? (parsed as ChosenDevice) : null
  } catch {
    // Önceki sürüm düz id yazıyordu; adı bilinmiyor ama seçim korunur.
    return { id: raw, name: 'Kayıtlı cihaz' }
  }
}

export function rememberDevice(device: ChosenDevice | null) {
  if (device) localStorage.setItem(DEVICE_KEY, JSON.stringify(device))
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
    return { label: 'sakin', queries: ['calm', 'chill', 'mellow acoustic'] }
  }
  if (code <= 1) {
    return {
      label: 'güneşli',
      queries: ['sunny upbeat', 'summer pop energetic', 'feel good', 'good vibes'],
    }
  }
  if (code <= 3) {
    return {
      label: 'bulutlu',
      queries: ['cloudy indie', 'indie folk mellow', 'overcast indie'],
    }
  }
  if (code <= 48) {
    return {
      label: 'sisli',
      queries: ['foggy ambient', 'atmospheric ambient', 'downtempo'],
    }
  }
  if (code <= 57) {
    return {
      label: 'çisenti',
      queries: ['drizzle lofi', 'light rain lofi', 'soft lofi'],
    }
  }
  if (code <= 67 || (code >= 80 && code <= 86)) {
    return {
      label: 'yağmurlu',
      queries: ['rainy day', 'rainy day lofi', 'rain acoustic', 'rainy jazz'],
    }
  }
  if (code <= 77) {
    return {
      label: 'karlı',
      queries: ['snowy acoustic', 'winter acoustic', 'snow day chill'],
    }
  }
  return {
    label: 'fırtınalı',
    queries: ['storm atmospheric', 'dark ambient', 'cinematic atmospheric'],
  }
}

/**
 * Etiket Türkçe (arayüz Türkçe), sorgu İngilizce.
 *
 * Sorgular Türkçe yazıldığında Spotify neredeyse yalnızca Türkçe listeler
 * döndürüyor; havuz İngilizce olunca katalog belirgin biçimde genişliyor.
 */
function timeLabel(hour: number): string {
  if (hour < 6) return 'gece'
  if (hour < 11) return 'sabah'
  if (hour < 17) return 'gündüz'
  if (hour < 22) return 'akşam'
  return 'gece'
}

function timeQuery(hour: number): string {
  if (hour < 6) return 'night'
  if (hour < 11) return 'morning'
  if (hour < 17) return 'afternoon'
  if (hour < 22) return 'evening'
  return 'night'
}

/** Hava + saatten arama sorgusu ve düğmede gösterilecek etiket. */
export function weatherVibe(code: number | null, date = new Date()) {
  const hour = date.getHours()
  const mood = weatherMood(code)

  return {
    query: `${pick(mood.queries)} ${timeQuery(hour)}`,
    label: `${mood.label} ${timeLabel(hour)}`,
  }
}

export const PRESETS = {
  morning: {
    label: 'Sabah',
    queries: ['morning energy wake up', 'good morning pop', 'morning motivation'],
  },
  focus: {
    label: 'Odak',
    queries: ['deep focus instrumental', 'deep focus', 'concentration instrumental'],
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
