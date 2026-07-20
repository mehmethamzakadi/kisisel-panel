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

/**
 * Hava koduna karşılık gelen arama sözcükleri.
 *
 * Spotify'ın audio-features ucu (valence/energy) 2024'te kapandığı için
 * "ruh hali" artık ölçülemiyor; eşleştirme bu yüzden elle yazıldı. Aynı işi
 * Gemini'ye de yaptırabilirdik ama çalma düğmesine basınca 3-5 saniye
 * beklemek ve zaman zaman 503 yemek anlamına gelirdi.
 */
function weatherWords(code: number): string {
  if (code <= 1) return 'güneşli enerjik'
  if (code <= 3) return 'bulutlu indie'
  if (code <= 48) return 'sisli ambient'
  if (code <= 57) return 'çisenti lofi'
  if (code <= 67) return 'yağmurlu sakin lofi'
  if (code <= 77) return 'karlı akustik'
  if (code <= 86) return 'yağmurlu sakin lofi'
  return 'fırtına atmosferik'
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
  const weather = code === null ? 'sakin' : weatherWords(code)
  const [mood] = weather.split(' ')

  return {
    query: `${weather} ${time}`,
    label: `${mood} ${time}`,
  }
}

export const PRESETS = {
  morning: { query: 'sabah enerjik uyanma', label: 'Sabah' },
  focus: { query: 'odaklanma çalışma enstrümantal', label: 'Odak' },
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
