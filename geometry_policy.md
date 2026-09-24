# Structural Geometry Validation Policy

This document formally defines the engineering tolerances applied during automated backend validation of 3D floor plans and slab topologies in the 3D House Planning System. 

These values govern the degree of variance permitted between the explicitly drawn/generated room polygons and the normalized canonical floor slab (which accounts for staircases, courtyards, and load-bearing unification).

**Important Note:** These tolerances are configured specifically for the internal precision of the CAD editor at the current project scale (residential housing). They are **not** universal engineering-code thresholds and must be recalibrated if the unit system, grid precision, or structural building scale changes.

## 1. Topological Area Validation (Symmetric Difference)
- **Minimum Precision Tolerance:** `0.10 m²`
- **Relative Area Tolerance:** `2%` (`0.02 * expected_area`)
- **Formula:** `max(0.10, expected_area * 0.02)`
- **Rationale:** Ensures that minor floating-point drift during polygon unification or 2D vertex snapping does not trigger false-positive validation errors, while strictly rejecting any missing rooms or structural gaps.

## 2. Boundary Displacement Validation (Hausdorff Distance)
- **Maximum Threshold:** `0.15 m` (15 centimeters)
- **Rationale:** Ensures that even if the total area remains within the 2% tolerance, the physical placement of the exterior and interior boundaries does not deviate significantly. A 15cm threshold accommodates wall-thickness buffering while rejecting arbitrary vertex shifting.

## 3. Structural Component Matching
- **Polygonal Component Count:** The number of discrete, disconnected slab bodies submitted must **exactly match** the unified canonical expected components.
- **Hole Count (Voids):** The number of internal voids (staircase holes, internal courtyards) must **exactly match** the unified canonical expected voids.
- **Rationale:** Prevents situations where an entire courtyard or stairwell is missing but accidentally slips past the area tolerance on exceptionally large floor plans.

## 4. Load-Bearing Wall Support
- **Support Buffer Radius:** `0.30 m` (30 centimeters)
- **Calculation Method:** Continuous geometric intersection (`LineString.buffer().intersection()`).
- **Rationale:** Determines exactly what fraction of an upper-floor wall is supported by ground-floor load-bearing geometry. The 30cm buffer accounts for internal wall thickness and beam width.
