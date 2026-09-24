import math
from app.schema.building import Building
from app.validator.models import ValidationError, Severity
from shapely.geometry import Polygon, LineString
from shapely.ops import unary_union

def calculate_polygon_area(polygon: list[list[float]]) -> float:
    """Shoelace formula — returns area in m²."""
    if not polygon or len(polygon) < 3:
        return 0.0
    n = len(polygon)
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += polygon[i][0] * polygon[j][1]
        area -= polygon[j][0] * polygon[i][1]
    return abs(area) / 2.0


def _calculate_wall_support_fraction(wall_line: LineString, supporting_union) -> float:
    """
    Calculates exact continuous fraction of wall_line supported by 
    load-bearing walls on floor below using Shapely segment intersection.
    """
    if wall_line.length < 1e-6 or supporting_union.is_empty:
        return 0.0
    supported_part = wall_line.intersection(supporting_union)
    return supported_part.length / wall_line.length


def normalize_slab_geometry(building: Building):
    """
    Computes and populates canonical slab_geometry on floors missing it.
    
    Canonicalization Sequence:
      parse → normalize_slab_geometry (populate missing slabGeometry) → check_structural → return canonical model.
    
    Enforces complete staircase footprint containment within floor boundaries 
    before performing slab boolean difference operations.
    Does NOT mutate if slab_geometry is already provided.
    """
    from app.schema.building import SlabGeometry
    
    for floor in building.floors:
        if floor.slab_geometry:
            continue
            
        room_polys = []
        for room in floor.rooms:
            if room.polygon and len(room.polygon) >= 3:
                rp = Polygon(room.polygon)
                if rp.is_valid:
                    room_polys.append(rp)
                    
        if not room_polys:
            continue
            
        expected_slab = unary_union(room_polys)
        
        all_stairs = [s for f in building.floors for s in f.staircases]
        for s in all_stairs:
            start_idx = s.start_floor_index if s.start_floor_index is not None else 0
            if start_idx < floor.floor_index and (s.end_floor_index is None or s.end_floor_index >= floor.floor_index):
                # Generate canonical footprint from dimensions
                sw = s.width or 1.2
                sl = s.length or 2.6
                rot = s.rotation or 0.0
                sx, sy = s.position if s.position else (0.0, 0.0)
                cos_r = math.cos(rot)
                sin_r = math.sin(rot)
                corners = [(-sw/2, -sl/2), (sw/2, -sl/2), (sw/2, sl/2), (-sw/2, sl/2)]
                sp_pts = [(sx + c[0]*cos_r - c[1]*sin_r, sy + c[0]*sin_r + c[1]*cos_r) for c in corners]
                canonical_sp = Polygon(sp_pts)
                
                if s.footprint and len(s.footprint) >= 3:
                    sp = Polygon(s.footprint)
                else:
                    sp = canonical_sp
                
                # Strict containment check: only subtract if footprint is valid and fully within floor slab
                if sp.is_valid and sp.within(expected_slab):
                    expected_slab = expected_slab.difference(sp)
                    
        if expected_slab.is_empty:
            floor.slab_geometry = []
        elif expected_slab.geom_type == 'Polygon':
            floor.slab_geometry = [SlabGeometry(
                outer_ring=list(expected_slab.exterior.coords),
                inner_rings=[list(i.coords) for i in expected_slab.interiors]
            )]
        elif expected_slab.geom_type == 'MultiPolygon':
            floor.slab_geometry = [
                SlabGeometry(
                    outer_ring=list(poly.exterior.coords),
                    inner_rings=[list(i.coords) for i in poly.interiors]
                ) for poly in expected_slab.geoms
            ]

