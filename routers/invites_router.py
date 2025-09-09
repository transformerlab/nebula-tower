import os
import yaml
from fastapi import HTTPException
from starlette.status import HTTP_500_INTERNAL_SERVER_ERROR
from pydantic import BaseModel
from typing import List
from fastapi import APIRouter
import re


from vars import DATA_DIR, ORGS_DIR
import secrets
import string
from datetime import datetime, timedelta

INVITES_FILE = os.path.join(DATA_DIR, 'invites.yaml')

router = APIRouter()


class Invite(BaseModel):
    active: bool
    org: str
    expires_at: str
    code: str
    available_uses: int = 1  # Default to 1 if not specified

class InvitesResponse(BaseModel):
    invites: List[Invite]

@router.get("/api/invites", response_model=InvitesResponse)
def get_invites(org: str = None, active: bool = None):
    if not os.path.exists(INVITES_FILE):
        return InvitesResponse(invites=[])
    try:
        with open(INVITES_FILE, 'r') as f:
            data = yaml.safe_load(f)
            if isinstance(data, list):
                filtered_invites = []
                for item in data:
                    if org and item.get('org') != org:
                        continue
                    if active is not None and item.get('active') != active:
                        continue
                    expires_at = item.get('expires_at')
                    # Ensure date is a string
                    if isinstance(expires_at, datetime):
                        date_str = expires_at.isoformat()
                    else:
                        date_str = str(expires_at) if expires_at is not None else ""
                    filtered_invites.append(
                        Invite(
                            org=item.get('org'),
                            expires_at=date_str,
                            active=item.get('active'),
                            code=item.get('code'),
                            available_uses=item.get('available_uses', 1)
                        )
                    )
                return InvitesResponse(invites=filtered_invites)
            else:
                return InvitesResponse(invites=[])
    except Exception as e:
        raise HTTPException(status_code=HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# Generate Invite Code adds to a file called invites.yaml in the root of the DATA_DIR
# (it creates the file if missing). And in each invite, you have a randomized code
# with high entropy, an org, and a date when it expires
@router.post("/api/invites/generate")
async def generate_invite(org: str, days_valid: int = 7, uses: int = 1):
    org = sanitize_string(org)

    if not os.path.exists(ORGS_DIR):
        raise HTTPException(status_code=404, detail="Org directory does not exist")

    org_dir = os.path.join(ORGS_DIR, org)
    if not os.path.isdir(org_dir):
        raise HTTPException(status_code=404, detail=f"Org '{org}' not found")
    
    if (days_valid <= 0):
        raise HTTPException(status_code=400, detail="days_valid must be a positive integer")
    if (uses < 1):
        raise HTTPException(status_code=400, detail="uses must be a positive integer")

    invite_code = generate_random_code()
    invite = {
        "code": invite_code,
        "org": org,
        "expires_at": datetime.utcnow() + timedelta(days=days_valid),
        "active": True,  # Set active True by default
        "available_uses": uses
    }

    invites_file = os.path.join(DATA_DIR, "invites.yaml")
    save_invite(invites_file, invite)

    return {"invite": invite}

def generate_random_code(length=32):
    """
    Generate a high-entropy random invite code.
    """
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))

def save_invite(invites_file, invite):
    """
    Save an invite to the invites.yaml file. Appends to the list if file exists, otherwise creates a new list.
    """
    if os.path.exists(invites_file):
        with open(invites_file, "r") as f:
            invites = yaml.safe_load(f) or []
    else:
        invites = []
    invites.append(invite)
    with open(invites_file, "w") as f:
        yaml.safe_dump(invites, f)


def sanitize_string(s):
    if not isinstance(s, str):
        return ""
    sanitized = re.sub(r'[^a-zA-Z0-9]', '', s.lower())
    return sanitized


# Mark Invite as Inactive
@router.delete("/api/invites/{code}")
async def deactivate_invite(code: str):
    if not os.path.exists(INVITES_FILE):
        raise HTTPException(status_code=404, detail="Invites file does not exist")
    try:
        with open(INVITES_FILE, 'r') as f:
            invites = yaml.safe_load(f) or []
        invite_found = False
        for invite in invites:
            if invite.get('code') == code:
                invite['active'] = False
                invite_found = True
                break
        if not invite_found:
            raise HTTPException(status_code=404, detail="Invite code not found")
        with open(INVITES_FILE, 'w') as f:
            yaml.safe_dump(invites, f)
        return {"detail": "Invite marked as inactive successfully"}
    except Exception as e:
        raise HTTPException(status_code=HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))