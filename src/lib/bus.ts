// Kartlar birbirinden bağımsız veri çekiyor. Yemek kartı alışveriş listesine
// malzeme eklediğinde, alışveriş kartının bunu duyması için küçük bir olay
// kanalı; state'i yukarı taşımaktan daha ucuz.

const SHOPPING = 'panel:shopping-changed'

export function shoppingChanged() {
  window.dispatchEvent(new CustomEvent(SHOPPING))
}

export function onShoppingChange(handler: () => void) {
  window.addEventListener(SHOPPING, handler)
  return () => window.removeEventListener(SHOPPING, handler)
}

const WEATHER = 'panel:weather'

// Hava durumu WeatherCard'ın içinde yaşıyor; müzik kartı "havaya göre çal"
// için ona ihtiyaç duyuyor. Son değer burada tutuluyor çünkü kartların mount
// sırası garanti değil: müzik kartı sonra bağlanırsa olayı kaçırırdı.
export type WeatherNow = { code: number; temp: number }

let lastWeather: WeatherNow | null = null

export function weatherChanged(weather: WeatherNow) {
  lastWeather = weather
  window.dispatchEvent(new CustomEvent(WEATHER, { detail: weather }))
}

export function currentWeather() {
  return lastWeather
}

export function onWeatherChange(handler: (weather: WeatherNow) => void) {
  const listener = (e: Event) => handler((e as CustomEvent<WeatherNow>).detail)
  window.addEventListener(WEATHER, listener)
  return () => window.removeEventListener(WEATHER, listener)
}

const FOCUS = 'panel:focus-session'

// Odak seansı FocusCard'ın içinde yaşıyor ama panelin tamamını ilgilendiriyor:
// müzik kartı seansı tanımalı, dikkat dağıtan kartlar sessizleşmeli.
//
// Havada olduğu gibi son değer burada tutuluyor, ama sebebi bir adım daha
// ince: React çocuk efektlerini ebeveyninkinden önce çalıştırır, yani
// FocusCard yayını DashboardPage abone olmadan yapar. Dinleyen taraf mount
// olurken currentFocus() ile durumu yine de öğrenir.
export type FocusNow = { until: number; planned: number }

let lastFocus: FocusNow | null = null

export function focusChanged(focus: FocusNow | null) {
  lastFocus = focus
  window.dispatchEvent(new CustomEvent(FOCUS, { detail: focus }))
}

export function currentFocus() {
  return lastFocus
}

export function onFocusChange(handler: (focus: FocusNow | null) => void) {
  const listener = (e: Event) =>
    handler((e as CustomEvent<FocusNow | null>).detail)
  window.addEventListener(FOCUS, listener)
  return () => window.removeEventListener(FOCUS, listener)
}

const FOCUS_REQUEST = 'panel:focus-request'

// Komut paleti panelin her yerinden odak başlatabiliyor, ama seansı FocusCard
// yönetiyor — sayaç, kayıt ve müzik onun işi. Palet yalnızca istek bırakıyor.
//
// İstek burada bekletiliyor çünkü kullanıcı komutu /notlar'dayken vermiş
// olabilir: kart o an mount değil ve olayı kaçırırdı. Panele dönünce bekleyen
// isteği kendisi alıyor.
let pendingFocus: number | null = null

export function requestFocus(minutes: number) {
  pendingFocus = minutes
  window.dispatchEvent(new CustomEvent(FOCUS_REQUEST, { detail: minutes }))
}

/** İsteği okur ve tüketir; aynı istek iki kez seans başlatmasın. */
export function takeFocusRequest() {
  const minutes = pendingFocus
  pendingFocus = null
  return minutes
}

export function onFocusRequest(handler: (minutes: number) => void) {
  const listener = (e: Event) => handler((e as CustomEvent<number>).detail)
  window.addEventListener(FOCUS_REQUEST, listener)
  return () => window.removeEventListener(FOCUS_REQUEST, listener)
}

const PALETTE = 'panel:palette-open'

// Kısayolu bilmeyen ya da klavyesi olmayan kullanıcı için TopBar'daki düğme.
// Palet App seviyesinde, TopBar ise sayfanın içinde duruyor; state'i ikisinin
// ortak atasına taşımak yerine mevcut olay kanalı yeterli.
export function openPalette() {
  window.dispatchEvent(new CustomEvent(PALETTE))
}

export function onOpenPalette(handler: () => void) {
  window.addEventListener(PALETTE, handler)
  return () => window.removeEventListener(PALETTE, handler)
}
