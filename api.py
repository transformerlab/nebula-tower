from fastapi import FastAPI, HTTPException, Depends, Header
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
import os
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from dependencies import limiter


# Import the hosts router
from routers.hosts_router import router as hosts_router
from routers.lighthouse_router import router as lighthouse_router
from routers.nebula_process_router import router as nebula_process_router
from routers.client_router import router as client_router
from routers.ca_router import router as ca_router


# Use FastAPI lifespan event for startup config
@asynccontextmanager
async def lifespan(app):
    yield

def check_admin_password(authorization: str = Header(None)):
    expected = os.environ.get("ADMIN_PASSWORD")
    if not expected:
        raise HTTPException(status_code=500, detail="ADMIN_PASSWORD not set in environment.")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header.")
    token = authorization.removeprefix("Bearer ").strip()
    if token != expected:
        raise HTTPException(status_code=401, detail="Invalid admin password.")

app = FastAPI(
    lifespan=lifespan
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# Include the hosts router under the 'admin' prefix, with dependency
app.include_router(
    hosts_router,
    prefix="/admin",
    dependencies=[Depends(check_admin_password)]
)
app.include_router(
    ca_router,
    prefix="/admin",
    dependencies=[Depends(check_admin_password)]
)
app.include_router(
    lighthouse_router,
    prefix="/admin",
    dependencies=[Depends(check_admin_password)]
)
app.include_router(
    nebula_process_router,
    prefix="/admin",
    dependencies=[Depends(check_admin_password)]
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

@app.get("/admin/api/ping", dependencies=[Depends(check_admin_password)])
def ping():
    return {"status": "ok"}

