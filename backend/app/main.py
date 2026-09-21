from __future__ import annotations

import json
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.core.config import settings
from app.db.database import init_db, redis_client
from app.db.models import Template

logger = logging.getLogger(__name__)


async def seed_templates() -> None:
    """Seed bundled templates into the database on first run."""
    from sqlalchemy import select, func
    from app.db.database import AsyncSessionLocal

    templates_dir = Path(__file__).parent.parent / "seed_data" / "templates"
    if not templates_dir.exists():
        logger.info("No seed templates directory found, skipping seeding.")
        return

    async with AsyncSessionLocal() as session:
        # Check if templates already seeded
        count_result = await session.execute(select(func.count()).select_from(Template))
        count = count_result.scalar()
        if count and count > 0:
            logger.info(f"Templates already seeded ({count} found), skipping.")
            return

        for json_file in templates_dir.glob("*.json"):
            try:
                data = json.loads(json_file.read_text(encoding="utf-8"))
                floors_count = len(data.get("floors", []))
                building_type = data.get("buildingType", "house")
                metadata = data.get("metadata", {})

                template = Template(
                    name=data.get("name", json_file.stem.replace("_", " ").title()),
                    description=metadata.get("description", ""),
                    building_json=data,
                    tags=data.get("tags", [building_type]),
                    building_type=building_type,
                    floors_count=floors_count,
                    is_public=True,
                    version=1,
                )
                session.add(template)
                logger.info(f"Seeded template: {template.name}")
            except Exception as e:
                logger.error(f"Failed to seed {json_file.name}: {e}")

        await session.commit()
        logger.info("Template seeding complete.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup → yield → shutdown."""
    logger.info(f"Starting {settings.APP_NAME} v{settings.VERSION}")

    # Initialize database
    await init_db()
    logger.info("Database initialized.")

    # Seed templates
    await seed_templates()

    # Test Redis connection
    try:
        await redis_client.ping()
        logger.info("Redis connection established.")
    except Exception as e:
        logger.warning(f"Redis not available: {e}. Session caching disabled.")

    yield

    # Cleanup
    await redis_client.aclose()
    logger.info("Shutdown complete.")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.VERSION,
        description="AI-Powered 3D Building Design & Construction System API",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # Middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(GZipMiddleware, minimum_size=1000)

    # Routers
    from app.api.auth import router as auth_router
    from app.api.projects import router as projects_router
    from app.api.templates import router as templates_router

    app.include_router(auth_router)
    app.include_router(projects_router)
    app.include_router(templates_router)

    @app.get("/health", tags=["health"])
    async def health_check():
        return {
            "status": "healthy",
            "version": settings.VERSION,
            "environment": settings.ENVIRONMENT,
        }

    return app


app = create_app()
