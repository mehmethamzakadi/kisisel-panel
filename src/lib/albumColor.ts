// Albüm kapağından panel vurgu rengi üretir.
//
// Tailwind v4'te @theme değişkenleri :root üzerinde CSS değişkeni olarak
// duruyor; çalışma anında üzerlerine yazmak tüm bg-accent/text-accent
// kullanımlarını birden değiştiriyor. Ayrı bir tema katmanına gerek yok.

export type Accent = { accent: string; soft: string }

const ACCENT_VAR = '--color-accent'
const SOFT_VAR = '--color-accent-soft'

function rgbToHsl(r: number, g: number, b: number) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2

  if (max === min) return { h: 0, s: 0, l }

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

  let h: number
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6

  return { h, s, l }
}

/**
 * Kapağın baskın rengini çıkarır.
 *
 * Basit ortalama gri veriyor — kapaklarda koyu ve açık alanlar birbirini
 * götürüyor. Bu yüzden pikseller doygunluklarıyla ağırlıklandırılıyor:
 * renkli bölgeler baskın çıkıyor, gri arka plan neredeyse hiç sayılmıyor.
 * Renk açısı ortalaması da açı olarak alınıyor; 350° ile 10° arasındaki
 * ortalama düz alındığında 180° (tam ters renk) çıkardı.
 */
function extract(data: Uint8ClampedArray): Accent | null {
  let x = 0
  let y = 0
  let weightSum = 0

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue

    const { h, s, l } = rgbToHsl(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255)

    // Çok koyu ve çok açık pikseller renk taşımıyor, dışarıda bırakılır.
    if (l < 0.1 || l > 0.92) continue

    const weight = s * s
    const angle = h * 2 * Math.PI

    x += Math.cos(angle) * weight
    y += Math.sin(angle) * weight
    weightSum += weight
  }

  // Kapak tamamen gri tonlardaysa uydurma bir renk üretmek yanlış olur.
  if (weightSum < 0.5) return null

  const hue = Math.round(((Math.atan2(y, x) / (2 * Math.PI)) * 360 + 360) % 360)

  // Doygunluk ve açıklık sabitleniyor: kapaktan gelen değer okunabilirliği
  // bozabilir (fosforlu sarı vurgu, beyaz metinle görünmez olurdu).
  return {
    accent: `hsl(${hue} 62% 45%)`,
    soft: `hsl(${hue} 70% 96%)`,
  }
}

/** Kapak URL'inden vurgu rengi; çıkarılamazsa null. */
export function albumAccent(url: string): Promise<Accent | null> {
  return new Promise((resolve) => {
    const image = new Image()
    // Spotify CDN'i CORS'a izin veriyor; olmasaydı canvas "tainted" olur ve
    // getImageData güvenlik hatası fırlatırdı.
    image.crossOrigin = 'anonymous'

    image.onload = () => {
      try {
        // 16x16 yeterli: tek tek pikseller değil genel renk dağılımı aranıyor.
        const size = 16
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size

        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return resolve(null)

        ctx.drawImage(image, 0, 0, size, size)
        resolve(extract(ctx.getImageData(0, 0, size, size).data))
      } catch {
        resolve(null)
      }
    }

    image.onerror = () => resolve(null)
    image.src = url
  })
}

/** Vurgu rengini uygular; null verilirse temanın varsayılanına döner. */
export function applyAccent(accent: Accent | null) {
  const root = document.documentElement

  if (!accent) {
    root.style.removeProperty(ACCENT_VAR)
    root.style.removeProperty(SOFT_VAR)
    return
  }

  root.style.setProperty(ACCENT_VAR, accent.accent)
  root.style.setProperty(SOFT_VAR, accent.soft)
}
