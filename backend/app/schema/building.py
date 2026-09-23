from __future__ import annotations

from enum import Enum
from typing import Any, Optional, Union
from uuid import UUID

from pydantic import AliasChoices, BaseModel, Field


# ────────────────────────────────────────────────
# Enums
# ────────────────────────────────────────────────

class BuildingType(str, Enum):
    house = "house"
    hospital = "hospital"
    police_station = "police_station"
    mall = "mall"
    shop = "shop"
    apartment = "apartment"


class Units(str, Enum):
    metric = "metric"
    imperial = "imperial"


class RoomType(str, Enum):
    hall = "hall"
    kitchen = "kitchen"
    bedroom = "bedroom"
    bathroom = "bathroom"
    dining = "dining"
    corridor = "corridor"
    living = "living"
    study = "study"
    garage = "garage"
    balcony = "balcony"
    storeroom = "storeroom"
    laundry = "laundry"
    shop_unit = "shop_unit"
    reception = "reception"
    office = "office"
    meeting_room = "meeting_room"
    ward = "ward"
    icu = "icu"
    emergency = "emergency"
    nurse_station = "nurse_station"
    operating_room = "operating_room"
    lockup = "lockup"
    armory = "armory"
    food_court = "food_court"
    anchor_store = "anchor_store"


class FurnitureType(str, Enum):
    bed_single = "bed_single"
    bed_double = "bed_double"
    bed_queen = "bed_queen"
    bed_king = "bed_king"
    wardrobe = "wardrobe"
    sofa = "sofa"
    sofa_l = "sofa_l"
    coffee_table = "coffee_table"
    dining_table = "dining_table"
    dining_chair = "dining_chair"
    desk = "desk"
    office_chair = "office_chair"
    kitchen_counter = "kitchen_counter"
    kitchen_island = "kitchen_island"
    refrigerator = "refrigerator"
    stove = "stove"
    sink = "sink"
    toilet = "toilet"
    bathtub = "bathtub"
    shower = "shower"
    tv = "tv"
    tv_unit = "tv_unit"
    bookshelf = "bookshelf"
    side_table = "side_table"
    dresser = "dresser"


class DoorSwing(str, Enum):
    in_left = "in-left"
    in_right = "in-right"
    out_left = "out-left"
    out_right = "out-right"
    sliding = "sliding"
    double = "double"


class CreatedVia(str, Enum):
    drawing = "drawing"
    ai = "ai"
    template = "template"


class ConnectionVia(str, Enum):
    door = "door"
    opening = "opening"
    staircase = "staircase"
    corridor = "corridor"


# ────────────────────────────────────────────────
# Sub-models
# ────────────────────────────────────────────────

class Point2D(BaseModel):
    x: float
    y: float


class BoundingBox(BaseModel):
    w: float = 1.0
    d: float = 1.0
    h: float = 1.0


class FurnitureItem(BaseModel):
    furniture_id: str = Field(..., validation_alias=AliasChoices("furnitureId", "id"), serialization_alias="id")
    type: str
    asset_ref: Optional[str] = Field(None, alias="assetRef")
    position: list[float] = Field(..., min_length=3, max_length=3)
    rotation: list[float] = Field([0.0, 0.0, 0.0], min_length=3, max_length=3)
    scale: list[float] = Field([1.0, 1.0, 1.0], min_length=3, max_length=3)
    bounding_box: BoundingBox = Field(default_factory=BoundingBox, validation_alias=AliasChoices("boundingBox", "dimensions"))
    visible: bool = True

    model_config = {"populate_by_name": True}


class RoomConnection(BaseModel):
    to_room_id: str = Field(..., alias="toRoomId")
    via: ConnectionVia = ConnectionVia.door
    door_id: Optional[str] = Field(None, alias="doorId")

    model_config = {"populate_by_name": True}


class Room(BaseModel):
    room_id: str = Field(..., validation_alias=AliasChoices("roomId", "id"), serialization_alias="id")
    type: str
    label: Optional[str] = None
    name: Optional[str] = None
    polygon: list[list[float]]
    area: Optional[float] = None
    area_sq_ft: Optional[float] = Field(None, validation_alias=AliasChoices("areaSqFt", "area_sq_ft"))
    wall_ids: list[str] = Field(default_factory=list, validation_alias=AliasChoices("wallIds", "wall_ids"))
    connections: list[RoomConnection] = []
    furniture: list[FurnitureItem] = []
    visible: bool = True

    model_config = {"populate_by_name": True}


class Wall(BaseModel):
    wall_id: str = Field(..., validation_alias=AliasChoices("wallId", "id"), serialization_alias="id")
    start: list[float] = Field(..., validation_alias=AliasChoices("startPoint", "start"), min_length=2, max_length=2)
    end: list[float] = Field(..., validation_alias=AliasChoices("endPoint", "end"), min_length=2, max_length=2)
    thickness: float = 0.2
    height: float = 3.0
    material: str = "concrete"
    is_exterior: bool = Field(False, validation_alias=AliasChoices("is_exterior", "isExterior"))
    is_load_bearing: bool = Field(False, validation_alias=AliasChoices("is_load_bearing", "isLoadBearing"))
    visible: bool = True

    model_config = {"populate_by_name": True}


