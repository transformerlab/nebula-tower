import { useEffect, useState } from 'react';
import { Box, Typography, Sheet, CircularProgress, Alert } from '@mui/joy';
import API_BASE_URL from './apiConfig';


export default function Lighthouse() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchConfig = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE_URL}/api/config/lighthouse`);
        if (res.status === 404) {
          setConfig(null);
        } else if (res.ok) {
          const text = await res.text();
          setConfig(text);
        } else {
          setError('Failed to load config');
        }
      } catch (e) {
        setError('Failed to load config');
      }
      setLoading(false);
    };
    fetchConfig();
  }, []);

  return (
    <Sheet sx={{ minWidth: 700, mx: 'auto', my: 4, p: 4 }}>
      <Typography level="h1" fontSize="2rem" mb={2}>Lighthouse Config</Typography>
      {loading ? <CircularProgress /> : (
        config === null ? (
          <Alert color="warning">No config exists at /data/lighthouse.yaml</Alert>
        ) : (
          <Box>
            <Typography level="body-lg" mb={1}>Config file at /data/lighthouse.yaml:</Typography>
            <pre style={{ background: '#f4f4f4', padding: 16, borderRadius: 4, overflowX: 'auto' }}>{config}</pre>
          </Box>
        )
      )}
      {error && <Alert color="danger" sx={{ mt: 2 }}>{error}</Alert>}
    </Sheet>
  );
}
