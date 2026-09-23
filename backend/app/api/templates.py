from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_current_user_optional, get_db
from app.db.models import Project, Template, User
from app.schema.building import Building as BuildingSchema
from app.validator.validator import validate_building

router = APIRouter(prefix="/templates", tags=["templates"])

class TemplateSummary(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    building_type: Optional[str] = None
    floors_count: int
    tags: List[str] = []
    thumbnail_url: Optional[str] = None
    is_public: bool

class TemplateDetail(TemplateSummary):
    building_json: Dict[str, Any]
    version: int

class CreateTemplateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    tags: List[str] = []
    is_public: bool = True
    project_id: Optional[UUID] = None
    building_json: Optional[Dict[str, Any]] = None

class UpdateTemplateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    is_public: Optional[bool] = None
    building_json: Optional[Dict[str, Any]] = None

def extract_building_info(building_json: Optional[Dict[str, Any]]) -> tuple[Optional[str], int]:
    if not building_json:
        return None, 0
    building_type = building_json.get("buildingType")
    floors = len(building_json.get("floors", []))
    return building_type, floors

@router.get("", response_model=List[TemplateSummary])
async def list_templates(
    type: Optional[str] = None,
    floors: Optional[int] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    query = select(Template)
    
    conditions = [Template.is_public == True]
    if current_user:
        conditions.append(Template.created_by == current_user.id)
    
    query = query.where(or_(*conditions))
    
    if type:
        query = query.where(Template.building_type == type)
    if floors is not None:
        query = query.where(Template.floors_count == floors)
    if search:
        query = query.where(Template.name.ilike(f"%{search}%"))
        
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    templates = result.scalars().all()
    
    return [
        TemplateSummary(
            id=t.id,
            name=t.name,
            description=t.description,
            building_type=t.building_type,
            floors_count=t.floors_count,
            tags=t.tags or [],
            thumbnail_url=t.thumbnail_url,
            is_public=t.is_public
        ) for t in templates
    ]

@router.get("/{template_id}", response_model=TemplateDetail)
async def get_template(
    template_id: UUID,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Template).where(Template.id == template_id))
    template = result.scalars().first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
        
    if not template.is_public and (not current_user or template.created_by != current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized to access this template")
        
    return TemplateDetail(
        id=template.id,
        name=template.name,
        description=template.description,
        building_type=template.building_type,
        floors_count=template.floors_count,
        tags=template.tags or [],
        thumbnail_url=template.thumbnail_url,
        is_public=template.is_public,
        building_json=template.building_json or {},
        version=template.version
    )

@router.post("", response_model=TemplateSummary, status_code=status.HTTP_201_CREATED)
async def create_template(
    request: CreateTemplateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    building_json = None
    
    if request.project_id:
        result = await db.execute(select(Project).where(Project.id == request.project_id, Project.user_id == current_user.id))
        project = result.scalars().first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        building_json = project.building_json
    elif request.building_json is not None:
        building_json = request.building_json
    else:
        raise HTTPException(status_code=400, detail="Either project_id or building_json must be provided")
        
    if not building_json:
        building_json = {}
        
    try:
        building_obj = BuildingSchema.model_validate(building_json)
        val_res = validate_building(building_obj, normalize=True)
        if val_res.errors:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=val_res.model_dump()
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid building schema: {str(e)}"
        )
        
    building_type, floors_count = extract_building_info(building_json)
    
    new_template = Template(
        name=request.name,
        description=request.description,
        building_json=building_json,
        building_type=building_type,
        floors_count=floors_count,
        tags=request.tags,
        is_public=request.is_public,
        created_by=current_user.id,
        version=1
    )
    
    db.add(new_template)
    await db.commit()
    await db.refresh(new_template)
    
    return TemplateSummary(
        id=new_template.id,
        name=new_template.name,
        description=new_template.description,
        building_type=new_template.building_type,
        floors_count=new_template.floors_count,
        tags=new_template.tags or [],
        thumbnail_url=new_template.thumbnail_url,
        is_public=new_template.is_public
    )

@router.put("/{template_id}", response_model=TemplateDetail)
async def update_template(
    template_id: UUID,
    request: UpdateTemplateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Template).where(Template.id == template_id))
    template = result.scalars().first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
        
    if template.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this template")
        
    if request.building_json is not None:
        try:
            building_obj = BuildingSchema.model_validate(request.building_json)
            val_res = validate_building(building_obj, normalize=True)
            if val_res.errors:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=val_res.model_dump()
                )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid building schema: {str(e)}"
            )
        template.building_json = request.building_json
        building_type, floors_count = extract_building_info(request.building_json)
        template.building_type = building_type
        template.floors_count = floors_count
        
    if request.name is not None:
        template.name = request.name
    if request.description is not None:
        template.description = request.description
    if request.tags is not None:
        template.tags = request.tags
    if request.is_public is not None:
        template.is_public = request.is_public
        
    template.version += 1
    
    await db.commit()
    await db.refresh(template)
    
    return TemplateDetail(
        id=template.id,
        name=template.name,
        description=template.description,
        building_type=template.building_type,
        floors_count=template.floors_count,
        tags=template.tags or [],
        thumbnail_url=template.thumbnail_url,
        is_public=template.is_public,
        building_json=template.building_json or {},
        version=template.version
    )

@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Template).where(Template.id == template_id))
    template = result.scalars().first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
        
    if template.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this template")
        
    await db.delete(template)
    await db.commit()

