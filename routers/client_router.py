import json
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
import os
from datetime import datetime
from routers.ca_router import get_ca_cert_info
from routers.hosts_router import HostRequest, create_host as hosts_create_host, load_yaml, save_yaml, download_org_host_config
from vars import DATA_DIR
from dependencies import limiter
from vars import LIGHTHOUSE_IP
from nebula_api import NebulaAPI  # Add this import

router = APIRouter()

class ClientHostRequest(BaseModel):
    invite_code: str
    name: str
    tags: list[str]

nebula = NebulaAPI()  # Instantiate NebulaAPI

@router.get("/api/")
async def get_client_info(request: Request):
    # Implement your logic to retrieve client information
    return {"message": "Hello, this is the client API"}

#@TODO: cache the response
@router.get("/api/info")
async def get_client_info_details(request: Request):
    # Publish my external IP is LIGHTHOUSE_PUBLIC_IP
    public_ip = os.environ.get("LIGHTHOUSE_PUBLIC_IP", "unknown")
    nebula_ip = LIGHTHOUSE_IP
    server_is_running = nebula._nebula_proc is not None and nebula._nebula_proc.poll() is None
    cert_info = get_ca_cert_info()
    cert_info = cert_info.get("info", "{}")
    cert_info = json.loads(cert_info)
    print(cert_info)
    cert_info = cert_info[0].get("details", {})
    company_name = cert_info.get("name", "unknown")

    return {
        "message": "This is a Nebula Tower Instance",
        "company_name": company_name,
        "public_ip": public_ip,
        "nebula_ip": nebula_ip,
        "lighthouse_is_running": server_is_running,
    }

@router.get("/api/redeem_invite")
@limiter.limit("5/minute")
async def create_host_using_invite(request: Request):
    invite_code = request.query_params.get("invite_code")
    name = request.query_params.get("name", "host")  # Set default name to "host"
    tags = request.query_params.getlist("tags")

    invites_file = os.path.join(DATA_DIR, "invites.yaml")
    if not os.path.exists(invites_file):
        raise HTTPException(status_code=400, detail="Invites file not found")
    invites = load_yaml(invites_file, default=[])
    invite = next((i for i in invites if i.get("code") == invite_code), None)
    if not invite:
        raise HTTPException(status_code=400, detail="Invalid invite code")
    if not invite.get("active", True):
        raise HTTPException(status_code=400, detail="Invite code already used")
    if "expires_at" in invite:
        expires_at = invite["expires_at"]
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)
        if expires_at < datetime.utcnow():
            raise HTTPException(status_code=400, detail="Invite code expired")
    org = invite.get("org")
    if not org:
        raise HTTPException(status_code=400, detail="Invite code missing org")
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    host_req = HostRequest(name=name, org=org, tags=tags)
    result = await hosts_create_host(host_req)

    # Mark invite as inactive
    for i in invites:
        if i.get("code") == invite_code:
            i["available_uses"] = i.get("available_uses", 1) - 1
            if i["available_uses"] <= 0:
                i["active"] = False
    save_yaml(invites_file, invites)

    returned_name = result["name"]

    return await download_org_host_config(org_name=org, host_name=returned_name)
