import { useState, useEffect } from 'react';
import { Box, Button, Typography, Sheet, List, ListItem, Input, Table } from '@mui/joy';
import API_BASE_URL from './apiConfig';
import ip6 from 'ip6';


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
  const [orgs, setOrgs] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState('');
  const [selectedOrgSubnet, setSelectedOrgSubnet] = useState('');
  const [hosts, setHosts] = useState([]);
  const [name, setName] = useState('');
  const [tags, setTags] = useState(''); // comma separated
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedHost, setSelectedHost] = useState(null);
  const [hostDetails, setHostDetails] = useState(null);
  const [hostDetailsLoading, setHostDetailsLoading] = useState(false);
  const [hostDetailsError, setHostDetailsError] = useState('');
  const [newOrgName, setNewOrgName] = useState('');
  const [orgCreateError, setOrgCreateError] = useState('');
  const [orgCreateLoading, setOrgCreateLoading] = useState(false);

  // Fetch orgs on mount
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/orgs`)
      .then(res => res.json())
      .then(data => setOrgs(data.orgs || []));
  }, []);

  // Fetch hosts for selected org
  useEffect(() => {
    if (!selectedOrg) {
      setHosts([]);
      setSelectedOrgSubnet('');
      return;
    }
    fetch(`${API_BASE_URL}/api/orgs/${encodeURIComponent(selectedOrg)}/hosts`)
      .then(res => res.json())
      .then(data => setHosts(data.hosts || []));
    // Find and set subnet for selected org
    const orgObj = orgs.find(o => o.name === selectedOrg);
    setSelectedOrgSubnet(orgObj ? orgObj.subnet : '');
  }, [selectedOrg, orgs]);

  // Fetch host details when selectedHost changes
  useEffect(() => {
    if (!selectedHost) {
      setHostDetails(null);
      setHostDetailsError('');
      return;
    }
    setHostDetailsLoading(true);
    setHostDetailsError('');
    fetch(`${API_BASE_URL}/api/orgs/${encodeURIComponent(selectedOrg)}/hosts/${encodeURIComponent(selectedHost)}`)
      .then(res => res.json())
      .then(data => {
        setHostDetails(data.host || null);
      })
      .catch(e => setHostDetailsError('Failed to load host details'))
      .finally(() => setHostDetailsLoading(false));
  }, [selectedHost, selectedOrg]);

  const handleAdd = async () => {
    setError('');
    if (!selectedOrg || !name) {
      setError('Org and Name are required');
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE_URL}/api/hosts/new`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org: selectedOrg,
          name,
          tags: tags.split(',').map(t => t.trim()).filter(Boolean)
        })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || 'Failed to add host');
      setHosts(hs => [...hs, { ...data.host, org: selectedOrg }]);
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
      const resp = await fetch(`${API_BASE_URL}/api/orgs/new`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newOrgName.trim() })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || 'Failed to create org');
      setNewOrgName('');
      // Refresh orgs list
      const orgsResp = await fetch(`${API_BASE_URL}/api/orgs`);
      const orgsData = await orgsResp.json();
      setOrgs(orgsData.orgs || []);
    } catch (e) {
      setOrgCreateError(e.message);
    } finally {
      setOrgCreateLoading(false);
    }
  };

  return (
    <Sheet sx={{ mx: 'auto', my: 4, p: 4 }}>
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
            {/* <Button
              variant="outlined"
              size="sm"
              sx={{ mb: 2 }}
              onClick={() => setSelectedOrg('')}
            >
              &larr; Back to Organizations
            </Button> */}
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
                  sx={{
                    cursor: 'pointer',
                    bgcolor: selectedHost === host.name ? 'primary.softBg' : undefined
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
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {selectedHost && (
              <Box sx={{ borderLeft: '1px solid #eee', pl: 3 }}>
                <Typography level="h2" fontSize="1.2rem" mb={2}>
                  Host Details: <b>{selectedHost}</b>
                </Typography>
                {hostDetailsLoading && <Typography>Loading...</Typography>}
                {hostDetailsError && <Typography color="danger">{hostDetailsError}</Typography>}
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
              </Box>
            )}
          </Box>
        </Box>
      )}
    </Sheet>
  );
}

export default Hosts;