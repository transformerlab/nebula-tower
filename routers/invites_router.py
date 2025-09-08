import os
import yaml
from vars import DATA_DIR
from fastapi import HTTPException
from starlette.status import HTTP_500_INTERNAL_SERVER_ERROR
from pydantic import BaseModel
from typing import List
from fastapi import APIRouter
import datetime

INVITES_FILE = os.path.join(DATA_DIR, 'invites.yaml')

router = APIRouter()


class Invite(BaseModel):
    active: bool
    org: str
    date: str
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
                    if isinstance(expires_at, datetime.datetime):
                        date_str = expires_at.isoformat()
                    else:
                        date_str = str(expires_at) if expires_at is not None else ""
                    filtered_invites.append(
                        Invite(
                            org=item.get('org'),
                            date=date_str,
                            active=item.get('active'),
                            code=item.get('code')
                        )
                    )
                return InvitesResponse(invites=filtered_invites)
            else:
                return InvitesResponse(invites=[])
    except Exception as e:
        raise HTTPException(status_code=HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))