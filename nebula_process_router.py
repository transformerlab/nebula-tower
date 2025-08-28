from fastapi import APIRouter
from nebula_api import NebulaAPI

# Import or define the NebulaAPI instance
nebula = NebulaAPI()
 
router = APIRouter()

# Use nebula_api to check on the status of the nebula process:
@router.get('/api/nebula_process/status')
def get_nebula_process_status():
    if nebula._nebula_proc:
        return {"status": "running", "pid": nebula._nebula_proc.pid}
    return {"status": "stopped"}

@router.post('/api/nebula_process/start')
def start_nebula_process():
    if nebula._nebula_proc and nebula._nebula_proc.poll() is None:
        return {"status": "already running", "pid": nebula._nebula_proc.pid}
    nebula.run_nebula_tracked("./data/lighthouse/config.yaml")  # Assumes NebulaAPI has a start() method
    if nebula._nebula_proc:
        return {"status": "started", "pid": nebula._nebula_proc.pid}
    return {"status": "failed to start"}

@router.post('/api/nebula_process/stop')
def stop_nebula_process():
    if not nebula._nebula_proc or nebula._nebula_proc.poll() is not None:
        return {"status": "already stopped"}
    nebula.stop_nebula_tracked()  # Assumes NebulaAPI has a stop() method
    return {"status": "stopped"}

