from fastapi import FastAPI, HTTPException, Depends, Header
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
import os
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from dependencies import limiter
import pathlib
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse


# Import the hosts router
from routers.hosts_router import router as hosts_router
from routers.lighthouse_router import router as lighthouse_router
from routers.nebula_process_router import router as nebula_process_router
from routers.client_router import router as client_router
from routers.ca_router import router as ca_router
from routers.invites_router import router as invites_router 

# --- FastAPI Users imports & setup (new) ---
from typing import Optional, AsyncGenerator
import uuid
from fastapi import Request
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from sqlalchemy import select
from fastapi_users import FastAPIUsers
from fastapi_users.authentication import AuthenticationBackend, BearerTransport, JWTStrategy
from fastapi_users.db import SQLAlchemyBaseUserTableUUID, SQLAlchemyUserDatabase
from fastapi_users.manager import BaseUserManager, UUIDIDMixin

# Database (async SQLAlchemy)
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite+aiosqlite:///./nebula.db")
engine = create_async_engine(DATABASE_URL, echo=False)
async_session_maker = async_sessionmaker(engine, expire_on_commit=False)
Base = declarative_base()

# User table
class User(SQLAlchemyBaseUserTableUUID, Base):
    pass  # email, hashed_password, is_active, is_superuser, is_verified are inherited

# Pydantic schemas
class UserRead(BaseModel):
    id: uuid.UUID
    email: EmailStr
    is_active: bool
    is_superuser: bool
    is_verified: bool

    class Config:
        from_attributes = True

class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None
    is_superuser: Optional[bool] = None
    is_verified: Optional[bool] = None

# Dependencies to provide DB and user manager
async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session

async def get_user_db(session: AsyncSession = Depends(get_async_session)):
    yield SQLAlchemyUserDatabase(session, User)

class UserManager(UUIDIDMixin, BaseUserManager[User, uuid.UUID]):
    reset_password_token_secret = os.environ.get("JWT_SECRET", "CHANGE_ME")
    verification_token_secret = os.environ.get("JWT_SECRET", "CHANGE_ME")

    async def on_after_register(self, user: User, request: Optional[Request] = None):
        # Optional: send welcome/verification email, audit log, etc.
        pass

async def get_user_manager(user_db=Depends(get_user_db)):
    yield UserManager(user_db)

# Auth backend (JWT)
bearer_transport = BearerTransport(tokenUrl="auth/jwt/login")

def get_jwt_strategy() -> JWTStrategy:
    secret = os.environ.get("JWT_SECRET", "CHANGE_ME")
    lifetime = int(os.environ.get("JWT_LIFETIME", "3600"))
    return JWTStrategy(secret=secret, lifetime_seconds=lifetime)

auth_backend = AuthenticationBackend(
    name="jwt",
    transport=bearer_transport,
    get_strategy=get_jwt_strategy,
)

fastapi_users = FastAPIUsers[User, uuid.UUID](
    get_user_manager,
    [auth_backend],
)

current_active_user = fastapi_users.current_user(active=True)
current_superuser = fastapi_users.current_user(active=True, superuser=True)
# --- end FastAPI Users setup ---

# Use FastAPI lifespan event for startup config
@asynccontextmanager
async def lifespan(app):
    # Create DB tables on startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

