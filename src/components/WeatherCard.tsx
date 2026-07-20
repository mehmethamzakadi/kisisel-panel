import { useEffect, useState } from 'react'
import { Card } from './Card'
import { describeWeather } from '../lib/weatherCodes'
import { weatherChanged } from '../lib/bus'

export const CITIES = [
  { name: 'İstanbul', lat: 41.0082, lon: 28.9784 },
  { name: 'Ankara', lat: 39.9334, lon: 32.8597 },
  { name: 'İzmir', lat: 38.4237, lon: 27.1428 },
  { name: 'Bursa', lat: 40.1885, lon: 29.061 },
  { name: 'Antalya', lat: 36.8969, lon: 30.7133 },
  { name: 'Trabzon', lat: 41.0027, lon: 39.7168 },
]

const AUTO = 'auto'

type Place = { lat: number; lon: number; label: string }

type Weather = {
  current: {
    temperature_2m: number
    apparent_temperature: number
    relative_humidity_2m: number
    wind_speed_10m: number
    weather_code: number
  }
  daily: {
    time: string[]
    weather_code: number[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
  }
}

const dayFormat = new Intl.DateTimeFormat('tr-TR', { weekday: 'short' })

/** Koordinattan şehir adı — anahtarsız ve ücretsiz. */
async function resolveName(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=tr`,
    )
    if (!res.ok) return 'Konumum'
    const json = await res.json()
    return json.city || json.locality || json.principalSubdivision || 'Konumum'
  } catch {
    return 'Konumum'
  }
}

export function WeatherCard() {
  const [choice, setChoice] = useState(
    () => localStorage.getItem('panel:city') ?? AUTO,
  )
  const [located, setLocated] = useState<Place | null>(null)
  const [geoFailed, setGeoFailed] = useState(false)
  const [data, setData] = useState<Weather | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Konum izni iste; reddedilir ya da alınamazsa İstanbul'a düş.
  useEffect(() => {
    if (choice !== AUTO || located) return

    if (!navigator.geolocation) {
      setGeoFailed(true)
      return
    }

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const label = await resolveName(coords.latitude, coords.longitude)
        setLocated({ lat: coords.latitude, lon: coords.longitude, label })
      },
      () => setGeoFailed(true),
      { timeout: 8000, maximumAge: 600_000 },
    )
  }, [choice, located])

  const place: Place | null =
    choice === AUTO
      ? located ?? (geoFailed ? { ...CITIES[0], label: CITIES[0].name } : null)
      : (() => {
          const city = CITIES.find((c) => c.name === choice) ?? CITIES[0]
          return { lat: city.lat, lon: city.lon, label: city.name }
        })()

  useEffect(() => {
    if (!place) return

    const controller = new AbortController()
    setData(null)
    setError(null)

    const url = new URL('https://api.open-meteo.com/v1/forecast')
    url.searchParams.set('latitude', String(place.lat))
    url.searchParams.set('longitude', String(place.lon))
    url.searchParams.set(
      'current',
      'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code',
    )
    url.searchParams.set(
      'daily',
      'weather_code,temperature_2m_max,temperature_2m_min',
    )
    url.searchParams.set('timezone', 'auto')
    url.searchParams.set('forecast_days', '4')

    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Open-Meteo ${res.status}`)
        return res.json()
      })
      .then(setData)
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Hava durumu alınamadı.')
      })

    return () => controller.abort()
  }, [place?.lat, place?.lon])

  // Müzik kartı "havaya göre çal" için hava kodunu buradan duyar.
  useEffect(() => {
    if (data) {
      weatherChanged({
        code: data.current.weather_code,
        temp: Math.round(data.current.temperature_2m),
      })
    }
  }, [data])

  const now = data && describeWeather(data.current.weather_code)

  return (
    <Card
      title="Hava Durumu"
      icon="🌤️"
      loading={!data && !error}
      error={error}
      meta={place?.label}
    >
      {data && now && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <span className="text-5xl leading-none" aria-hidden>
              {now.icon}
            </span>
            <div>
              <p className="text-4xl font-semibold tabular-nums">
                {Math.round(data.current.temperature_2m)}°
              </p>
              <p className="text-sm text-muted">{now.label}</p>
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-panel py-2">
              <dt className="text-muted">Hissedilen</dt>
              <dd className="tabular-nums">
                {Math.round(data.current.apparent_temperature)}°
              </dd>
            </div>
            <div className="rounded-lg bg-panel py-2">
              <dt className="text-muted">Nem</dt>
              <dd className="tabular-nums">
                %{data.current.relative_humidity_2m}
              </dd>
            </div>
            <div className="rounded-lg bg-panel py-2">
              <dt className="text-muted">Rüzgâr</dt>
              <dd className="tabular-nums">
                {Math.round(data.current.wind_speed_10m)} km/s
              </dd>
            </div>
          </dl>

          <ul className="flex justify-between gap-2 border-t border-edge pt-3">
            {data.daily.time.slice(1).map((day, i) => {
              const forecast = describeWeather(data.daily.weather_code[i + 1])
              return (
                <li key={day} className="flex-1 text-center">
                  <p className="text-xs text-muted capitalize">
                    {dayFormat.format(new Date(day))}
                  </p>
                  <p className="my-1 text-xl" aria-hidden>
                    {forecast.icon}
                  </p>
                  <p className="text-xs tabular-nums">
                    <span>{Math.round(data.daily.temperature_2m_max[i + 1])}°</span>
                    <span className="text-muted">
                      {' '}
                      {Math.round(data.daily.temperature_2m_min[i + 1])}°
                    </span>
                  </p>
                </li>
              )
            })}
          </ul>

          <label className="mt-1 flex items-center justify-between gap-2 text-xs text-muted">
            {choice === AUTO && geoFailed ? 'Konum alınamadı' : 'Şehir'}
            <select
              value={choice}
              onChange={(e) => {
                const next = e.target.value
                setChoice(next)
                setGeoFailed(false)
                if (next === AUTO) localStorage.removeItem('panel:city')
                else localStorage.setItem('panel:city', next)
              }}
              className="rounded-lg border border-edge bg-card px-2 py-1 text-ink"
            >
              <option value={AUTO}>Konumum</option>
              {CITIES.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </Card>
  )
}
