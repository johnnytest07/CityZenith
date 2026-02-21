import { PathLayer, ScatterplotLayer } from '@deck.gl/layers'
import type { Layer } from '@deck.gl/core'

/**
 * Creates deck.gl layers for the in-progress polygon drawing tool.
 *
 * - PathLayer connecting existing nodes
 * - Faint dashed closing preview from last node → first node (when ≥3 nodes)
 * - Ghost preview line from last node → live cursor position
 * - ScatterplotLayer for node dots (regular nodes: violet, first node: yellow when closeable)
 */
export function createDrawingLayers(
  nodes: [number, number][],
  cursorPosition: [number, number] | null,
  isCloseable: boolean,
): Layer[] {
  if (nodes.length === 0) return []

  const layers: Layer[] = []

  // Drawn edges between existing nodes
  if (nodes.length >= 2) {
    layers.push(
      new PathLayer<[number, number][]>({
        id: 'drawing-path',
        data: [nodes],
        getPath: (d: [number, number][]) => d,
        getColor: [167, 139, 250, 220], // violet-400
        getWidth: 2,
        widthUnits: 'pixels',
        pickable: false,
      }),
    )
  }

  // Faint closing preview (last node → first node, shown when ≥3 nodes)
  if (nodes.length >= 3) {
    layers.push(
      new PathLayer<[number, number][]>({
        id: 'drawing-close-preview',
        data: [[nodes[nodes.length - 1], nodes[0]]],
        getPath: (d: [number, number][]) => d,
        getColor: [167, 139, 250, 60],
        getWidth: 1.5,
        widthUnits: 'pixels',
        pickable: false,
      }),
    )
  }

  // Ghost line from last node to cursor
  if (cursorPosition !== null && nodes.length >= 1) {
    layers.push(
      new PathLayer<[number, number][]>({
        id: 'drawing-cursor-preview',
        data: [[nodes[nodes.length - 1], cursorPosition]],
        getPath: (d: [number, number][]) => d,
        getColor: [167, 139, 250, 100],
        getWidth: 1.5,
        widthUnits: 'pixels',
        pickable: false,
      }),
    )
  }

  // Regular node dots (all except first when closeable, to keep first node visually distinct)
  const dotNodes = isCloseable ? nodes.slice(1) : nodes
  if (dotNodes.length > 0) {
    layers.push(
      new ScatterplotLayer<[number, number]>({
        id: 'drawing-nodes',
        data: dotNodes,
        getPosition: (d: [number, number]) => d,
        getRadius: 5,
        getFillColor: [139, 92, 246, 255], // violet-500
        radiusUnits: 'pixels',
        pickable: false,
      }),
    )
  }

  // First node — larger and yellow when polygon can be closed
  layers.push(
    new ScatterplotLayer<[number, number]>({
      id: 'drawing-first-node',
      data: [nodes[0]],
      getPosition: (d: [number, number]) => d,
      getRadius: isCloseable ? 9 : 5,
      getFillColor: isCloseable ? [250, 204, 21, 255] : [139, 92, 246, 255],
      radiusUnits: 'pixels',
      pickable: false,
    }),
  )

  return layers
}
