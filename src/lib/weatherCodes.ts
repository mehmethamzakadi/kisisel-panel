/** WMO hava durumu kodları — Open-Meteo bunları döndürür. */
const codes: Record<number, { label: string; icon: string }> = {
  0: { label: 'Açık', icon: '☀️' },
  1: { label: 'Az bulutlu', icon: '🌤️' },
  2: { label: 'Parçalı bulutlu', icon: '⛅' },
  3: { label: 'Çok bulutlu', icon: '☁️' },
  45: { label: 'Sisli', icon: '🌫️' },
  48: { label: 'Kırağılı sis', icon: '🌫️' },
  51: { label: 'Hafif çisenti', icon: '🌦️' },
  53: { label: 'Çisenti', icon: '🌦️' },
  55: { label: 'Yoğun çisenti', icon: '🌦️' },
  56: { label: 'Dondurucu çisenti', icon: '🌧️' },
  57: { label: 'Yoğun dondurucu çisenti', icon: '🌧️' },
  61: { label: 'Hafif yağmurlu', icon: '🌦️' },
  63: { label: 'Yağmurlu', icon: '🌧️' },
  65: { label: 'Kuvvetli yağmurlu', icon: '🌧️' },
  66: { label: 'Dondurucu yağmur', icon: '🌧️' },
  67: { label: 'Kuvvetli dondurucu yağmur', icon: '🌧️' },
  71: { label: 'Hafif kar', icon: '🌨️' },
  73: { label: 'Kar yağışlı', icon: '🌨️' },
  75: { label: 'Yoğun kar', icon: '❄️' },
  77: { label: 'Kar taneleri', icon: '❄️' },
  80: { label: 'Hafif sağanak', icon: '🌦️' },
  81: { label: 'Sağanak', icon: '🌧️' },
  82: { label: 'Şiddetli sağanak', icon: '⛈️' },
  85: { label: 'Kar sağanağı', icon: '🌨️' },
  86: { label: 'Yoğun kar sağanağı', icon: '❄️' },
  95: { label: 'Gök gürültülü fırtına', icon: '⛈️' },
  96: { label: 'Dolulu fırtına', icon: '⛈️' },
  99: { label: 'Şiddetli dolulu fırtına', icon: '⛈️' },
}

export function describeWeather(code: number) {
  return codes[code] ?? { label: 'Bilinmiyor', icon: '❓' }
}
