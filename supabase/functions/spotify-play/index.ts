// Çalma kontrolü: cihaz listesi, aramaya göre çalma listesi başlatma, duraklatma.
//
// Panelin "havaya göre çal", "sabah rutini" ve "odak seansı" düğmeleri buraya
// bağlanır. Arama sunucuda yapılır; böylece panelin Spotify jetonuna ihtiyacı
// olmaz ve arama sözcükleri tek yerde kalır.
//
// Yayına alma: supabase functions deploy spotify-play

import { cors } from '../_shared/cors.ts'
import {
  NOT_CONNECTED,
  accessToken,
  adminClient,
  api,
  apiWrite,
  currentUser,
} from '../_shared/spotify.ts'
import type { Device } from '../_shared/wire.ts'

async function devices(token: string): Promise<Device[]> {
  const json = await api(token, '/me/player/devices')

  return (json?.devices ?? [])
    .filter((d: Record<string, unknown>) => d?.id)
    .map((d: Record<string, any>) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      is_active: Boolean(d.is_active),
    }))
}

/**
 * Aramaya uyan çalma listelerinden birini seçer.
 *
 * İlk sonuç sabit alınırsa aynı sorgu hep aynı listeyi, o da hep aynı ilk
 * şarkıyı getirir; düğme "ruh hali" değil kısayol olur. Bu yüzden sonuçlar
 * arasından rastgele seçiliyor.
 *
 * Spotify'ın playlist aramasında items dizisi zaman zaman null öğe içeriyor;
 * filtrelenmezse seçim null'a düşüp çalma sessizce başarısız olur.
 * limit Şubat 2026'dan beri en fazla 10.
 */
async function findPlaylist(token: string, query: string) {
  const path = `/search?q=${encodeURIComponent(query)}&type=playlist&limit=10`
  const json = await api(token, path)

  const items = (json?.playlists?.items ?? []).filter(
    (p: Record<string, unknown> | null) => p?.uri,
  )

  if (items.length === 0) return null

  const pick = items[Math.floor(Math.random() * items.length)]

  return {
    uri: pick.uri as string,
    name: pick.name as string,
    url: pick.external_urls?.spotify ?? null,
  }
}

/**
 * Çalmanın hedefleyeceği cihazı belirler.
 *
 * Cihaz önceden çözülüyor çünkü karıştırma komutu da bir cihaz istiyor;
 * "aktif cihaza gönder" varsayımıyla ilerlersek karıştırma sessizce
 * hedefsiz kalabilir. Tek cihaz varsa aktif olmasa da o seçilir.
 */
async function resolveDevice(
  token: string,
  preferred?: string,
): Promise<{ id: string | null; list: Device[] }> {
  if (preferred) return { id: preferred, list: [] }

  const list = await devices(token)
  const active = list.find((d) => d.is_active)

  if (active) return { id: active.id, list }
  if (list.length === 1) return { id: list[0].id, list }

  return { id: null, list }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const userId = await currentUser(req)
  if (!userId) {
    return Response.json({ error: 'Giriş gerekli' }, { status: 401, headers: cors })
  }

  let body: { action?: string; query?: string; device_id?: string } = {}
  try {
    body = await req.json()
  } catch {
    // gövdesiz çağrı "devices" sayılır
  }

  try {
    const token = await accessToken(adminClient(), userId)

    if (body.action === 'pause') {
      const res = await apiWrite(token, '/me/player/pause')
      // 403: zaten duraklatılmış olabilir, hata sayılmaz.
      if (res.ok || res.status === 403) {
        return Response.json({ ok: true }, { headers: cors })
      }
      if (res.status === 401) {
        return Response.json({ error: 'scope-missing' }, { headers: cors })
      }
      return Response.json(
        { error: 'failed', detail: `Spotify ${res.status}` },
        { headers: cors },
      )
    }

    if (body.action === 'play') {
      const query = (body.query ?? '').trim()
      if (!query) {
        return Response.json({ error: 'query gerekli' }, { status: 400, headers: cors })
      }

      const playlist = await findPlaylist(token, query)
      if (!playlist) {
        // 200: hata gövdesi panele ulaşsın diye (bkz. aşağıdaki catch notu).
        return Response.json({ error: 'no-playlist', query }, { headers: cors })
      }

      const device = await resolveDevice(token, body.device_id)

      // Açık istemci yok. Panel cihaz seçtirebilsin diye liste de döner.
      if (!device.id) {
        return Response.json(
          { error: 'no-device', devices: device.list, playlist },
          { headers: cors },
        )
      }

      const target = `?device_id=${device.id}`

      // Karıştırma çalmadan ÖNCE açılıyor: sonra açılsa liste çoktan
      // 1. parçadan başlamış olurdu. Başarısız olursa çalma yine sürer.
      await apiWrite(token, `/me/player/shuffle?state=true&device_id=${device.id}`)

      const res = await apiWrite(token, `/me/player/play${target}`, {
        context_uri: playlist.uri,
      })

      if (res.ok) return Response.json({ ok: true, playlist }, { headers: cors })

      // 404: cihaz çözüldükten sonra kapanmış olabilir.
      if (res.status === 404) {
        return Response.json(
          { error: 'no-device', devices: device.list, playlist },
          { headers: cors },
        )
      }

      // 401: jeton geçerli — arama az önce aynı jetonla çalıştı — ama player
      // uçları için izin yok. Spotify burada 403 değil 401 döndürüyor.
      if (res.status === 401) {
        return Response.json({ error: 'scope-missing' }, { headers: cors })
      }

      // 403: hesap Premium değil — çalma kontrolü Premium'a kapalı.
      if (res.status === 403) {
        return Response.json({ error: 'premium-required' }, { headers: cors })
      }

      return Response.json(
        { error: 'failed', detail: `Spotify ${res.status}` },
        { headers: cors },
      )
    }

    return Response.json({ devices: await devices(token) }, { headers: cors })
  } catch (e) {
    const message = String(e)

    // Sunucu günlüğünde tam metin dursun; panelde kısaltılmış hali gösterilir.
    console.error('spotify-play', message)

    if (message.includes(NOT_CONNECTED)) {
      return Response.json({ error: 'not-connected' }, { headers: cors })
    }
    // 403: yeni izinler için yeniden yetki verilmemiş olabilir.
    if (message.includes('403')) {
      return Response.json({ error: 'scope-missing' }, { headers: cors })
    }

    // Bilinmeyen hatalar da 200 döner: 502 dönseydi supabase-js yanıtı hata
    // sayar, gövdeyi atar ve sebep panele hiç ulaşmazdı.
    return Response.json({ error: 'failed', detail: message }, { headers: cors })
  }
})
