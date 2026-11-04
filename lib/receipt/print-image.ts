/**
 * « Impression AirPrint » (Safari iPhone) à partir de l'IMAGE du ticket —
 * une page qui ne contient que l'image, à la largeur du papier (58/80 mm),
 * plutôt que le HTML (rendu imprévisible d'AirPrint). `false` si
 * l'impression n'a pas pu démarrer.
 */
export function printReceiptImage(dataUrl: string, widthMm: 58 | 80): boolean {
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:400px;height:600px;border:0'
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument
  const win = iframe.contentWindow
  if (!doc || !win) {
    iframe.remove()
    return false
  }
  doc.open()
  doc.write(
    `<!doctype html><html><head><style>@page{size:${widthMm}mm auto;margin:0}html,body{margin:0;padding:0}img{width:${widthMm}mm;display:block}</style></head><body><img alt="" src="${dataUrl}"></body></html>`
  )
  doc.close()
  const img = doc.querySelector('img')
  const go = () => {
    win.focus()
    win.print()
    setTimeout(() => iframe.remove(), 60_000)
  }
  if (img && !img.complete) img.onload = go
  else go()
  return true
}
