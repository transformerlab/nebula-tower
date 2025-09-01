from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
import os
from datetime import datetime
from routers.hosts_router import HostRequest, sanitize_string, create_host as hosts_create_host, load_yaml, save_yaml, download_org_host_config
from vars import DATA_DIR
from dependencies import limiter


router = APIRouter()

class ClientHostRequest(BaseModel):
    invite_code: str
    name: str
    tags: list[str]


@router.post("/api/client/redeem_invite")
@limiter.limit("5/minute")
async def create_host_using_invite(req: ClientHostRequest, request: Request):
    invite_code = sanitize_string(req.invite_code)
    name = sanitize_string(req.name)
    tags = [sanitize_string(t) for t in req.tags]

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

    host_req = HostRequest(name=name, org=org, tags=tags)
    result = await hosts_create_host(host_req)

    # Mark invite as inactive
    for i in invites:
        if i.get("code") == invite_code:
            i["active"] = False
    save_yaml(invites_file, invites)

    returned_name = result["name"]

    return await download_org_host_config(org_name=org, host_name=returned_name)


