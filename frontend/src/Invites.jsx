import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import API_BASE_URL from './apiConfig';
import { Box, Button, Input, Typography, Sheet, CircularProgress, Alert } from '@mui/joy';
import { useAuthedFetcher } from './lib/api';

export default function Invites() {
  const fetcher = useAuthedFetcher();

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
    } catch {
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
      const res = await fetcher(`/admin/api/ca`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    } catch {
      setError('Failed to create CA cert.');
    }
    setCreating(false);
  };

  const loading = caLoading || (shouldFetchInfo && infoLoading);

  let certExpiresIn = certInfo && certInfo.details && certInfo.details.notAfter && !isNaN(new Date(certInfo.details.notAfter))
    ? Math.round((new Date(certInfo.details.notAfter) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <Sheet sx={{ minWidth: 700, mx: 'auto', p: 2, width: '100%' }}>
      <Typography level="h1" fontSize="2rem" mb={2}>CA Certificate</Typography>
      {certExpiresIn !== null && certExpiresIn < 120 && (
        <Alert color="warning" sx={{ mb: 2 }}>
          Warning: The certificate is expiring in {certExpiresIn} days. Please renew it soon. https://nebula.defined.net/docs/guides/rotating-certificate-authority/
        </Alert>
      )}
      {loading ? <CircularProgress /> : (
        <>
          {caData && caData.cert ? (
            <Box className="cert-box" sx={{ p: 2, borderRadius: 2, mt: 2, overflow: 'hidden' }}>
              <Typography level="h3">CA Certificate</Typography>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{caData.cert}</pre>
              <Typography level="h3"><b>CA Key:</b></Typography>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{caData?.key}{caData?.key && '.. (rest hidden)'}</pre>
              {certInfo && certInfo.details && (
                <Box sx={{ mt: 2, overflow: 'hidden', maxWidth: '500px' }}>
                  <Typography level="h3">Certificate Info</Typography>
                  <ul style={{ textAlign: 'left' }}>
                    <li><b>Organization Name:</b> {certInfo.details.name}</li>
                    <li><b>Is CA:</b> {certInfo.details.isCa ? 'Yes' : 'No'}</li>
                    <li><b>Issuer:</b> {certInfo.details.issuer || '-'}</li>
                    <li><b>Curve:</b> {certInfo.curve}</li>
                    <li><b>Valid From:</b> {new Date(certInfo.details.notBefore).toLocaleString()}</li>
                    <li>
                      <b>Valid To:</b> {new Date(certInfo.details.notAfter).toLocaleString()}
                      <span style={{ color: certExpiresIn < 120 ? 'red' : 'inherit' }}>
                        expires in {certExpiresIn} days
                      </span>
                    </li>
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