app = FastAPI(
    lifespan=lifespan
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# --- FastAPI Users routers (new) ---
# Auth endpoints (login/logout with JWT)
app.include_router(
    fastapi_users.get_auth_router(auth_backend),
    prefix="/auth/jwt",
    tags=["auth"],
)
# Registration
app.include_router(
    fastapi_users.get_register_router(UserRead, UserCreate),
    prefix="/auth",
    tags=["auth"],
)
# Password reset
app.include_router(
    fastapi_users.get_reset_password_router(),
    prefix="/auth",
    tags=["auth"],
)
# Email verification
app.include_router(
    fastapi_users.get_verify_router(UserRead),
    prefix="/auth",
    tags=["auth"],
)
# Users management (superuser-only by default)
app.include_router(
    fastapi_users.get_users_router(UserRead, UserUpdate),
    prefix="/users",
    tags=["users"],
)
# --- end new routers ---

# Include the hosts router under the 'admin' prefix, secured by superuser
app.include_router(
    hosts_router,
    prefix="/admin",
    dependencies=[Depends(current_superuser)]
)
app.include_router(
    ca_router,
    prefix="/admin",
    dependencies=[Depends(current_superuser)]
)
app.include_router(
    lighthouse_router,
    prefix="/admin",
    dependencies=[Depends(current_superuser)]
)
app.include_router(
    nebula_process_router,
    prefix="/admin",
    dependencies=[Depends(current_superuser)]
)
app.include_router(
    invites_router,
    prefix="/admin",
    dependencies=[Depends(current_superuser)]
)

# Client router doesn't need admin auth
app.include_router(
    client_router,
    prefix="/client"
)

# Allow CORS for all origins (for development)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/admin/api/ping", dependencies=[Depends(current_superuser)])
def ping():
    return {"status": "ok"}

# --- Admin Users Management (list/update/delete) ---
class AdminUserUpdate(BaseModel):
    password: Optional[str] = None
    is_active: Optional[bool] = None
    is_superuser: Optional[bool] = None
    is_verified: Optional[bool] = None

class AdminUserRead(BaseModel):
    id: uuid.UUID
    email: EmailStr
    is_active: bool
    is_superuser: bool
    is_verified: bool

    class Config:
        from_attributes = True

@app.get("/admin/api/users", response_model=list[AdminUserRead], dependencies=[Depends(current_superuser)])
async def list_users(session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(select(User))
    users = result.scalars().all()
    return users

@app.patch("/admin/api/users/{user_id}", response_model=AdminUserRead, dependencies=[Depends(current_superuser)])
async def update_user(user_id: uuid.UUID, payload: AdminUserUpdate, session: AsyncSession = Depends(get_async_session), user_db=Depends(get_user_db), user_manager=Depends(get_user_manager)):
    # Load user
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Update fields
    to_update = {}
    if payload.is_active is not None:
        to_update["is_active"] = payload.is_active
    if payload.is_superuser is not None:
        to_update["is_superuser"] = payload.is_superuser
    if payload.is_verified is not None:
        to_update["is_verified"] = payload.is_verified
    if payload.password:
        # Hash password using the same helper as the app manager
        hashed = user_manager.password_helper.hash(payload.password)
        to_update["hashed_password"] = hashed

    if to_update:
        for k, v in to_update.items():
            setattr(user, k, v)
        session.add(user)
        await session.commit()
        await session.refresh(user)

    return user

@app.delete("/admin/api/users/{user_id}", dependencies=[Depends(current_superuser)])
async def delete_user(user_id: uuid.UUID, session: AsyncSession = Depends(get_async_session)):
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await session.delete(user)
    await session.commit()
    return {"status": "deleted"}
# --- end Admin Users Management ---



# Mount static files for frontend

frontend_dist = pathlib.Path(__file__).parent / "frontend" / "dist"
image_extensions = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico", ".bmp", ".tiff"}
if frontend_dist.exists():
    # Mount static files at /assets (Vite default)
    app.mount("/assets", StaticFiles(directory=frontend_dist / "assets"), name="assets")

    # SPA fallback and image serving for all other paths
    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str):
        # Restrict fallback for paths starting with /admin/api or /client/api
        if full_path.startswith("admin/api") or full_path.startswith("client/api"):
            return {"detail": "Not Found"}, 404

        file_path = frontend_dist / full_path
        ext = file_path.suffix.lower()
        if file_path.exists() and file_path.is_file() and ext in image_extensions:
            return FileResponse(file_path)
        index_file = frontend_dist / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        return {"detail": "Not Found"}, 404
