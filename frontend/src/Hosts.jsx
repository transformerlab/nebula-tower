import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import ip6 from 'ip6'; // Import the ip6 library
import { Box, Button, Typography, Sheet, List, ListItem, Input, Table, Modal, ModalDialog, ModalClose } from '@mui/joy';
import API_BASE_URL from './apiConfig';
import { useAdminFetcher, useAdminPassword } from './context/adminContext';


function formatHostIP(ip) {
  try {
    // Normalize the incoming IPv6 address to its full form
    // console.log('Normalizing IPv6 address:', ip);
    const ipv6Full = ip6.normalize(ip);

    // Split into groups and wrap each group in a box
    const groups = ipv6Full.split(':').map((group, index) => (
      <Box
        key={index}
        sx={{
          display: 'inline-block',
          padding: '4px 8px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          margin: '0 2px',
          fontFamily: 'monospace',
        }}
      >
        {group}
      </Box>
    ));

    // Wrap groups in colored boxes
    return (
      <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
        <Box sx={{ display: 'inline-flex', backgroundColor: '#aaa', border: '2px solid #aaa', borderRadius: '4px', padding: '4px', marginRight: '4px' }}>
          {groups.slice(0, 3)}
        </Box>
        <Box sx={{ display: 'inline-flex', border: '2px solid blue', borderRadius: '4px', padding: '4px', marginRight: '4px' }}>
          {groups.slice(3, 4)}
        </Box>
        <Box sx={{ display: 'inline-flex', border: '2px solid green', borderRadius: '4px', padding: '4px' }}>
          {groups.slice(4)}
        </Box>
      </Box>
    );
  } catch (error) {
    console.error('Invalid IPv6 address:', ip);
    return <Typography color="danger">Invalid IP</Typography>;
  }
}

