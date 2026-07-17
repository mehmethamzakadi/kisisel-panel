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
