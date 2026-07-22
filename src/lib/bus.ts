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
