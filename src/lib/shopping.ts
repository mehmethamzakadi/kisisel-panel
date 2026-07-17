import { supabase } from './supabase'
import { shoppingChanged } from './bus'

/** "  2 adet   Domates " -> "2 adet Domates" */
export function normalize(item: string) {
  return item.trim().replace(/\s+/g, ' ')
}

const key = (item: string) => normalize(item).toLocaleLowerCase('tr')

/**
 * Listeye eklenecek malzemeleri süzer: hem gelen listenin kendi içindeki
 * tekrarları, hem de listede zaten duran (henüz alınmamış) ürünleri atar.
 *
 * "Alındı" işaretli ürünler engel sayılmaz — süt bitip tekrar alınacaksa
 * listeye yeniden girebilmeli.
 */
export function dedupe(incoming: string[], existingOpen: string[]): string[] {
  const seen = new Set(existingOpen.map(key))
  const out: string[] = []

  for (const raw of incoming) {
    const item = normalize(raw)
    if (!item) continue

    const k = key(item)
    if (seen.has(k)) continue

    seen.add(k)
    out.push(item)
  }

  return out
}

export type AddResult = { added: number; skipped: number }

/** Malzemeleri alışveriş listesine ekler; zaten olanları atlar. */
export async function addIngredients(ingredients: string[]): Promise<AddResult> {
  if (!supabase) return { added: 0, skipped: 0 }

  const { data: existing, error: readError } = await supabase
    .from('shopping_items')
    .select('body')
    .eq('checked', false)

  if (readError) throw new Error(readError.message)

  const fresh = dedupe(
    ingredients,
    (existing ?? []).map((r) => r.body),
  )

  const skipped = ingredients.filter((i) => normalize(i)).length - fresh.length

  if (fresh.length === 0) return { added: 0, skipped }

  const { error } = await supabase
    .from('shopping_items')
    .insert(fresh.map((body) => ({ body })))

  if (error) throw new Error(error.message)

  shoppingChanged()
  return { added: fresh.length, skipped }
}

export function describeResult({ added, skipped }: AddResult) {
  if (added === 0) return 'Hepsi zaten listede'
  if (skipped === 0) return `${added} malzeme eklendi`
  return `${added} eklendi, ${skipped} zaten listede`
}
