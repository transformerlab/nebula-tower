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
                            code=item.get('code')
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
async def generate_invite(org: str, days_valid: int = 7):
    org = sanitize_string(org)

    if not os.path.exists(ORGS_DIR):
        raise HTTPException(status_code=404, detail="Org directory does not exist")

    org_dir = os.path.join(ORGS_DIR, org)
    if not os.path.isdir(org_dir):
        raise HTTPException(status_code=404, detail=f"Org '{org}' not found")

    invite_code = generate_random_code()
    invite = {
        "code": invite_code,
        "org": org,
        "expires_at": datetime.utcnow() + timedelta(days=days_valid),
        "active": True  # Set active True by default
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