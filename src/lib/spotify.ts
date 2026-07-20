import { supabase } from './supabase'

/** spotify-now'ın döndürdüğü parça biçimi. */
export type Track = {
  id: string
  track: string
  artist: string
  album: string | null
  art: string | null
  url: string | null
  duration_ms: number | null
}

export type NowPlaying = {
  connected: boolean
  playing?: Track | null
  is_playing?: boolean
  progress_ms?: number | null
}

/** notes.spotify içinde duran damga — parçanın gösterilecek kadarı. */
export type NoteStamp = {
  track: string
  artist: string
  art: string | null
  url: string | null
}

/** plays tablosundan okunan satır. */
export type Play = {
  played_at: string
  track: string
  artist: string
  art: string | null
  url: string | null
}

export function toStamp(t: Track): NoteStamp {
  return { track: t.track, artist: t.artist, art: t.art, url: t.url }
}

export async function fetchNowPlaying(): Promise<NowPlaying> {
  if (!supabase) return { connected: false }

  const { data, error } = await supabase.functions.invoke('spotify-now')
  if (error || !data) return { connected: false }

  return data as NowPlaying
}

/**
 * Yetkilendirmeyi başlatır. Fonksiyon state'i yazıp adresi döner, tarayıcı
 * Spotify'a gider; dönüşte spotify-callback paneli `?spotify=ok` ile açar.
 */
export async function connectSpotify(): Promise<string | null> {
  if (!supabase) return 'Supabase yapılandırılmadı.'

  const { data, error } = await supabase.functions.invoke('spotify-connect')
  if (error || !data?.url) return 'Spotify bağlantısı başlatılamadı.'

  window.location.href = data.url as string
  return null
}
