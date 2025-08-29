import { Sheet, Card, Box, IconButton } from "@mui/joy"
import useSWR, { mutate } from 'swr';
import API_BASE_URL from './apiConfig';
import { PlayCircle, StopCircle } from "lucide-react";
import { useState } from 'react';
import { useAdminFetcher, useAdminPassword } from './context/adminContext';




function NebulaProcessStatusCard({ disableButtons = false }) {
    const fetcher = useAdminFetcher();
    const adminPassword = useAdminPassword();
    const { data, mutate, isLoading } = useSWR(
        `${API_BASE_URL}/admin/api/nebula_process/status`,
        fetcher,
        { refreshInterval: 1500 }
    );
    const status = data?.status ?? (data ? JSON.stringify(data) : null);
    const [loading, setLoading] = useState(false);

    const handleStart = async () => {
        setLoading(true)
        try {
            await fetch(`${API_BASE_URL}/admin/api/nebula_process/start`, {
                method: "POST",
                headers: {
                    'Authorization': `Bearer ${adminPassword}`
                }
            })
            mutate();
        } finally {
            setLoading(false)
        }
    }

    const handleStop = async () => {
        setLoading(true)
        try {
            await fetch(`${API_BASE_URL}/admin/api/nebula_process/stop`, {
                method: "POST",
                headers: {
                    'Authorization': `Bearer ${adminPassword}`
                }
            })
            mutate();
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
                <IconButton onClick={handleStart} disabled={loading || disableButtons} sx={{ ml: 1 }} >
                    <PlayCircle />
                </IconButton>
            )}
            {status === "running" && (
                <IconButton onClick={handleStop} disabled={loading} sx={{ ml: 1 }} >
                    <StopCircle />
                </IconButton>
            )}
        </Sheet>
    )
}

export default NebulaProcessStatusCard