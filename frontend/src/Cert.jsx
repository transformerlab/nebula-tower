import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import API_BASE_URL from './apiConfig';
import { Box, Button, Input, Typography, Sheet, CircularProgress, Alert } from '@mui/joy';
import { useAdminFetcher, useAdminPassword } from './context/adminContext';

export default function Cert() {
  const fetcher = useAdminFetcher();
  const { adminPassword } = useAdminPassword();

  const [orgName, setOrgName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  // SWR for CA cert
  const { data: caData, error: caError, isLoading: caLoading } = useSWR(
    `${API_BASE_URL}/admin/api/ca`,
    fetcher
  );

  // SWR for CA info (only fetch if CA exists)
  const shouldFetchInfo = caData && caData.exists;
  const { data: infoData, error: infoError, isLoading: infoLoading } = useSWR(
    shouldFetchInfo ? `${API_BASE_URL}/admin/api/ca/info` : null,
    fetcher
  );

  // Parse certInfo
  let certInfo = null;
  if (infoData && infoData.info) {
    try {
      let parsedArr = typeof infoData.info === 'string'
        ? JSON.parse(infoData.info)
        : infoData.info;
      certInfo = Array.isArray(parsedArr) && parsedArr.length > 0 ? parsedArr[0] : null;
    } catch (e) {
      certInfo = null;
    }
  }

  const handleRefresh = () => {
    mutate(`${API_BASE_URL}/admin/api/ca`);
    if (shouldFetchInfo) mutate(`${API_BASE_URL}/admin/api/ca/info`);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/api/ca`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminPassword}`
        },
        body: JSON.stringify({ name: orgName })
      });
      if (res.ok) {
        setOrgName('');
        mutate(`${API_BASE_URL}/admin/api/ca`);
        mutate(`${API_BASE_URL}/admin/api/ca/info`);
      } else {
        const err = await res.json();
        setError(err.detail || 'Failed to create CA cert.');
      }
    } catch (e) {
      setError('Failed to create CA cert.');
    }
    setCreating(false);
  };

  const loading = caLoading || (shouldFetchInfo && infoLoading);

  return (
    <Sheet sx={{ minWidth: 700, mx: 'auto', p: 2 }}>
      <Typography level="h1" fontSize="2rem" mb={2}>CA Certificate Manager</Typography>
      <Button onClick={handleRefresh} sx={{ mb: 2 }}>Refresh</Button>
      {loading ? <CircularProgress /> : (
        <>
          {caData && caData.cert ? (
            <Box className="cert-box" sx={{ p: 2, borderRadius: 2, mt: 2, overflow: 'hidden' }}>
              <Typography level="h3">CA Certificate</Typography>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{caData.cert}</pre>
              <Typography level="h4"><b>CA Key:</b> {caData.key_exists ? 'Exists' : 'Not found'}</Typography>
              {certInfo && certInfo.details && (
                <Box sx={{ mt: 2 }}>
                  <Typography level="h4">Certificate Info</Typography>
                  <ul style={{ textAlign: 'left' }}>
                    <li><b>Name:</b> {certInfo.details.name}</li>
                    <li><b>Is CA:</b> {certInfo.details.isCa ? 'Yes' : 'No'}</li>
                    <li><b>Issuer:</b> {certInfo.details.issuer || '-'}</li>
                    <li><b>Curve:</b> {certInfo.curve}</li>
                    <li><b>Valid From:</b> {certInfo.details.notBefore}</li>
                    <li><b>Valid To:</b> {certInfo.details.notAfter}</li>
                    <li><b>Public Key:</b> <code>{certInfo.publicKey}</code></li>
                    <li><b>Fingerprint:</b> <code>{certInfo.fingerprint}</code></li>
                    <li><b>Signature:</b> <code>{certInfo.signature}</code></li>
                  </ul>
                </Box>
              )}
            </Box>
          ) : (
            <Box>
              <Typography>No CA certificate found.</Typography>
              <Typography level="h2"><b>CA Key:</b> {caData && caData.key_exists ? 'Exists' : 'Not found'}</Typography>
              <form onSubmit={handleCreate} style={{ marginTop: 16 }}>
                <Input
                  placeholder="Organization Name"
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  required
                  sx={{ mb: 2 }}
                />
                <Button type="submit" loading={creating}>Create CA</Button>
              </form>
            </Box>
          )}
        </>
      )}
      {(error || caError || infoError) && (
        <Alert color="danger" sx={{ mt: 2 }}>
          {error || caError?.message || infoError?.message || 'Failed to load certificate info.'}
        </Alert>
      )}
    </Sheet>
  );
}