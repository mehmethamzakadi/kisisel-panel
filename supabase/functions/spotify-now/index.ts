// "Şu an ne çalıyor?" — panelin kartı ve nota şarkı damgası bunu kullanır.
//
// Yayına alma: supabase functions deploy spotify-now

import { cors } from '../_shared/cors.ts'
import {
  NOT_CONNECTED,
  accessToken,
  adminClient,
  api,
  currentUser,
  toTrack,
} from '../_shared/spotify.ts'

/** Yetki iptal edildiyse Spotify jetonu 4xx ile reddeder; bu da "bağlı değil". */
function isDisconnected(message: string) {
  return message.includes(NOT_CONNECTED) || /token 4\d\d/.test(message)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const userId = await currentUser(req)
  if (!userId) {
    return Response.json({ error: 'Giriş gerekli' }, { status: 401, headers: cors })
  }

  try {
    const token = await accessToken(adminClient(), userId)
    const json = await api(token, '/me/player/currently-playing')

    return Response.json(
      {
        connected: true,
        // toTrack podcast bölümlerinde null döner; kart o durumda boş görünür.
        playing: json ? toTrack(json.item) : null,
        is_playing: json?.is_playing ?? false,
      },
      { headers: cors },
    )
  } catch (e) {
    const message = String(e)
    if (isDisconnected(message)) {
      return Response.json({ connected: false }, { headers: cors })
    }
    return Response.json({ error: message }, { status: 502, headers: cors })
  }
})
