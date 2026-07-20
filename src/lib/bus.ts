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
