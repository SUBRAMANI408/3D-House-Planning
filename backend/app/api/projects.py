import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.db.models import Project, Template, User
from app.schema.building import Building as BuildingSchema
from app.validator.models import ValidationResult
from app.validator.validator import validate_building

router = APIRouter(prefix="/projects", tags=["projects"])

class ProjectSummary(BaseModel):
    id: UUID
    name: str
    building_type: Optional[str] = None
    floors_count: int
    updated_at: datetime

class ProjectDetail(ProjectSummary):
    building_json: Dict[str, Any]
    version: int
    created_at: datetime

class CreateProjectRequest(BaseModel):
    name: str
    building_json: Optional[Dict[str, Any]] = None
    template_id: Optional[UUID] = None

class UpdateProjectRequest(BaseModel):
    name: Optional[str] = None
    building_json: Optional[Dict[str, Any]] = None

def extract_building_info(building_json: Optional[Dict[str, Any]]) -> tuple[Optional[str], int]:
    if not building_json:
        return None, 0
    building_type = building_json.get("buildingType")
    floors = len(building_json.get("floors", []))
    return building_type, floors

@router.get("", response_model=List[ProjectSummary])
async def list_projects(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Project)
        .where(Project.user_id == current_user.id)
        .order_by(Project.updated_at.desc())
    )
    projects = result.scalars().all()
    
    return [
        ProjectSummary(
            id=p.id,
            name=p.name,
            building_type=extract_building_info(p.building_json)[0],
            floors_count=extract_building_info(p.building_json)[1],
            updated_at=p.updated_at
        ) for p in projects
    ]

@router.post("", response_model=ProjectDetail, status_code=status.HTTP_201_CREATED)
async def create_project(
    request: CreateProjectRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    building_json = request.building_json or {}
    
    if request.template_id:
        result = await db.execute(select(Template).where(Template.id == request.template_id))
        template = result.scalars().first()
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        building_json = dict(template.building_json) if template.building_json else {}
        if building_json:
            building_json["buildingId"] = str(uuid.uuid4())
            
    if building_json:
        try:
            building_obj = BuildingSchema.model_validate(building_json)
            val_res = validate_building(building_obj)
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

    new_project = Project(
        name=request.name,
        building_json=building_json,
        user_id=current_user.id,
        version=1
    )
    db.add(new_project)
    await db.commit()
    await db.refresh(new_project)
    
    building_type, floors_count = extract_building_info(new_project.building_json)
    
    return ProjectDetail(
        id=new_project.id,
        name=new_project.name,
        building_type=building_type,
        floors_count=floors_count,
        updated_at=new_project.updated_at,
        created_at=new_project.created_at,
        building_json=new_project.building_json,
        version=new_project.version
    )

@router.get("/{project_id}", response_model=ProjectDetail)
async def get_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Project).where(Project.id == project_id, Project.user_id == current_user.id))
    project = result.scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    building_type, floors_count = extract_building_info(project.building_json)
    
    return ProjectDetail(
        id=project.id,
        name=project.name,
        building_type=building_type,
        floors_count=floors_count,
        updated_at=project.updated_at,
        created_at=project.created_at,
        building_json=project.building_json,
        version=project.version
    )

@router.put("/{project_id}", response_model=ProjectDetail)
async def update_project(
    project_id: UUID,
    request: UpdateProjectRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Project).where(Project.id == project_id, Project.user_id == current_user.id))
    project = result.scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    if request.building_json is not None:
        try:
            building_obj = BuildingSchema.model_validate(request.building_json)
            val_res = validate_building(building_obj)
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
        project.building_json = request.building_json
        
    if request.name is not None:
        project.name = request.name
        
    project.version += 1
    await db.commit()
    await db.refresh(project)
    
    building_type, floors_count = extract_building_info(project.building_json)
    
    return ProjectDetail(
        id=project.id,
        name=project.name,
        building_type=building_type,
        floors_count=floors_count,
        updated_at=project.updated_at,
        created_at=project.created_at,
        building_json=project.building_json,
        version=project.version
    )

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Project).where(Project.id == project_id, Project.user_id == current_user.id))
    project = result.scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    await db.delete(project)
    await db.commit()

@router.get("/{project_id}/validate")
async def validate_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Project).where(Project.id == project_id, Project.user_id == current_user.id))
    project = result.scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    try:
        building_obj = BuildingSchema.model_validate(project.building_json or {})
        return validate_building(building_obj)
    except Exception as e:
        return {"is_valid": False, "errors": [f"Invalid building schema: {str(e)}"], "warnings": []}

