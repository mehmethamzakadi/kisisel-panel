// Spotify yetkilendirmesini başlatır: panelin yönlendireceği authorize
// adresini üretir ve state'i veritabanına yazar.
//
// Yayına alma: supabase functions deploy spotify-connect

import { cors } from '../_shared/cors.ts'
import {
  AUTHORIZE_URL,
  SCOPES,
  adminClient,
  clientCredentials,
  currentUser,
  redirectUri,
  returnTarget,
} from '../_shared/spotify.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const userId = await currentUser(req)
  if (!userId) {
    return Response.json({ error: 'Giriş gerekli' }, { status: 401, headers: cors })
  }

  let id: string
  try {
    id = clientCredentials().id
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500, headers: cors })
  }

  const admin = adminClient()
  const state = crypto.randomUUID()

  // Yarım kalmış denemeler tabloda birikmesin.
  await admin
    .from('spotify_oauth_state')
    .delete()
    .lt('created_at', new Date(Date.now() - 10 * 60_000).toISOString())

  // Akış localhost'tan da başlayabilir; callback nereye döneceğini buradan
  // öğrenir, çünkü Spotify'ın yönlendirmesinde bu bilgi yoktur.
  const { error } = await admin.from('spotify_oauth_state').insert({
    state,
    user_id: userId,
    return_to: returnTarget(req.headers.get('Origin')),
  })

  if (error) {
    return Response.json({ error: error.message }, { status: 500, headers: cors })
  }

  const url = new URL(AUTHORIZE_URL)
  url.search = new URLSearchParams({
    client_id: id,
    response_type: 'code',
    redirect_uri: redirectUri(),
    scope: SCOPES,
    state,
  }).toString()

  return Response.json({ url: url.toString() }, { headers: cors })
})
