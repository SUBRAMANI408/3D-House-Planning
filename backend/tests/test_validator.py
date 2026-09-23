import pytest
from app.schema.building import (
    Building, Floor, Room, Wall, Door, Entrance, Staircase, FurnitureItem, BoundingBox,
    RoomType, BuildingType, ConnectionVia, RoomConnection
)
from app.validator.validator import validate_building
from app.validator.connectivity import check_connectivity
from app.validator.collision import check_collisions
from app.validator.structural import check_structural
from app.validator.room_sizing import check_room_sizing

def make_simple_house() -> Building:
    living_room = Room(
        roomId="room_living",
        type=RoomType.living,
        polygon=[[0.0, 0.0], [4.0, 0.0], [4.0, 4.0], [0.0, 4.0]],
        areaSqFt=172.0,
        connections=[
            RoomConnection(toRoomId="room_bed", via=ConnectionVia.door)
        ]
    )
    
    bedroom = Room(
        roomId="room_bed",
        type=RoomType.bedroom,
        polygon=[[4.0, 0.0], [8.0, 0.0], [8.0, 4.0], [4.0, 4.0]],
        areaSqFt=172.0,
        connections=[
            RoomConnection(toRoomId="room_living", via=ConnectionVia.door)
        ]
    )
    
    w1 = Wall(wallId="w1", start=[0.0, 0.0], end=[4.0, 0.0], thickness=0.2)
    w2 = Wall(wallId="w2", start=[4.0, 0.0], end=[4.0, 4.0], thickness=0.2)
    d1 = Door(doorId="d1", wallId="w1", position=0.5, is_entrance=True)
    
    floor = Floor(
        floorIndex=0,
        label="Ground Floor",
        rooms=[living_room, bedroom],
        walls=[w1, w2],
        doors=[d1]
    )
    
    entrance = Entrance(floorIndex=0, wallId="w1", doorId="d1")
    
    return Building(
        buildingId="building_1",
        buildingType=BuildingType.house,
        floors=[floor],
        entrance=entrance
    )

def test_connectivity_valid():
    house = make_simple_house()
    issues = check_connectivity(house)
    errors = [i for i in issues if i.severity == "error"]
    assert len(errors) == 0

def test_connectivity_unreachable_room():
    house = make_simple_house()
    isolated_room = Room(
        roomId="room_isolated",
        type=RoomType.bathroom,
        polygon=[[10.0, 0.0], [12.0, 0.0], [12.0, 2.0], [10.0, 2.0]],
        areaSqFt=43.0,
        connections=[]
    )
    house.floors[0].rooms.append(isolated_room)
    
    issues = check_connectivity(house)
    errors = [i for i in issues if i.severity == "error"]
    assert len(errors) > 0
    assert any("not reachable" in e.message.lower() for e in errors)

def test_missing_staircase():
    house = make_simple_house()
    upper_floor = Floor(
        floorIndex=1,
        label="First Floor",
        rooms=[
            Room(
                roomId="room_upper",
                type=RoomType.bedroom,
                polygon=[[0.0, 0.0], [4.0, 0.0], [4.0, 4.0], [0.0, 4.0]],
                areaSqFt=172.0
            )
        ],
        walls=[Wall(wallId="w_upper", start=[0.0, 0.0], end=[4.0, 0.0])],
        doors=[]
    )
    house.floors.append(upper_floor)
    
    issues = check_connectivity(house)
    errors = [i for i in issues if i.severity == "error"]
    assert any("staircase" in e.message.lower() for e in errors)

def test_furniture_overlap():
    house = make_simple_house()
    f1 = FurnitureItem(
        furnitureId="f1",
        type="sofa",
        position=[1.0, 1.0, 0.0],
        boundingBox=BoundingBox(w=1.5, d=1.0, h=0.8)
    )
    f2 = FurnitureItem(
        furnitureId="f2",
        type="coffee_table",
        position=[1.2, 1.1, 0.0],
        boundingBox=BoundingBox(w=1.0, d=0.6, h=0.4)
    )
    house.floors[0].rooms[0].furniture = [f1, f2]
    
    issues = check_collisions(house)
    warnings = [i for i in issues if i.severity == "warning"]
    assert any("overlap" in w.message.lower() for w in warnings)

def test_floating_load_bearing_wall():
    house = make_simple_house()
    floating_wall = Wall(
        wallId="w_lb_floating",
        start=[15.0, 15.0],
        end=[20.0, 15.0],
        is_load_bearing=True
    )
    upper_floor = Floor(
        floorIndex=1,
        label="First Floor",
        rooms=[
            Room(
                roomId="room_upper",
                type=RoomType.bedroom,
                polygon=[[15.0, 15.0], [20.0, 15.0], [20.0, 20.0], [15.0, 20.0]],
                areaSqFt=250.0
            )
        ],
        walls=[floating_wall],
        staircase=Staircase(staircaseId="stair1", connectsFloors=[0, 1], footprint=[[0, 0], [2, 2]])
    )
    house.floors.append(upper_floor)
    
    issues = check_structural(house)
    errors = [i for i in issues if i.severity == "error"]
    assert any("load bearing" in e.message.lower() for e in errors)

def test_room_sizing_too_small():
    house = make_simple_house()
    house.floors[0].rooms[1].area_sq_ft = 40.0  # Bedroom min is 100 sq ft
    
    issues = check_room_sizing(house)
    warnings = [i for i in issues if i.severity == "warning"]
    assert any("minimum" in w.message.lower() for w in warnings)
    
    # Full validate_building call should be valid (warnings only, no hard errors)
    res = validate_building(house)
    assert res.is_valid is True

def test_staircase_hole_semantics():
    house = make_simple_house()
    # Add a second floor
    upper_floor = Floor(
        floorIndex=1,
        label="First Floor",
        rooms=[
            Room(
                roomId="room_upper",
                type=RoomType.bedroom,
                polygon=[[0.0, 0.0], [4.0, 0.0], [4.0, 4.0], [0.0, 4.0]],
                areaSqFt=172.0
            )
        ],
        walls=[],
        doors=[]
    )
    house.floors.append(upper_floor)
    
    # Add a staircase starting on floor 0, ending on floor 1
    stair = Staircase(
        staircaseId="stair1",
        start_floor_index=0,
        end_floor_index=1,
        footprint=[[1.0, 1.0], [3.0, 1.0], [3.0, 3.0], [1.0, 3.0]]
    )
    house.floors[0].staircases = [stair]
    
    # Check structural rules
    issues = check_structural(house)
    errors = [i for i in issues if i.severity == "error"]
    assert len(errors) == 0
    
    # After check_structural runs with missing slabGeometry, the canonical slabs are populated
    f0_slab = house.floors[0].slab_geometry[0]
    f1_slab = house.floors[1].slab_geometry[0]
    
    # Floor 0 (origin) should NOT have a hole (inner_rings should be empty or nonexistent)
    assert not f0_slab.inner_rings or len(f0_slab.inner_rings) == 0
    
    # Floor 1 (destination) SHOULD have a hole matching the stair footprint
    assert f1_slab.inner_rings and len(f1_slab.inner_rings) > 0
    assert len(f1_slab.inner_rings[0]) >= 3
