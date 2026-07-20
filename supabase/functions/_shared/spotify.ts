// Spotify OAuth ve API çağrıları için ortak yardımcılar.
//
// SPOTIFY_CLIENT_SECRET yalnızca burada, Supabase secret'ında durur; jeton
// takası ve tazeleme sunucu tarafında yapılır, tarayıcı hiçbir aşamada
// refresh_token görmez.

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

export const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize'
export const TOKEN_URL = 'https://accounts.spotify.com/api/token'

const API = 'https://api.spotify.com/v1'

// Yalnızca kullanılan izinler isteniyor. Playback kontrolü (odak seansı,
// hava durumuna göre çalma) eklenirse buraya user-modify-playback-state ve
// user-read-playback-state gelir ve yetki bir kez daha verilir.
export const SCOPES = [
  'user-read-currently-playing',
  'user-read-recently-played',
].join(' ')

export type Track = {
  id: string
  track: string
  artist: string
  album: string | null
  art: string | null
  url: string | null
  duration_ms: number | null
}

/** service_role istemcisi — RLS'i atlar, spotify_auth'a yalnızca bu erişir. */
export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
}

/** Çağrıyı yapan kullanıcıyı JWT'den çözer. verify_jwt açık fonksiyonlar için. */
export async function currentUser(req: Request): Promise<string | null> {
  const authorization = req.headers.get('Authorization')
  if (!authorization) return null

  const client = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authorization } } },
  )

  const { data } = await client.auth.getUser()
  return data.user?.id ?? null
}

export function clientCredentials() {
  const id = Deno.env.get('SPOTIFY_CLIENT_ID')
  const secret = Deno.env.get('SPOTIFY_CLIENT_SECRET')
  if (!id || !secret) {
    throw new Error('SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET tanımlı değil')
  }
  return { id, basic: `Basic ${btoa(`${id}:${secret}`)}` }
}

/** Callback adresi Spotify uygulamasında birebir kayıtlı olmalı. */
export function redirectUri() {
  return `${Deno.env.get('SUPABASE_URL')}/functions/v1/spotify-callback`
}

const LOCAL_PANEL = 'http://localhost:5173'

function panelUrl() {
  // Secret'a sondaki eğik çizgiyle yazılmış olabilir; Origin'de asla yoktur.
  return (Deno.env.get('PANEL_URL') ?? LOCAL_PANEL).replace(/\/+$/, '')
}

/**
 * Yetkilendirme sonrası dönülecek panel adresi.
 *
 * Origin isteği yapan tarayıcıdan geldiği için olduğu gibi kullanılamaz:
 * doğrulanmazsa callback'i istenen her adrese yönlendirmek mümkün olurdu
 * (açık yönlendirme). Bu yüzden yalnızca canlı panel ve localhost kabul
 * edilir, gerisi canlı panele düşer.
 */
export function returnTarget(origin: string | null): string {
  const allowed = [panelUrl(), LOCAL_PANEL]
  const clean = origin?.replace(/\/+$/, '') ?? ''
  return allowed.includes(clean) ? clean : panelUrl()
}

/**
 * Spotify parçasını panelin kullandığı sade biçime indirger.
 * Podcast bölümlerinde artists/album alanları yoktur; kart onları
 * gösteremeyeceği için atlanır.
 */
export function toTrack(item: unknown): Track | null {
  const t = item as Record<string, any> | null
  if (!t || t.type !== 'track' || !t.id) return null

  const images = t.album?.images ?? []

  return {
    id: t.id,
    track: t.name,
    artist: (t.artists ?? []).map((a: { name: string }) => a.name).join(', '),
    album: t.album?.name ?? null,
    // images en genişten dara sıralı gelir; kart için ortancası yeterli.
    art: images[1]?.url ?? images[0]?.url ?? null,
    url: t.external_urls?.spotify ?? null,
    duration_ms: t.duration_ms ?? null,
  }
}

/** Bağlantı yoksa fırlatılır; çağıran bunu "bağlı değil" olarak yorumlar. */
export const NOT_CONNECTED = 'spotify-not-connected'

/**
 * Geçerli erişim jetonu döner.
 *
 * Jeton bir saat yaşıyor ve spotify_auth satırında saklanıyor. Saklanmasaydı
 * 20 saniyede bir sorulan "şu an çalıyor" kartı yüzünden token endpoint'i
 * dakikada üç kez dövülürdü.
 */
export async function accessToken(
  admin: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data, error } = await admin
    .from('spotify_auth')
    .select('refresh_token, access_token, expires_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error(NOT_CONNECTED)

  // 60 saniye pay: istek yoldayken jeton ölmesin.
  const validUntil = data.expires_at ? new Date(data.expires_at).getTime() : 0
  if (data.access_token && validUntil - 60_000 > Date.now()) {
    return data.access_token
  }

  const { basic } = clientCredentials()
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: basic,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: data.refresh_token,
    }),
  })

  if (!res.ok) throw new Error(`Spotify token ${res.status}`)
  const json = await res.json()

  await admin
    .from('spotify_auth')
    .update({
      access_token: json.access_token,
      expires_at: new Date(Date.now() + json.expires_in * 1000).toISOString(),
      // Spotify zaman zaman yeni bir refresh_token döndürür ve eskisini
      // geçersizleştirir; yazılmazsa bağlantı sessizce kopar.
      ...(json.refresh_token ? { refresh_token: json.refresh_token } : {}),
    })
    .eq('user_id', userId)

  return json.access_token
}

/** Boş yanıt (204) null döner: "şu an hiçbir şey çalmıyor" demektir. */
export async function api(token: string, path: string) {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (res.status === 204) return null
  if (!res.ok) throw new Error(`Spotify ${path} ${res.status}`)
  return res.json()
}
