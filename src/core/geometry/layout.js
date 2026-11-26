/**
 * Dónde va cada cosa en la rejilla, en proporción a la pantalla.
 *
 * No hay cámara con perspectiva: es una vista 2,5D. Un punto del árbol en
 * (radio r, ángulo φ, altura f) cae en
 *   col = cx + r·sin φ
 *   row = yBase − f·treeRows + z·tilt      con z = r·cos φ (z > 0: hacia el espectador)
 * El pequeño `tilt` inclina los anillos (se ve el árbol un poco desde arriba)
 * sin que la parte baja tape el tronco.
 */
export function stageLayout({ cols, rows, aspect, panelCols }) {
  const yTop = rows * 0.273; // punta del árbol
  const yBase = rows * 0.698; // base del follaje
  return {
    cols,
    rows,
    aspect,
    panelCols,
    cx: cols / 2,
    rMax: panelCols * 0.32, // radio del piso más ancho, en columnas
    yTop,
    yBase,
    treeRows: yBase - yTop,
    floorRow: rows * 0.845, // centro del mandala del suelo
    tilt: 0.17 * aspect,
    floorTilt: 0.28 * aspect, // cuánto se aplasta el suelo (mandala y regalos)
  };
}
