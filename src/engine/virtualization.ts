export interface VirtualScrollInfo {
  startIndex: number;
  endIndex: number;
  totalHeight: number;
  offsetY: number;
  visibleCount: number;
}

/**
 * Calculates virtualized scroll viewport coordinates.
 * Allows rendering only 30-40 elements of a 50,000+ element dataset.
 */
export const getVirtualScrollInfo = (
  scrollTop: number,
  viewportHeight: number,
  totalItems: number,
  rowHeight: number,
  buffer = 10
): VirtualScrollInfo => {
  const totalHeight = totalItems * rowHeight;
  
  if (totalItems === 0 || viewportHeight <= 0) {
    return {
      startIndex: 0,
      endIndex: 0,
      totalHeight: 0,
      offsetY: 0,
      visibleCount: 0
    };
  }

  // Calculate active visible bounds
  const visibleStartIndex = Math.floor(scrollTop / rowHeight);
  const visibleCount = Math.ceil(viewportHeight / rowHeight);
  
  // Apply buffer padding to prevent blank rows on rapid scroll
  const startIndex = Math.max(0, visibleStartIndex - buffer);
  const endIndex = Math.min(totalItems - 1, visibleStartIndex + visibleCount + buffer);
  
  // Compute absolute CSS translateY offset for the virtual rows container
  const offsetY = startIndex * rowHeight;

  return {
    startIndex,
    endIndex,
    totalHeight,
    offsetY,
    visibleCount
  };
};