class Door(BaseModel):
    door_id: str = Field(..., validation_alias=AliasChoices("doorId", "id"), serialization_alias="id")
    wall_id: str = Field(..., validation_alias=AliasChoices("wallId", "wall_id"), serialization_alias="wallId")
    position: Union[float, list[float]] = 0.5
    width: float = 0.9
    height: float = 2.1
    swing: str = "in-left"
    is_entrance: bool = Field(False, validation_alias=AliasChoices("isEntrance", "is_entrance"))
    visible: bool = True

    model_config = {"populate_by_name": True}


class Window(BaseModel):
    window_id: str = Field(..., validation_alias=AliasChoices("windowId", "id"), serialization_alias="id")
    wall_id: str = Field(..., validation_alias=AliasChoices("wallId", "wall_id"), serialization_alias="wallId")
    position: Union[float, list[float]] = 0.5
    width: float = 1.2
    height: float = 1.2
    sill: float = Field(0.9, validation_alias=AliasChoices("sillHeight", "sill"))
    visible: bool = True

    model_config = {"populate_by_name": True}


class Staircase(BaseModel):
    staircase_id: Optional[str] = Field(None, validation_alias=AliasChoices("staircaseId", "id"), serialization_alias="id")
    location: str = "internal"
    connects_floors: list[int] = Field(default_factory=lambda: [0, 1], validation_alias=AliasChoices("connectsFloors", "connects_floors"))
    start_floor_index: Optional[int] = Field(None, alias="startFloorIndex")
    end_floor_index: Optional[int] = Field(None, alias="endFloorIndex")
    footprint: list[list[float]] = Field(default_factory=list)
    position: Optional[list[float]] = None
    width: Optional[float] = 1.2
    length: Optional[float] = 2.6
    rotation: Optional[float] = 0.0
    style: str = "straight"
    type: str = "straight"

    model_config = {"populate_by_name": True}


class Roof(BaseModel):
    roof_id: Optional[str] = Field(None, validation_alias=AliasChoices("roofId", "id"), serialization_alias="id")
    type: str = "pitched_hip"
    height: float = 2.2
    overhang: float = 0.6
    color: Optional[str] = "#b91c1c"
    visible: bool = True

    model_config = {"populate_by_name": True}


class SlabGeometry(BaseModel):
    outer_ring: list[list[float]] = Field(default_factory=list, alias="outerRing")
    inner_rings: list[list[list[float]]] = Field(default_factory=list, alias="innerRings")

    model_config = {"populate_by_name": True}


class Floor(BaseModel):
    floor_index: int = Field(..., alias="floorIndex")
    label: str = "Floor"
    name: Optional[str] = None
    elevation: float = 0.0
    floor_height: float = Field(3.0, alias="floorHeight")
    rooms: list[Room] = []
    walls: list[Wall] = []
    doors: list[Door] = []
    windows: list[Window] = []
    staircase: Optional[Staircase] = None
    staircases: list[Staircase] = Field(default_factory=list)
    slab_geometry: Optional[list[SlabGeometry]] = Field(None, alias="slabGeometry")
    roof: Optional[Roof] = None

    model_config = {"populate_by_name": True}


class Entrance(BaseModel):
    id: Optional[str] = "entrance-0"
    floor_index: int = Field(0, alias="floorIndex")
    wall_id: Optional[str] = Field(None, alias="wallId")
    door_id: Optional[str] = Field(None, alias="doorId")
    position: Optional[list[float]] = Field(default_factory=lambda: [0.0, 0.0])
    type: str = "main"
    facing: str = "south"

    model_config = {"populate_by_name": True}


class BuildingMetadata(BaseModel):
    created_by: Optional[str] = Field(None, alias="createdBy")
    created_via: CreatedVia = Field(CreatedVia.template, alias="createdVia")
    created_at: Optional[str] = Field(None, alias="createdAt")
    updated_at: Optional[str] = Field(None, alias="updatedAt")
    style: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[list[str]] = None

    model_config = {"populate_by_name": True}


# ────────────────────────────────────────────────
# Root Building model
# ────────────────────────────────────────────────

class Building(BaseModel):
    schema_version: str = Field("1.0", alias="schemaVersion")
    building_id: str = Field(..., alias="buildingId")
    building_type: BuildingType = Field(BuildingType.house, alias="buildingType")
    name: str = "Untitled Building"
    units: Units = Units.metric
    floors: list[Floor] = []
    entrance: Optional[Entrance] = None
    entrances: list[Entrance] = Field(default_factory=list)
    metadata: BuildingMetadata = Field(default_factory=BuildingMetadata)

    model_config = {"populate_by_name": True}
