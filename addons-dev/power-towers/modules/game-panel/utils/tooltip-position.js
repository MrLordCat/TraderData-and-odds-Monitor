/**
 * Power Towers TD - Tooltip Position Utilities
 * Centralized tooltip positioning logic
 */

/**
 * Calculate tooltip position near a world object
 * @param {Object} options - Position options
 * @param {Object} options.camera - Camera instance with worldToScreen method
 * @param {number} options.worldX - World X coordinate
 * @param {number} options.worldY - World Y coordinate
 * @param {number} options.tooltipWidth - Tooltip width in pixels
 * @param {number} options.tooltipHeight - Tooltip height in pixels
 * @param {number} options.containerWidth - Container width in pixels
 * @param {number} options.containerHeight - Container height in pixels
 * @param {number} options.gridSize - Grid cell size (default 32)
 * @param {number} options.padding - Edge padding (default 10)
 * @param {string} options.preferredSide - Preferred side: 'above', 'below', 'left', 'right' (default 'above')
 * @returns {{ left: number, top: number }} Position in pixels
 */
function calculateTooltipPosition(options) {
  const {
    camera,
    worldX,
    worldY,
    tooltipWidth = 200,
    tooltipHeight = 300,
    containerWidth,
    containerHeight,
    gridSize = 32,
    padding = 10,
    preferredSide = 'above'
  } = options;
  
  // Convert world to screen coordinates
  const screenPos = camera.worldToScreen(worldX, worldY);
  
  let left, top;
  const gap = 20; // Gap between object and tooltip
  
  // Initial position based on preferred side
  switch (preferredSide) {
    case 'above':
      left = screenPos.x - tooltipWidth / 2;
      top = screenPos.y - tooltipHeight - gap;
      break;
    case 'below':
      left = screenPos.x - tooltipWidth / 2;
      top = screenPos.y + gridSize * (camera.scale || 1) + gap;
      break;
    case 'left':
      left = screenPos.x - tooltipWidth - gap;
      top = screenPos.y - tooltipHeight / 2;
      break;
    case 'right':
    default:
      left = screenPos.x + gap;
      top = screenPos.y - tooltipHeight / 2;
      break;
  }
  
  // Clamp to container bounds
  // Horizontal
  if (left < padding) {
    left = padding;
  }
  if (left + tooltipWidth > containerWidth - padding) {
    left = containerWidth - tooltipWidth - padding;
  }
  
  // Vertical - flip if doesn't fit on preferred side
  if (preferredSide === 'above' && top < padding) {
    // Flip to below
    top = screenPos.y + gridSize * (camera.scale || 1) + gap / 2;
  } else if (preferredSide === 'below' && top + tooltipHeight > containerHeight - padding) {
    // Flip to above
    top = screenPos.y - tooltipHeight - gap / 2;
  }
  
  // Final vertical clamp
  if (top < padding) {
    top = padding;
  }
  if (top + tooltipHeight > containerHeight - padding) {
    top = containerHeight - tooltipHeight - padding;
  }
  
  return { left, top };
}

/**
 * Position tooltip for a tower
 * @param {Object} options - Options
 * @param {HTMLElement} options.tooltip - Tooltip element
 * @param {Object} options.tower - Tower instance with gridX, gridY
 * @param {Object} options.camera - Camera instance
 * @param {HTMLElement} options.canvas - Canvas element
 * @param {number} options.gridSize - Grid size
 */
function positionTowerTooltip(options) {
  const { tooltip, tower, camera, canvas, gridSize = 32 } = options;
  
  if (!tooltip || !tower || !camera || !canvas) return;
  
  const canvasRect = canvas.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  
  // Get tower center in world coords
  const worldX = (tower.gridX + 0.5) * gridSize;
  const worldY = tower.gridY * gridSize;
  
  const pos = calculateTooltipPosition({
    camera,
    worldX,
    worldY,
    tooltipWidth: tooltipRect.width || 200,
    tooltipHeight: tooltipRect.height || 300,
    containerWidth: canvasRect.width,
    containerHeight: canvasRect.height,
    gridSize,
    preferredSide: 'above'
  });
  
  tooltip.style.left = `${pos.left}px`;
  tooltip.style.top = `${pos.top}px`;
}

/**
 * Position tooltip for an energy building
 * @param {Object} options - Options
 * @param {HTMLElement} options.tooltip - Tooltip element
 * @param {Object} options.building - Building instance with worldX, worldY
 * @param {Object} options.camera - Camera instance
 * @param {HTMLElement} options.container - Container element
 */
function positionEnergyTooltip(options) {
  const { tooltip, building, camera, container } = options;
  
  if (!tooltip || !building || !camera || !container) return;
  
  const containerRect = container.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  
  const pos = calculateTooltipPosition({
    camera,
    worldX: building.worldX,
    worldY: building.worldY,
    tooltipWidth: tooltipRect.width || 200,
    tooltipHeight: tooltipRect.height || 200,
    containerWidth: containerRect.width,
    containerHeight: containerRect.height,
    preferredSide: 'right'
  });
  
  tooltip.style.left = `${pos.left}px`;
  tooltip.style.top = `${pos.top}px`;
}

/**
 * Show tooltip element
 * @param {HTMLElement} tooltip - Tooltip element
 * @param {string} visibleClass - CSS class for visible state (default 'visible')
 */
function showTooltip(tooltip, visibleClass = 'visible') {
  if (tooltip) {
    tooltip.classList.add(visibleClass);
  }
}

/**
 * Hide tooltip element
 * @param {HTMLElement} tooltip - Tooltip element
 * @param {string} visibleClass - CSS class for visible state (default 'visible')
 */
function hideTooltip(tooltip, visibleClass = 'visible') {
  if (tooltip) {
    tooltip.classList.remove(visibleClass);
  }
}

module.exports = {
  calculateTooltipPosition,
  positionTowerTooltip,
  positionEnergyTooltip,
  showTooltip,
  hideTooltip
};
