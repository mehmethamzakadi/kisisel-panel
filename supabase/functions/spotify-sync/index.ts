// Son çalınanları plays tablosuna boşaltır. refresh-snapshot gibi cron'dan
// çağrılır ve JWT doğrulaması kapalı yayınlanır.
//
// Spotify yalnızca son 50 şarkıyı verir. Cron 15 dakikada bir bu pencereyi
// arşive yazdığı için zamanla Spotify'ın kendisinde bulunmayan bir dinleme
// geçmişi birikir — kartların ve /muzik sayfasının asıl beslendiği yer burası.
//
// Yayına alma: supabase functions deploy spotify-sync --no-verify-jwt

import {
  accessToken,
  adminClient,
  api,
  toTrack,
} from '../_shared/spotify.ts'

Deno.serve(async () => {
  const admin = adminClient()

  const { data: accounts, error } = await admin
    .from('spotify_auth')
    .select('user_id')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!accounts?.length) return Response.json({ synced: 0, note: 'bağlı hesap yok' })

  const report: Record<string, string | number> = {}

  for (const { user_id } of accounts) {
    try {
      const token = await accessToken(admin, user_id)

      // Arşivdeki en son çalma imleç olarak kullanılır; her seferinde 50
      // kaydın tamamını yazmak yerine yalnızca yenileri istenir.
      const { data: latest } = await admin
        .from('plays')
        .select('played_at')
        .eq('user_id', user_id)
        .order('played_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const after = latest
        ? `&after=${new Date(latest.played_at).getTime()}`
        : ''

      const json = await api(
        token,
        `/me/player/recently-played?limit=50${after}`,
      )

      const rows = (json?.items ?? []).flatMap((item: Record<string, any>) => {
        const t = toTrack(item.track)
        if (!t || !item.played_at) return []
        return [{
          user_id,
          played_at: item.played_at,
          track_id: t.id,
          track: t.track,
          artist: t.artist,
          album: t.album,
          art: t.art,
          url: t.url,
          duration_ms: t.duration_ms,
        }]
      })

      if (rows.length === 0) {
        report[user_id] = 0
        continue
      }

      const { error: writeError } = await admin
        .from('plays')
        .upsert(rows, { onConflict: 'user_id,played_at', ignoreDuplicates: true })

      report[user_id] = writeError ? writeError.message : rows.length
    } catch (e) {
      report[user_id] = String(e)
    }
  }

  return Response.json({ synced: accounts.length, detail: report })
})
