from __future__ import annotations

from enum import Enum
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field


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
    # Commercial
    shop_unit = "shop_unit"
    reception = "reception"
    office = "office"
    meeting_room = "meeting_room"
    # Hospital
    ward = "ward"
    icu = "icu"
    emergency = "emergency"
    nurse_station = "nurse_station"
    operating_room = "operating_room"
    # Police
    lockup = "lockup"
    armory = "armory"
    # Mall
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
    w: float  # width  (x)
    d: float  # depth  (y)
    h: float  # height (z)


class FurnitureItem(BaseModel):
    furniture_id: str = Field(..., alias="furnitureId")
    type: FurnitureType
    asset_ref: Optional[str] = Field(None, alias="assetRef")
    position: list[float] = Field(..., min_length=3, max_length=3)
    rotation: list[float] = Field([0.0, 0.0, 0.0], min_length=3, max_length=3)
    scale: list[float] = Field([1.0, 1.0, 1.0], min_length=3, max_length=3)
    bounding_box: BoundingBox = Field(..., alias="boundingBox")
    visible: bool = True

    model_config = {"populate_by_name": True}


class RoomConnection(BaseModel):
    to_room_id: str = Field(..., alias="toRoomId")
    via: ConnectionVia
    door_id: Optional[str] = Field(None, alias="doorId")

    model_config = {"populate_by_name": True}


class Room(BaseModel):
    room_id: str = Field(..., alias="roomId")
    type: RoomType
    label: Optional[str] = None
    polygon: list[list[float]]  # [[x,y], ...]
    area_sq_ft: Optional[float] = Field(None, alias="areaSqFt")
    connections: list[RoomConnection] = []
    furniture: list[FurnitureItem] = []
    visible: bool = True

    model_config = {"populate_by_name": True}


class Wall(BaseModel):
    wall_id: str = Field(..., alias="wallId")
    start: list[float] = Field(..., min_length=2, max_length=2)
    end: list[float] = Field(..., min_length=2, max_length=2)
    thickness: float = 0.2
    height: float = 3.0
    material: str = "concrete"
    is_load_bearing: bool = False
    visible: bool = True

    model_config = {"populate_by_name": True}


class Door(BaseModel):
    door_id: str = Field(..., alias="doorId")
    wall_id: str = Field(..., alias="wallId")
    position: float = 0.5   # 0–1 along wall
    width: float = 0.9
    height: float = 2.1
    swing: DoorSwing = DoorSwing.in_left
    is_entrance: bool = False
    visible: bool = True

    model_config = {"populate_by_name": True}


class Window(BaseModel):
    window_id: str = Field(..., alias="windowId")
    wall_id: str = Field(..., alias="wallId")
    position: float = 0.5
    width: float = 1.2
    height: float = 1.2
    sill: float = 0.9      # height from floor
    visible: bool = True

    model_config = {"populate_by_name": True}


class Staircase(BaseModel):
    staircase_id: Optional[str] = Field(None, alias="staircaseId")
    location: str = "internal"    # "internal" | "external"
    connects_floors: list[int] = Field(..., alias="connectsFloors")
    footprint: list[list[float]]  # polygon [[x,y], ...]
    style: str = "straight"       # "straight" | "l-shaped" | "u-shaped" | "spiral"

    model_config = {"populate_by_name": True}


class Floor(BaseModel):
    floor_index: int = Field(..., alias="floorIndex")
    label: str
    elevation: float = 0.0         # metres from ground
    floor_height: float = Field(3.0, alias="floorHeight")  # floor-to-ceiling
    rooms: list[Room] = []
    walls: list[Wall] = []
    doors: list[Door] = []
    windows: list[Window] = []
    staircase: Optional[Staircase] = None

    model_config = {"populate_by_name": True}


class Entrance(BaseModel):
    floor_index: int = Field(..., alias="floorIndex")
    wall_id: str = Field(..., alias="wallId")
    door_id: Optional[str] = Field(None, alias="doorId")
    facing: str = "south"   # cardinal direction

    model_config = {"populate_by_name": True}


class BuildingMetadata(BaseModel):
    created_by: Optional[str] = Field(None, alias="createdBy")
    created_via: CreatedVia = Field(CreatedVia.template, alias="createdVia")
    created_at: Optional[str] = Field(None, alias="createdAt")
    style: Optional[str] = None
    description: Optional[str] = None

    model_config = {"populate_by_name": True}


# ────────────────────────────────────────────────
# Root Building model
# ────────────────────────────────────────────────

class Building(BaseModel):
    building_id: str = Field(..., alias="buildingId")
    building_type: BuildingType = Field(BuildingType.house, alias="buildingType")
    name: str = "Untitled Building"
    units: Units = Units.metric
    floors: list[Floor] = []
    entrance: Optional[Entrance] = None
    metadata: BuildingMetadata = Field(default_factory=BuildingMetadata)

    model_config = {"populate_by_name": True}
