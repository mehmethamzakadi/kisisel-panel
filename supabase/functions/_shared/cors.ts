// supabase-js, isteklere authorization dışında apikey ve x-client-info
// başlıklarını da ekler. Bunlar allow-headers'da yoksa tarayıcı preflight'ta
// isteği bloklar ve fonksiyon hiç çağrılmaz.
export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
