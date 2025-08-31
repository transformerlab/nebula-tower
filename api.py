from fastapi import FastAPI, HTTPException, Depends, Header
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from nebula_api import NebulaAPI
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from dependencies import limiter


# Import the hosts router
from routers.hosts_router import router as hosts_router
from routers.lighthouse_router import router as lighthouse_router
from routers.nebula_process_router import router as nebula_process_router
from routers.client_router import router as client_router


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

nebula = NebulaAPI()

CA_CERT_PATH = "ca.crt"  # Adjust as needed
CA_KEY_PATH = "ca.key"  # Adjust as needed
CERTS_DIR = "./data/certs"

# Compute cert_dir, cert_path, key_path once
cert_dir = CERTS_DIR
cert_path = os.path.join(cert_dir, CA_CERT_PATH)
key_path = os.path.join(cert_dir, CA_KEY_PATH)

class CreateCARequest(BaseModel):
    name: str

@app.get("/admin/api/ping", dependencies=[Depends(check_admin_password)])
def ping():
    return {"status": "ok"}

@app.get("/admin/api/ca", dependencies=[Depends(check_admin_password)])
def get_ca_cert():
    # Use precomputed cert_dir, cert_path, key_path
    cert_exists = os.path.exists(cert_path)
    key_exists = os.path.exists(key_path)
    cert_content = None
    key_content = None

    if cert_exists:
        try:
            with open(cert_path, "r") as f:
                cert_content = f.read()
        except PermissionError:
            raise HTTPException(status_code=403, detail="Permission denied when accessing the certificate file.")
    
    if key_exists:
        try:
            with open(key_path, "r") as f:
                key_content = f.read()[:32]  # Only show the first 32 characters of the key
        except PermissionError:
            raise HTTPException(status_code=403, detail="Permission denied when accessing the key file.")
    
    return {"exists": cert_exists, "cert": cert_content, "key_exists": key_exists, "key": key_content}

@app.post("/admin/api/ca", dependencies=[Depends(check_admin_password)])
def create_ca_cert(req: CreateCARequest):
    # Use precomputed cert_dir, cert_path, key_path
    if not os.path.exists(cert_dir):
        os.makedirs(cert_dir)
    
    if os.path.exists(cert_path):
        raise HTTPException(status_code=400, detail="CA certificate already exists.")
    
    # Run nebula-cert ca -name <name> -out-crt <cert_path> -out-key <key_path>
    result = nebula.cert_mode("ca", ["-name", req.name, "-out-crt", cert_path, "-out-key", key_path])
    
    if os.path.exists(cert_path):
        with open(cert_path, "r") as f:
            return {"created": True, "cert": f.read(), "output": result}
    
    raise HTTPException(status_code=500, detail="Failed to create CA certificate. Output: " + result)

@app.get("/admin/api/ca/info", dependencies=[Depends(check_admin_password)])
def get_ca_cert_info():
    # Use precomputed cert_path
    if not os.path.exists(cert_path):
        raise HTTPException(status_code=404, detail="CA certificate not found.")
    
    info = nebula.cert_mode("print", ["-json", "-path", cert_path])
    return {"info": info}

