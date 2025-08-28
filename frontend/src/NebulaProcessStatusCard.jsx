import { Sheet, Card, Box, IconButton } from "@mui/joy"
import { useEffect, useState } from "react"
import API_BASE_URL from './apiConfig';
import { PlayCircle, StopCircle } from "lucide-react";

function NebulaProcessStatusCard() {
    const [status, setStatus] = useState(null)
    const [loading, setLoading] = useState(false);

    const fetchStatus = async (isMounted = true) => {
        try {
            const infoRes = await fetch(`${API_BASE_URL}/api/nebula_process/status`)
            if (!infoRes.ok) return
            const data = await infoRes.json()
            if (isMounted) setStatus(data.status ?? JSON.stringify(data))
        } catch (e) {
            if (isMounted) setStatus("Error")
        }
    }

    useEffect(() => {
        let isMounted = true
        fetchStatus(isMounted)
        const interval = setInterval(() => fetchStatus(isMounted), 1500)
        return () => {
            isMounted = false
            clearInterval(interval)
        }
    }, [])

    const handleStart = async () => {
        setLoading(true)
        try {
            await fetch(`${API_BASE_URL}/api/nebula_process/start`, { method: "POST" })
            // status will auto-refresh
        } finally {
            setLoading(false)
        }
    }

    const handleStop = async () => {
        setLoading(true)
        try {
            await fetch(`${API_BASE_URL}/api/nebula_process/stop`, { method: "POST" })
            // status will auto-refresh
        } finally {
            setLoading(false)
        }
    }

    return (
        <Sheet variant="outlined" sx={{ mt: 2, p: 2, borderRadius: 'md', alignItems: 'center', display: 'flex' }}>
            {status === "running" && (
                <span style={{
                    display: "inline-block",
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    backgroundColor: "green",
                    marginRight: 8,
                    verticalAlign: "middle"
                }} />
            )}
            {status === "stopped" && (
                <span style={{
                    display: "inline-block",
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    backgroundColor: "red",
                    marginRight: 8,
                    verticalAlign: "middle"
                }} />
            )}
            Lighthouse
            {/* Nebula {status === null ? "Loading..." : status} */}
            {status === "stopped" && (
                <IconButton onClick={handleStart} disabled={loading} sx={{ ml: 1 }}>
                    <PlayCircle />
                </IconButton>
            )}
            {status === "running" && (
                <IconButton onClick={handleStop} disabled={loading} sx={{ ml: 1 }}>
                    <StopCircle />
                </IconButton>
            )}
        </Sheet>
    )
}

export default NebulaProcessStatusCard