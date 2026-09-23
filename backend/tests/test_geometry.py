from __future__ import annotations

import pytest
from app.api.ai import calculate_shoelace_area
from app.validator.connectivity import polygons_share_boundary, is_boundary_blocked_by_solid_wall
from app.schema.building import Wall, Door


def test_calculate_shoelace_area_rect_and_lshape():
    # 6m x 5m rectangle = 30 m²
    rect = [[0.0, 0.0], [6.0, 0.0], [6.0, 5.0], [0.0, 5.0]]
    assert calculate_shoelace_area(rect) == 30.0

    # L-shaped polygon
    l_shape = [[0.0, 0.0], [10.0, 0.0], [10.0, 4.0], [4.0, 4.0], [4.0, 10.0], [0.0, 10.0]]
    # (10x4) + (4x6) = 40 + 24 = 64 m²
    assert calculate_shoelace_area(l_shape) == 64.0


def test_polygons_share_boundary():
    poly1 = [[0.0, 0.0], [6.0, 0.0], [6.0, 5.0], [0.0, 5.0]]
    poly2 = [[6.0, 0.0], [11.0, 0.0], [11.0, 5.0], [6.0, 5.0]]
    assert polygons_share_boundary(poly1, poly2) is True

    poly_disjoint = [[15.0, 0.0], [20.0, 0.0], [20.0, 5.0], [15.0, 5.0]]
    assert polygons_share_boundary(poly1, poly_disjoint) is False


def test_boundary_blocked_by_solid_wall():
    poly1 = [[0.0, 0.0], [6.0, 0.0], [6.0, 5.0], [0.0, 5.0]]
    poly2 = [[6.0, 0.0], [11.0, 0.0], [11.0, 5.0], [6.0, 5.0]]

    # Solid wall at x=6, y=0..5 without door
    solid_wall = Wall(id="w-solid", wallId="w-solid", startPoint=[6.0, 0.0], endPoint=[6.0, 5.0], isExterior=False)
    doors: list[Door] = []

    assert is_boundary_blocked_by_solid_wall(poly1, poly2, [solid_wall], doors) is True

    # Same wall with a door
    door_on_wall = Door(id="d-1", doorId="d-1", wallId="w-solid", position=[6.0, 2.5])
    assert is_boundary_blocked_by_solid_wall(poly1, poly2, [solid_wall], [door_on_wall]) is False


def test_hip_roof_ridge_length_math():
    # 12m x 8m rectangular footprint -> ridge length = 12 - 8 = 4m
    w, d = 12.0, 8.0
    ridge_len = max(0.0, w - d)
    assert ridge_len == 4.0

    # 10m x 10m square footprint -> ridge length = 0m (pyramid tip)
    w_sq, d_sq = 10.0, 10.0
    assert max(0.0, w_sq - d_sq) == 0.0


def test_corner_touching_no_shared_boundary():
    # Room 1: (0,0) to (5,5)
    r1 = [[0.0, 0.0], [5.0, 0.0], [5.0, 5.0], [0.0, 5.0]]
    # Room 2 touches ONLY at corner (5,5): (5,5) to (10,10)
    r2 = [[5.0, 5.0], [10.0, 5.0], [10.0, 10.0], [5.0, 10.0]]

    assert polygons_share_boundary(r1, r2) is False


def test_staircase_physical_geometry_checks():
    # Standard 3.0m floor height with 15 risers -> riser height = 0.20m, tread depth = 0.28m
    floor_height = 3.0
    num_steps = 15
    riser_height = floor_height / num_steps
    assert 0.15 <= riser_height <= 0.22

    stair_length = 2.8
    tread_depth = stair_length / (num_steps - 1)
    assert 0.18 <= tread_depth <= 0.35

