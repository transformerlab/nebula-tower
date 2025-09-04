import useSWR, { mutate } from 'swr';
import { useState } from 'react';
import { Box, Typography, Sheet, CircularProgress, Alert, Button } from '@mui/joy';
import API_BASE_URL from './apiConfig';
import { useAuthedFetcher, useAuthedFetch } from './lib/api';

export default function Lighthouse() {
  const fetcher = useAuthedFetcher();
  const authedFetch = useAuthedFetch();
  const { data: config, error, isLoading } = useSWR(
    `${API_BASE_URL}/admin/api/lighthouse/config`,
    fetcher
  );
  const [recreateLoading, setRecreateLoading] = useState(false);
  const [recreateError, setRecreateError] = useState(null);

  const handleRecreate = async () => {
    if (!confirm("Recreating the config will destroy your lighthouse configuration. Are you sure?")) {
      return;
    }
    setRecreateLoading(true);
    setRecreateError(null);
    try {
      const res = await authedFetch(`/admin/api/lighthouse/create_config`, {
        method: 'POST'
      });
      if (!res.ok) {
        setRecreateError('Failed to recreate config');
      } else {
        mutate(`${API_BASE_URL}/admin/api/lighthouse/config`);
      }
    } catch {
      setRecreateError('Failed to recreate config');
    }
    setRecreateLoading(false);
  };

  const isMissingConfig = !config || Object.values(config).some(v => v == null);

  return (
    <Sheet sx={{ minWidth: 700, mx: 'auto', p: 2 }}>
      <Typography level="h1" fontSize="2rem" mb={2}>Lighthouse Config</Typography>
      {isLoading ? <CircularProgress /> : (
        <Box>
          {isMissingConfig && (
            <Alert color="warning" sx={{ mb: 2 }}>
              Some config or certs are missing in data/lighthouse.
            </Alert>
          )}
          <Typography level="body-lg" mb={1}>External IP: {config?.external_ip ?? '[Missing external IP]'}</Typography>
          <Typography level="body-lg" mb={1}>Port: {config?.port ?? '[Missing port]'}</Typography>
          <Typography level="body-lg" mb={1}>Internal IP: {config?.internal_ip ?? '[Missing internal IP]'}</Typography>
          <Typography level="body-lg" mb={1}>Config file (config.yaml):</Typography>
          <pre style={{ background: '#f4f4f4', padding: 16, borderRadius: 4, overflowX: 'auto' }}>
            {config?.config ?? '[Missing config.yaml]'}
          </pre>
          <Typography level="body-lg" mt={2} mb={1}>CA cert (ca.crt):</Typography>
          <pre style={{ background: '#f4f4f4', padding: 16, borderRadius: 4, overflowX: 'auto' }}>
            {config?.ca_cert ?? '[Missing ca.crt]'}
          </pre>
          <Typography level="body-lg" mt={2} mb={1}>Host cert (host.crt):</Typography>
          <pre style={{ background: '#f4f4f4', padding: 16, borderRadius: 4, overflowX: 'auto' }}>
            {config?.host_cert ?? '[Missing host.crt]'}
          </pre>
          <Typography level="body-lg" mt={2} mb={1}>Host key (host.key):</Typography>
          <pre style={{ background: '#f4f4f4', padding: 16, borderRadius: 4, overflowX: 'auto' }}>
            {config?.host_key ?? '[Missing host.key]'}
          </pre>
        </Box>
      )}
      {error && <Alert color="danger" sx={{ mt: 2 }}>{error.message || 'Failed to load config'}</Alert>}
      <Button
        color="danger"
        variant="solid"
        onClick={handleRecreate}
        loading={recreateLoading}
        sx={{ mb: 2 }}
      >
        Recreate lighthouse config and certs
      </Button>
      {recreateError && <Alert color="danger" sx={{ mb: 2 }}>{recreateError}</Alert>}
    </Sheet>
  );
}

