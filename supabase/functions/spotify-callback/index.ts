// Spotify'ın yetkilendirme sonrası yönlendirdiği adres. Kodu refresh_token
// ile takas eder ve paneli geri açar.
//
// Bu fonksiyon JWT doğrulaması KAPALI yayınlanır — tarayıcı buraya Spotify'ın
// yönlendirmesiyle, hiçbir Authorization başlığı olmadan gelir. Güvenlik
// sınırı state parametresidir: spotify-connect'in yazdığı satırla eşleşmeyen
// istek reddedilir ve state tek kullanımlıktır.
//
// Yayına alma: supabase functions deploy spotify-callback --no-verify-jwt

import {
  TOKEN_URL,
  adminClient,
  clientCredentials,
  redirectUri,
  returnTarget,
} from '../_shared/spotify.ts'

/**
 * Panele dönerken sonucu adres çubuğunda taşır; panel bunu okuyup temizler.
 * Hedef, akışın başladığı panel: state satırı okunamadan önceki hatalarda
 * bilinmediği için canlı panele düşülür.
 */
function backToPanel(result: string, target?: string | null) {
  const panel = target ?? returnTarget(null)
  return new Response(null, {
    status: 302,
    headers: { Location: `${panel}/?spotify=${result}` },
  })
}

Deno.serve(async (req) => {
  const params = new URL(req.url).searchParams

  // Kullanıcı izni reddettiyse Spotify code yerine error döner.
  if (params.get('error')) return backToPanel('iptal')

  const code = params.get('code')
  const state = params.get('state')
  if (!code || !state) return backToPanel('hata')

  const admin = adminClient()

  // State tek kullanımlık: okunduğu anda silinir, tekrar oynatılamaz.
  const { data: row } = await admin
    .from('spotify_oauth_state')
    .delete()
    .eq('state', state)
    .select('user_id, return_to')
    .maybeSingle()

  if (!row) return backToPanel('hata')

  // Buradan sonraki her dönüş, akışın başladığı panele gider.
  const target = returnTarget(row.return_to)

  let basic: string
  try {
    basic = clientCredentials().basic
  } catch {
    return backToPanel('hata', target)
  }

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: basic,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
    }),
  })

  if (!res.ok) return backToPanel('hata', target)
  const json = await res.json()
  if (!json.refresh_token) return backToPanel('hata', target)

  const { error } = await admin.from('spotify_auth').upsert(
    {
      user_id: row.user_id,
      refresh_token: json.refresh_token,
      access_token: json.access_token,
      expires_at: new Date(Date.now() + json.expires_in * 1000).toISOString(),
      connected_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )

  return backToPanel(error ? 'hata' : 'ok', target)
})