def check_structural(building: Building) -> list[ValidationError]:
    issues: list[ValidationError] = []

    # 0. Check canonical slab geometries and custom footprints via Shapely
    for floor in building.floors:
        # First, validate any custom stair footprints on this floor
        for stair in floor.staircases:
            if stair.footprint and len(stair.footprint) >= 3:
                poly = Polygon(stair.footprint)
                if not poly.is_valid:
                    issues.append(ValidationError(
                        code='INVALID_STAIR_FOOTPRINT',
                        severity=Severity.error,
                        message=f'Staircase {stair.staircase_id} footprint is topologically invalid (e.g. self-intersecting).',
                        floor_index=floor.floor_index,
                        object_id=stair.staircase_id
                    ))
                    continue
                if poly.area < 0.1:
                    issues.append(ValidationError(
                        code='INVALID_STAIR_FOOTPRINT',
                        severity=Severity.error,
                        message=f'Staircase {stair.staircase_id} footprint area is near zero.',
                        floor_index=floor.floor_index,
                        object_id=stair.staircase_id
                    ))

        # Re-compute union of all rooms
        room_polys = []
        for room in floor.rooms:
            if room.polygon and len(room.polygon) >= 3:
                rp = Polygon(room.polygon)
                if not rp.is_valid:
                    issues.append(ValidationError(
                        code='INVALID_ROOM_POLYGON',
                        severity=Severity.error,
                        message=f'Room {room.room_id} has an invalid polygon.',
                        floor_index=floor.floor_index,
                        object_id=room.room_id
                    ))
                    continue
                room_polys.append(rp)
                
        if not room_polys:
            continue
            
        # If a floor has valid rooms, compute the expected canonical slab server-side.
        expected_slab = unary_union(room_polys)
        
        # Subtract penetrating staircases from lower floors (destination semantics)
        # Stair originating here doesn't cut a hole in this floor.
        all_stairs = [s for f in building.floors for s in f.staircases]
        for s in all_stairs:
            # Rule: Stair cuts hole in upper floors, not the start floor
            start_idx = s.start_floor_index if s.start_floor_index is not None else 0
            if start_idx < floor.floor_index and (s.end_floor_index is None or s.end_floor_index >= floor.floor_index):
                if s.footprint and len(s.footprint) >= 3:
                    sp = Polygon(s.footprint)
                else:
                    sw = s.width or 1.2
                    sl = s.length or 2.6
                    rot = s.rotation or 0.0
                    sx, sy = s.position if s.position else (0.0, 0.0)
                    cos_r = math.cos(rot)
                    sin_r = math.sin(rot)
                    corners = [
                        (-sw/2, -sl/2), (sw/2, -sl/2),
                        (sw/2, sl/2), (-sw/2, sl/2)
                    ]
                    sp_pts = [
                        (sx + c[0]*cos_r - c[1]*sin_r, sy + c[0]*sin_r + c[1]*cos_r)
                        for c in corners
                    ]
                    sp = Polygon(sp_pts)
                
                if not sp.is_valid:
                    issues.append(ValidationError(
                        code='INVALID_STAIR_GEOMETRY',
                        severity=Severity.error,
                        message=f'Staircase {s.staircase_id} generates invalid geometry.',
                        floor_index=floor.floor_index,
                        object_id=s.staircase_id
                    ))
                    continue
                
                # Verify that the staircase footprint is entirely within the expected slab.
                if not sp.within(expected_slab):
                    if sp.intersects(expected_slab):
                        issues.append(ValidationError(
                            code='PARTIALLY_OUTSIDE_STAIR_FOOTPRINT',
                            severity=Severity.error,
                            message=f'Staircase {s.staircase_id} partially extends outside the floor {floor.floor_index} slab.',
                            floor_index=floor.floor_index,
                            object_id=s.staircase_id
                        ))
                    else:
                        issues.append(ValidationError(
                            code='COMPLETELY_OUTSIDE_STAIR_FOOTPRINT',
                            severity=Severity.error,
                            message=f'Staircase {s.staircase_id} is completely outside the floor {floor.floor_index} slab.',
                            floor_index=floor.floor_index,
                            object_id=s.staircase_id
                        ))
                    continue
                
                expected_slab = expected_slab.difference(sp)
        
        # Now construct the submitted client slab geometry and compare topology
        if not floor.slab_geometry:
            issues.append(ValidationError(
                code='MISSING_SLAB_GEOMETRY',
                severity=Severity.error,
                message=f'Floor {floor.floor_index} contains rooms but is missing canonical slab geometry.',
                floor_index=floor.floor_index
            ))
            continue
            
        submitted_outers = []
        submitted_inners = []
        for slab in floor.slab_geometry:
            if slab.outer_ring and len(slab.outer_ring) >= 3:
                sg_poly = Polygon(slab.outer_ring)
                if not sg_poly.is_valid:
                    issues.append(ValidationError(
                        code='INVALID_SLAB_RING',
                        severity=Severity.error,
                        message=f'Floor {floor.floor_index} submitted slab has an invalid outer ring.',
                        floor_index=floor.floor_index
                    ))
                    continue
                submitted_outers.append(sg_poly)
                
                for inner in (slab.inner_rings or []):
                    if len(inner) >= 3:
                        ir_poly = Polygon(inner)
                        if not ir_poly.is_valid:
                            issues.append(ValidationError(
                                code='INVALID_SLAB_RING',
                                severity=Severity.error,
                                message=f'Floor {floor.floor_index} submitted slab has an invalid inner ring (hole).',
                                floor_index=floor.floor_index
                            ))
                            continue
                        
                        if not ir_poly.within(sg_poly):
                            issues.append(ValidationError(
                                code='INVALID_HOLE_CONTAINMENT',
                                severity=Severity.error,
                                message=f'Floor {floor.floor_index} submitted slab hole is not contained within the outer boundary.',
                                floor_index=floor.floor_index
                            ))
                        submitted_inners.append(ir_poly)
        
        if submitted_outers:
            submitted_slab = unary_union(submitted_outers)
            if submitted_inners:
                # Check if inner rings overlap each other
                for i, ir1 in enumerate(submitted_inners):
                    for j, ir2 in enumerate(submitted_inners):
                        if i < j and ir1.intersects(ir2) and not ir1.touches(ir2):
                            issues.append(ValidationError(
                                code='HOLE_OVERLAP',
                                severity=Severity.error,
                                message=f'Floor {floor.floor_index} submitted slab contains overlapping holes.',
                                floor_index=floor.floor_index
                            ))
                            break
                            
                submitted_slab = submitted_slab.difference(unary_union(submitted_inners))
                
            # 1. Topological comparison via symmetric difference
            sym_diff = submitted_slab.symmetric_difference(expected_slab)
            # Scale-aware tolerance formula: max(absolute_min, expected_area * relative_tolerance)
            abs_tolerance = 0.1  # 0.1 m² minimum precision tolerance
            rel_tolerance = 0.02 # 2% relative area tolerance
            tolerance = max(abs_tolerance, expected_slab.area * rel_tolerance)
            
            if sym_diff.area > tolerance:
                issues.append(ValidationError(
                    code='INVALID_SLAB_GEOMETRY',
                    severity=Severity.error,
                    message=(f'Floor {floor.floor_index} submitted slab topology mismatch. '
                             f'Symmetric difference area: {sym_diff.area:.2f} m² exceeds tolerance {tolerance:.2f} m².'),
                    floor_index=floor.floor_index
                ))
                
            # 2. Strict Hausdorff distance check (boundary similarity)
            hausdorff = submitted_slab.hausdorff_distance(expected_slab)
            if hausdorff > 0.15:
                issues.append(ValidationError(
                    code='INVALID_SLAB_GEOMETRY',
                    severity=Severity.error,
                    message=(f'Floor {floor.floor_index} submitted slab boundary deviates too much. '
                             f'Hausdorff distance: {hausdorff:.2f} m exceeds 0.15 m tolerance.'),
                    floor_index=floor.floor_index
                ))
                
            # 3. Component & Hole Count Matching
            def get_counts(geom):
                if geom.is_empty:
                    return 0, 0
                components = geom.geoms if hasattr(geom, 'geoms') else [geom]
                holes = sum(len(c.interiors) for c in components)
                return len(components), holes

            sub_comp, sub_holes = get_counts(submitted_slab)
            exp_comp, exp_holes = get_counts(expected_slab)
            if sub_comp != exp_comp or sub_holes != exp_holes:
                issues.append(ValidationError(
                    code='INVALID_SLAB_GEOMETRY',
                    severity=Severity.error,
                    message=(f'Floor {floor.floor_index} submitted slab component mismatch. '
                             f'Expected {exp_comp} components with {exp_holes} holes, '
                             f'got {sub_comp} components with {sub_holes} holes.'),
                    floor_index=floor.floor_index
                ))
        else:
             issues.append(ValidationError(
                    code='INVALID_SLAB_GEOMETRY',
                    severity=Severity.error,
                    message=f'Floor {floor.floor_index} is missing valid outer rings in submitted slab.',
                    floor_index=floor.floor_index
             ))

    if len(building.floors) <= 1:
        return issues

    floors_by_index = {f.floor_index: f for f in building.floors}

    for floor_idx, floor in floors_by_index.items():
        if floor_idx == 0:
            continue

        floor_below = floors_by_index.get(floor_idx - 1)
        if not floor_below:
            continue

        # 1. Cantilever check — compare actual m² polygon areas
        area_current = sum(
            calculate_polygon_area(room.polygon)
            for room in floor.rooms
            if room.polygon
        )
        area_below = sum(
            calculate_polygon_area(room.polygon)
            for room in floor_below.rooms
            if room.polygon
        )

        if area_below > 0 and area_current > area_below * 1.25:
            issues.append(ValidationError(
                code='CANTILEVER_EXCEEDED',
                severity=Severity.warning,
                message=(
                    f'Floor {floor_idx} footprint ({area_current:.1f} m²) exceeds '
                    f'floor below ({area_below:.1f} m²) by more than 25%'
                ),
                floor_index=floor_idx
            ))

        # 2. Load-bearing wall support check — continuous Shapely segment buffering
        walls_below = [w for w in floor_below.walls if w.is_load_bearing]
        supporting_lines = []
        for wb in walls_below:
            bl = LineString([(wb.start[0], wb.start[1]), (wb.end[0], wb.end[1])])
            if bl.length >= 1e-6:
                supporting_lines.append(bl.buffer(0.3))  # 0.3m buffer radius = 0.6m support tolerance width

        supporting_union = unary_union(supporting_lines) if supporting_lines else Polygon()

        for wall in floor.walls:
            if not wall.is_load_bearing:
                continue

            wall_line = LineString([(wall.start[0], wall.start[1]), (wall.end[0], wall.end[1])])
            best_overlap = _calculate_wall_support_fraction(wall_line, supporting_union)

            # Require >=50% of wall length to be supported
            if best_overlap < 0.5:
                issues.append(ValidationError(
                    code='FLOATING_LOAD_BEARING_WALL',
                    severity=Severity.error,
                    message=(
                        f'Load bearing wall {wall.wall_id} on floor {floor_idx} '
                        f'has only {best_overlap * 100:.0f}% geometric support from floor below '
                        f'(need >=50%)'
                    ),
                    floor_index=floor_idx,
                    object_id=wall.wall_id
                ))

    return issues