function Hosts() {
  const fetcher = useAdminFetcher();
  const { adminPassword } = useAdminPassword();
  const [selectedOrg, setSelectedOrg] = useState('');
  const [hostsFilter, setHostsFilter] = useState(''); // not used, but for future
  const [name, setName] = useState('');
  const [tags, setTags] = useState(''); // comma separated
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedHost, setSelectedHost] = useState(null);
  const [newOrgName, setNewOrgName] = useState('');
  const [orgCreateError, setOrgCreateError] = useState('');
  const [orgCreateLoading, setOrgCreateLoading] = useState(false);

  // SWR for orgs
  const { data: orgsData, error: orgsError, isLoading: orgsLoading } = useSWR(
    `${API_BASE_URL}/admin/api/orgs`,
    fetcher
  );
  const orgs = orgsData?.orgs || [];

  // Find and set subnet for selected org
  const selectedOrgSubnet = orgs.find(o => o.name === selectedOrg)?.subnet || '';

  // SWR for hosts in selected org
  const { data: hostsData, error: hostsError, isLoading: hostsLoading } = useSWR(
    selectedOrg ? `${API_BASE_URL}/admin/api/orgs/${encodeURIComponent(selectedOrg)}/hosts` : null,
    fetcher
  );
  const hosts = hostsData?.hosts || [];

  // SWR for host details
  const { data: hostDetailsData, error: hostDetailsError, isLoading: hostDetailsLoading } = useSWR(
    selectedHost && selectedOrg
      ? `${API_BASE_URL}/admin/api/orgs/${encodeURIComponent(selectedOrg)}/hosts/${encodeURIComponent(selectedHost)}`
      : null,
    fetcher
  );
  const hostDetails = hostDetailsData?.host || null;

  const handleAdd = async () => {
    setError('');
    if (!selectedOrg || !name) {
      setError('Org and Name are required');
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE_URL}/admin/api/hosts/new`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminPassword}`
        },
        body: JSON.stringify({
          org: selectedOrg,
          name,
          tags: tags.split(',').map(t => t.trim()).filter(Boolean)
        })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || 'Failed to add host');
      mutate(`${API_BASE_URL}/admin/api/orgs/${encodeURIComponent(selectedOrg)}/hosts`);
      setName('');
      setTags('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrg = async () => {
    setOrgCreateError('');
    if (!newOrgName.trim()) {
      setOrgCreateError('Organization name is required');
      return;
    }
    setOrgCreateLoading(true);
    try {
      const resp = await fetch(`${API_BASE_URL}/admin/api/orgs/new`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminPassword}`
        },
        body: JSON.stringify({ name: newOrgName.trim() })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || 'Failed to create org');
      setNewOrgName('');
      mutate(`${API_BASE_URL}/admin/api/orgs`);
    } catch (e) {
      setOrgCreateError(e.message);
    } finally {
      setOrgCreateLoading(false);
    }
  };

  return (
    <Sheet sx={{ minWidth: 700, mx: 'auto', p: 2 }}>
      <Typography level="h1" fontSize="2rem" mb={2}>Organizations</Typography>
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <Input
          placeholder="New Organization Name"
          value={newOrgName}
          onChange={e => setNewOrgName(e.target.value)}
          disabled={orgCreateLoading}
        />
        <Button
          onClick={handleCreateOrg}
          loading={orgCreateLoading}
          variant="solid"
        >
          Create Org
        </Button>
      </Box>
      <List sx={{ mb: 3 }}>
        {orgs.map(org => (
          <ListItem
            key={org.name}
            sx={{
              cursor: 'pointer',
              fontWeight: org.name === selectedOrg ? 'bold' : 'normal',
              bgcolor: org.name === selectedOrg ? 'neutral.softBg' : undefined
            }}
            onClick={() => setSelectedOrg(org.name)}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <span>{org.name}</span>
              <Typography level="body2" color="neutral" fontSize="sm">
                {org.subnet}
              </Typography>
            </Box>
          </ListItem>
        ))}
      </List>

      {orgCreateError && <Typography color="danger" mb={2}>{orgCreateError}</Typography>}
      {selectedOrg && (
        <Box sx={{ display: 'flex', gap: 4 }}>
          <Box sx={{ flex: 1 }}>
            <Typography level="h2" fontSize="1.3rem" mb={2}>
              Hosts in <b>{selectedOrg}</b>
              {selectedOrgSubnet && (
                <Typography level="body2" color="neutral" fontSize="sm" ml={2} component="span">
                  Subnet: {selectedOrgSubnet}
                </Typography>
              )}
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <Input placeholder="Host Name" value={name} onChange={e => setName(e.target.value)} />
              <Input placeholder="Tags (comma separated)" value={tags} onChange={e => setTags(e.target.value)} />
              <Button onClick={handleAdd} variant="solid" loading={loading}>Add Host</Button>
            </Box>
            {error && <Typography color="danger" mb={2}>{error}</Typography>}
            <Table>
              {hosts.map((host, idx) => (
                <tr
                  key={host.name + host.ip + idx}
                  style={{
                    cursor: 'pointer',
                    background: selectedHost === host.name ? '#f0f4ff' : undefined
                  }}
                  onClick={() => setSelectedHost(host.name)}
                >
                  <td width="150"><b>{host.name}</b></td>
                  <td>{formatHostIP(host.ip)}</td>
                  <td>{host.tags && host.tags.join(', ')}</td>
                </tr>
              ))}
            </Table>
          </Box>
        </Box>
      )}

      {/* Host Details Modal */}
      <Modal open={!!selectedHost} onClose={() => setSelectedHost(null)}>
        <ModalDialog sx={{ minWidth: 400, maxWidth: 600, overflow: 'auto' }}>
          <ModalClose />
          <Typography level="h2" fontSize="1.2rem" mb={2}>
            Host Details: <b>{selectedHost}</b>
          </Typography>
          <Button
            onClick={() => {
              const downloadUrl = `${API_BASE_URL}/admin/api/orgs/${encodeURIComponent(selectedOrg)}/hosts/${encodeURIComponent(selectedHost)}/download`;
              window.open(downloadUrl, '_blank');
            }}
          >
            Download all Host Config
          </Button>
          {hostDetailsLoading && <Typography>Loading...</Typography>}
          {hostDetailsError && <Typography color="danger">{hostDetailsError.message || hostDetailsError}</Typography>}
          {hostDetails && (
            <Box sx={{ mb: 2 }}>
              <Typography level="body1"><b>Name:</b> {hostDetails.name}</Typography>
              {hostDetails.config && (
                <Box sx={{ mt: 1 }}>
                  <Typography level="body2"><b>Config:</b></Typography>
                  <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, fontSize: 13 }}>
                    {JSON.stringify(hostDetails.config, null, 2)}
                  </pre>
                </Box>
              )}
              {hostDetails.cert_details && (
                <Box sx={{ mt: 1 }}>
                  <Typography level="body2"><b>Certificate Details:</b></Typography>
                  {(() => {
                    let certs = hostDetails.cert_details;
                    if (typeof certs === 'string') {
                      try {
                        certs = JSON.parse(certs);
                      } catch (e) {
                        return (
                          <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, fontSize: 13 }}>
                            {hostDetails.cert_details}
                          </pre>
                        );
                      }
                    }
                    if (Array.isArray(certs)) {
                      return certs.map((cert, idx) => (
                        <Box key={idx} sx={{ mb: 2, p: 1, border: '1px solid #eee', borderRadius: 2, background: '#fafbfc' }}>
                          <Typography level="body3" sx={{ mb: 1 }}><b>Certificate #{idx + 1}</b></Typography>
                          <Table size="sm" sx={{ overflow: 'hidden' }}>
                            <tbody>
                              <tr>
                                <td><b>Curve</b></td>
                                <td>{cert.curve}</td>
                              </tr>
                              <tr>
                                <td><b>Fingerprint</b></td>
                                <td style={{ fontFamily: 'monospace' }}>{cert.fingerprint}</td>
                              </tr>
                              <tr>
                                <td><b>Public Key</b></td>
                                <td style={{ fontFamily: 'monospace' }}>{cert.publicKey}</td>
                              </tr>
                              <tr>
                                <td><b>Signature</b></td>
                                <td style={{ fontFamily: 'monospace' }}>{cert.signature}</td>
                              </tr>
                              <tr>
                                <td><b>Version</b></td>
                                <td>{cert.version}</td>
                              </tr>
                              <tr>
                                <td><b>Name</b></td>
                                <td>{cert.details?.name}</td>
                              </tr>
                              <tr>
                                <td><b>Issuer</b></td>
                                <td style={{ fontFamily: 'monospace' }}>{cert.details?.issuer}</td>
                              </tr>
                              <tr>
                                <td><b>Is CA</b></td>
                                <td>{cert.details?.isCa ? 'Yes' : 'No'}</td>
                              </tr>
                              <tr>
                                <td><b>Networks</b></td>
                                <td>
                                  {Array.isArray(cert.details?.networks)
                                    ? cert.details.networks.join(', ')
                                    : ''}
                                </td>
                              </tr>
                              <tr>
                                <td><b>Groups</b></td>
                                <td>
                                  {Array.isArray(cert.details?.groups)
                                    ? cert.details.groups.join(', ')
                                    : (cert.details?.groups || '')}
                                </td>
                              </tr>
                              <tr>
                                <td><b>Not Before</b></td>
                                <td>{cert.details?.notBefore}</td>
                              </tr>
                              <tr>
                                <td><b>Not After</b></td>
                                <td>{cert.details?.notAfter}</td>
                              </tr>
                            </tbody>
                          </Table>
                        </Box>
                      ));
                    }
                    // fallback if not array
                    return (
                      <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, fontSize: 13 }}>
                        {JSON.stringify(certs, null, 2)}
                      </pre>
                    );
                  })()}
                </Box>
              )}
              {hostDetails.cert_crt && (
                <Box sx={{ mt: 1 }}>
                  <Typography level="body2"><b>Certificate:</b></Typography>
                  <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, fontSize: 13 }}>
                    {hostDetails.cert_crt}
                  </pre>
                </Box>
              )}
              {hostDetails.cert_key && (
                <Box sx={{ mt: 1 }}>
                  <Typography level="body2"><b>Key (partial):</b></Typography>
                  <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, fontSize: 13 }}>
                    {hostDetails.cert_key.slice(0, 60)}...
                  </pre>
                </Box>
              )}
            </Box>
          )}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <Button onClick={() => setSelectedHost(null)} variant="outlined">Close</Button>
          </Box>
        </ModalDialog>
      </Modal>
    </Sheet>
  );
}

export default Hosts;