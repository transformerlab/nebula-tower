import { useEffect, useState } from 'react';
import API_BASE_URL from './apiConfig';
import { Box, Button, Input, Typography, Sheet, CircularProgress, Alert } from '@mui/joy';
import { Link } from 'react-router-dom';
export default function Cert() {
  const [loading, setLoading] = useState(true);
  const [cert, setCert] = useState(null);
  const [keyExists, setKeyExists] = useState(false);
  const [certInfo, setCertInfo] = useState(null);
  const [error, setError] = useState(null);
  const [orgName, setOrgName] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchCert = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/ca`);
      const data = await res.json();
      setCert(data.cert);
      setKeyExists(data.key_exists);
      if (data.exists) {
        // Fetch cert info
        const infoRes = await fetch(`${API_BASE_URL}/api/ca/info`);
        if (infoRes.ok) {
          const infoData = await infoRes.json();
          let parsed = null;
          try {
            parsed = typeof infoData.info === 'string' ? JSON.parse(infoData.info) : infoData.info;
          } catch (e) { }
          setCertInfo(parsed);
        } else {
          setCertInfo(null);
        }
      } else {
        setCertInfo(null);
      }
    } catch (e) {
      setError('Failed to load certificate info.');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCert();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/ca`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: orgName })
      });
      if (res.ok) {
        setOrgName('');
        fetchCert();
      } else {
        const err = await res.json();
        setError(err.detail || 'Failed to create CA cert.');
      }
    } catch (e) {
      setError('Failed to create CA cert.');
    }
    setCreating(false);
  };

  return (
    <Sheet sx={{ maxWidth: 600, mx: 'auto', my: 4, p: 4 }}>
      <Typography level="h1" fontSize="2rem" mb={2}>CA Certificate Manager</Typography>
      <Button onClick={fetchCert} sx={{ mb: 2 }}>Refresh CA Cert</Button>
      {loading ? <CircularProgress /> : (
        <>
          {cert ? (
            <Box className="cert-box" sx={{ background: '#f4f4f4', p: 2, borderRadius: 2, mt: 2, overflow: 'hidden' }}>
              <Typography level="h3">CA Certificate</Typography>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{cert}</pre>
              <Typography><b>CA Key:</b> {keyExists ? 'Exists' : 'Not found'}</Typography>
              {certInfo && certInfo.details && (
                <Box sx={{ mt: 2 }}>
                  <Typography level="h4">Certificate Info</Typography>
                  <ul style={{ textAlign: 'left' }}>
                    <li><b>Name:</b> {certInfo.details.name}</li>
                    <li><b>Is CA:</b> {certInfo.details.isCa ? 'Yes' : 'No'}</li>
                    <li><b>Issuer:</b> {certInfo.details.issuer || '-'}</li>
                    <li><b>Curve:</b> {certInfo.details.curve}</li>
                    <li><b>Valid From:</b> {certInfo.details.notBefore}</li>
                    <li><b>Valid To:</b> {certInfo.details.notAfter}</li>
                    <li><b>Public Key:</b> <code>{certInfo.details.publicKey}</code></li>
                    <li><b>Fingerprint:</b> <code>{certInfo.fingerprint}</code></li>
                    <li><b>Signature:</b> <code>{certInfo.signature}</code></li>
                  </ul>
                </Box>
              )}
            </Box>
          ) : (
            <Box>
              <Typography>No CA certificate found.</Typography>
              <Typography><b>CA Key:</b> {keyExists ? 'Exists' : 'Not found'}</Typography>
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
      {error && <Alert color="danger" sx={{ mt: 2 }}>{error}</Alert>}
      <Button component={Link} to="/" sx={{ mt: 4 }}>Back to Home</Button>
    </Sheet>
  );
}