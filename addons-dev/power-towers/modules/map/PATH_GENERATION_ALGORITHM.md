# Segment-Walker Path Generation Algorithm

## Overview

The Segment-Walker algorithm generates procedural enemy paths for the Tower Defense game. It creates winding, spiral-like paths from a spawn point on the map edge to the base in the center, while avoiding self-intersections.

## Key Concepts

### 1. Spawn Point Selection
- Spawn is placed on a random edge (left, right, top, bottom) based on weights
- **Avoids center of edges** - only spawns in first 30% or last 30% of each edge
- This ensures paths have room to wind before reaching the center

### 2. Dynamic Bounds Shrinking
- The algorithm tracks which side the base is relative to current direction
- When the base "flips" from one side to the other (path crosses the base axis), bounds shrink by 10%
- This creates a natural spiral effect, pushing the path closer to center over time
- Shrink steps: 10% → 20% → 30% → 40%...

### 3. Collision Detection (CLEARANCE)
- Each path cell marks surrounding cells as "occupied" within CLEARANCE radius
- New segments cannot pass through occupied zones
- Exception: cells within CLEARANCE+1 of current position (allows tight turns)

## Algorithm Parameters

```javascript
CLEARANCE = 2          // Buffer zone around path cells
MIN_SEGMENT = 10       // Minimum segment length
MAX_SEGMENT = 15       // Maximum segment length  
FIRST_SEGMENT_MIN = 20 // Minimum first segment (goes straight into map)
finishThreshold = 20%  // Distance to base to trigger finish (20 cells on 100x100)
minTotalPathLength = 1.2x map size  // Minimum path length before finishing
```

## Direction Selection

### Base Side Detection
The algorithm determines where the base is relative to current movement direction:
- `left` - base is to the left of current direction
- `right` - base is to the right
- `front` - base is ahead
- `back` - base is behind

### Probability Distribution
```
Toward base:  60% (50% if last turn was also toward base)
Straight:     30%
Away from base: 10% (20% if last turn was toward base)
```

### Force Toward Base
When close to base (< 25 cells) AND path is reasonably long (> 80% of minimum):
- Algorithm forces direction toward base instead of random choice
- Uses `_getDirectionTowardBase()` which picks axis with larger distance

## Segment Drawing Process

1. **Choose direction** using probability or force-toward-base
2. **Calculate segment length** based on available space and bounds
3. **Try to draw segment**:
   - If blocked, try progressively shorter lengths (×0.7 each time)
   - If still blocked at MIN_SEGMENT, try alternate directions
   - If all directions blocked, trigger rollback

## Rollback System

### Progressive Rollback
When stuck, the algorithm rolls back segments with increasing depth:

```
1st rollback: remove 1 segment
2nd rollback (same area): remove 2 segments  
3rd rollback (same area): remove 3 segments
...
Max: half of history
```

"Same area" = within 10 cells of last rollback position

### On Rollback:
1. Remove segments from history
2. Clear occupied cells for removed path
3. **Force direction change** - randomly turn left or right from recovered direction
4. Reset `consecutiveRollbacks` counter on successful segment

## Finishing the Path

### Early Finish Conditions
Path finishes directly to base when:
- `distToBase <= finishThreshold` (20 cells)
- `totalPathLength >= minTotalPathLength` (120 cells)

### Force Finish
After max iterations (30) or no recovery possible:
- `_finishPathToBase()` draws L-shaped path to base
- First tries horizontal, then vertical (or vice versa)
- Forces cells if collision detected (to guarantee reaching base)

## Key Methods

| Method | Purpose |
|--------|---------|
| `_generateSafePath()` | Main algorithm loop |
| `_getInitialDirection()` | Determine start direction from edge |
| `_getBaseSide()` | Calculate base position relative to direction |
| `_chooseNextDirection()` | Probabilistic direction selection |
| `_getDirectionTowardBase()` | Force direction toward base |
| `_calcSegmentLength()` | Calculate valid segment length |
| `_calcSegmentEndpoint()` | Calculate endpoint respecting bounds |
| `_tryRollback()` | Progressive rollback on stuck |
| `_finishPathToBase()` | L-path to base at end |

## Collision Helper Functions

```javascript
isFree(cellX, cellY, currentX, currentY)
// Returns true if cell is not occupied
// Exception: allows cells near current position for turns

canDrawLine(x1, y1, x2, y2, debug)  
// Checks if entire line segment is free
// Uses isFree for each cell along the line
```

## Visual Result

The algorithm produces paths that:
- Start from corner areas of map edges
- Wind inward in a spiral pattern
- Never cross themselves
- Have natural-looking turns (no 180° reversals)
- Always reach the base in center

## Debugging

Console logs include:
- Iteration number, position, distance to base, total length
- Direction choices and segment lengths
- Rollback events with depth
- Blocked cell locations

Example:
```
[MapGenerator] Iter 5: pos=(38,54), distToBase=16, totalLen=59, shrink=0
[MapGenerator] Trying dir=left, segmentLength=23
[MapGenerator] Drew segment to (15,54), dir=left, len=23, total=82
```
