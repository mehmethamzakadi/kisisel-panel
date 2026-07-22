// Panel ile edge fonksiyonları arasındaki veri sözleşmesi.
//
// Bu tipler önce üretici tarafta (refresh-snapshot, spotify-*), sonra bir daha
// tüketici tarafta (kartlar, src/lib) elle yazılıyordu. İki kopya arasında
// hiçbir bağ yoktu: üretici bir alanı yeniden adlandırdığında derleyici susuyor,
// hata ancak çalışma anında boş kart olarak görünüyordu. Sözleşme artık tek
// yerde; iki taraf da buradan `import type` ile okur.
//
// Dosya _shared/ altında çünkü `supabase functions deploy` yalnızca
// supabase/functions/ ağacını yükler — sözleşme üreticinin yanında durmalı.
//
// YALNIZCA TİP içerir; sabit ya da fonksiyon eklemeyin. Tarayıcı tarafı bu
// dosyayı yalnızca `import type` ile okur ve derlemede tamamen silinir, yani
// buraya konan bir çalışma zamanı değerini Vite çözemez.

/** TCMB kurları — refresh-snapshot üretir, RatesCard tüketir. */
export type Rate = {
  code: string
  name: string
  buying: number
  selling: number
}

/** Truncgil altın/gümüş — refresh-snapshot üretir, GoldCard tüketir. */
export type Gold = {
  code: string
  label: string
  selling: number
  change: number
}

/** RSS başlıkları — refresh-snapshot üretir, NewsCard tüketir. */
export type Headline = {
  source: string
  title: string
  link: string
  date: string | null
}

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

/** spotify-play'in listelediği çalma hedefi. */
export type Device = {
  id: string
  name: string
  type: string
  is_active: boolean
}
