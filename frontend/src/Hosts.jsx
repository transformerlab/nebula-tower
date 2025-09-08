import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import ip6 from 'ip6'; // Import the ip6 library
import { IconButton, Box, Button, Typography, Sheet, List, ListItemButton, ListItemContent, Input, Table, Modal, ModalDialog, ModalClose, ListItemDecorator } from '@mui/joy';
import API_BASE_URL from './apiConfig';
import { useAuthedFetcher } from './lib/api';
import HostDetailsModal from './HostDetailsModal';
import { BuildingIcon, TicketIcon, PlusCircleIcon } from 'lucide-react';


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
          padding: '0px 2px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          margin: '0 2px',
          fontFamily: 'monospace',
          fontSize: '0.9em',
          color: '#595959ff',
        }}
      >
        {group}
      </Box>
    ));

    // Wrap groups in colored boxes
    return (
      <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
        <Box sx={{ display: 'inline-flex', backgroundColor: '#d2d2d2ff', border: '2px solid #aaa', padding: '2px 0px', borderRadius: '4px', marginRight: '4px' }}>
          {groups.slice(0, 3)}
        </Box>
        <Box sx={{ display: 'inline-flex', border: '2px solid rgb(130, 176, 223)', padding: '2px 0px', borderRadius: '4px', marginRight: '4px' }}>
          {groups.slice(3, 4)}
        </Box>
        <Box sx={{ display: 'inline-flex', border: '2px solid #2fad48ff', padding: '2px 0px', borderRadius: '4px' }}>
          {groups.slice(4)}
        </Box>
      </Box>
    );
  } catch {
    console.error('Invalid IPv6 address:', ip);
    return <Typography color="danger">Invalid IP</Typography>;
  }
}

function Hosts() {
  const fetcher = useAuthedFetcher();
  const [selectedOrg, setSelectedOrg] = useState('');
  // const [hostsFilter, setHostsFilter] = useState(''); // reserved for future filtering
  const [name, setName] = useState('');
  const [tags, setTags] = useState(''); // comma separated
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedHost, setSelectedHost] = useState(null);
  const [newOrgName, setNewOrgName] = useState('');
  const [orgCreateError, setOrgCreateError] = useState('');
  const [orgCreateLoading, setOrgCreateLoading] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [copied, setCopied] = useState(false);

  // SWR for orgs
  const { data: orgsData } = useSWR(
    `${API_BASE_URL}/admin/api/orgs`,
    fetcher
  );
  const orgs = orgsData?.orgs || [];

  // Find and set subnet for selected org
  const selectedOrgSubnet = orgs.find(o => o.name === selectedOrg)?.subnet || '';

  // SWR for hosts in selected org
  const { data: hostsData } = useSWR(
    selectedOrg ? `${API_BASE_URL}/admin/api/orgs/${encodeURIComponent(selectedOrg)}/hosts` : null,
    fetcher
  );
  const hosts = hostsData?.hosts || [];


  const handleAdd = async () => {
    setError('');
    if (!selectedOrg || !name) {
      setError('Name is required');
      return;
    }
    setLoading(true);
    try {
      const resp = await fetcher(`/admin/api/hosts/new`, {
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
      setOrgCreateError('Subnet name is required');
      return;
    }
    setOrgCreateLoading(true);
    try {
      const resp = await fetcher(`/admin/api/orgs/new`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  const handleGenerateInvite = async () => {
    setInviteLoading(true);
    setInviteError('');
    setInviteCode('');
    if (!selectedOrg) {
      setInviteError('Please select a subnet first.');
      setInviteModalOpen(true);
      setInviteLoading(false);
      return;
    }
    try {
      const resp = await fetcher(`/admin/api/invites/generate?org=${encodeURIComponent(selectedOrg)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
        // No body needed, org is passed as query param
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || 'Failed to generate invite');
      setInviteCode(data.invite.code);
      setInviteModalOpen(true);
    } catch (e) {
      setInviteError(e.message);
      setInviteModalOpen(true);
    } finally {
      setInviteLoading(false);
    }
  };

  return (
    <Sheet sx={{ minWidth: 700, mx: 'auto', p: 2, display: 'flex', flexDirection: 'row', gap: 2 }}>
      <Sheet sx={{ width: '230px', height: '100%', flexShrink: 0 }} >
        <Typography level="h3" mb={2} sx={{ height: '40px' }}>Subnet</Typography>
        <List sx={{ mb: 1 }}>
          {orgs.map(org => (
            <ListItemButton
              key={org.name}
              sx={{
                cursor: 'pointer',
                fontWeight: org.name === selectedOrg ? 'bold' : 'normal',
                bgcolor: org.name === selectedOrg ? 'neutral.softBg' : undefined
              }}
              onClick={() => setSelectedOrg(org.name)}
            >
              <ListItemDecorator><BuildingIcon /></ListItemDecorator>
              <ListItemContent>
                <span>{org.name}</span>
                <Typography level="body2" color="neutral" sx={{ fontSize: '11px' }} noWrap>
                  {org.subnet}
                </Typography>
              </ListItemContent>
            </ListItemButton>
          ))}
        </List>
        <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
          <Input
            placeholder="appleincorporated"
            value={newOrgName}
            onChange={e => setNewOrgName(e.target.value)}
            disabled={orgCreateLoading}
          />
          <IconButton
            onClick={handleCreateOrg}
            loading={orgCreateLoading}
            variant="plain"
          >
            <PlusCircleIcon />
          </IconButton>
        </Box>
        {orgCreateError && <Typography color="danger" mb={2}>{orgCreateError}</Typography>}

      </Sheet>
      <Sheet>


        {selectedOrg && (
          <Box sx={{ display: 'flex', gap: 4 }}>
            <Box sx={{ flex: 1 }}>
              <Box sx={{ height: '40px' }} mb={3}>
                <Typography level="h3">
                  Hosts in <b>{selectedOrg}</b>
                </Typography>
                <Typography level="body2" color="neutral" fontSize="sm" >
                  Subnet: {selectedOrgSubnet ? selectedOrgSubnet : 'create your first host first'}
                </Typography>
              </Box>
              <Button onClick={handleGenerateInvite} loading={inviteLoading} sx={{ mb: 1 }} startDecorator={<TicketIcon />} variant="soft">Generate Invite Code</Button>
              {/* Invite Code Modal */}
              <Modal open={inviteModalOpen} onClose={() => { setInviteModalOpen(false); setInviteError(''); setInviteCode(''); setCopied(false); }}>
                <ModalDialog sx={{ minWidth: 400 }}>
                  <ModalClose />
                  <Typography level="h2" mb={2}>Invite Code</Typography>
                  {inviteLoading && <Typography>Generating...</Typography>}
                  {inviteError && <Typography color="danger">{inviteError}</Typography>}
                  {inviteCode && typeof inviteCode === 'string' && (
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Input
                        value={inviteCode}
                        readOnly
                        sx={{ flex: 1, fontFamily: 'monospace', fontWeight: 'bold', fontSize: 16, mr: 1 }}
                      />
                      <Button
                        variant="soft"
                        color={copied ? "success" : "neutral"}
                        onClick={() => {
                          navigator.clipboard.writeText(inviteCode);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 1200);
                        }}
                        sx={{ minWidth: 40, px: 1 }}
                      >
                        copy
                      </Button>
                    </Box>
                  )}
                  {/* Defensive fallback if inviteCode is an object */}
                  {inviteCode && typeof inviteCode !== 'string' && (
                    <Box sx={{ mb: 2 }}>
                      <Typography color="danger">Invalid invite code format</Typography>
                    </Box>
                  )}
                  <Typography level="body2" color="neutral">
                    Copy this code and share it with the client to create a host in <b>{selectedOrg}</b>.
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                    <Button onClick={() => { setInviteModalOpen(false); setInviteError(''); setInviteCode(''); setCopied(false); }} variant="outlined">Close</Button>
                  </Box>
                </ModalDialog>
              </Modal>
              <Box sx={{ display: 'flex', gap: 2, mb: 2, mt: 1 }}>
                <Input placeholder="Host Name" value={name} onChange={e => setName(e.target.value)} />
                <Input placeholder="Tags (comma separated)" value={tags} onChange={e => setTags(e.target.value)} />
                <Button onClick={handleAdd} variant="solid" loading={loading}>Add Host</Button>
              </Box>
              {error && <Typography color="danger" mb={2}>{error}</Typography>}
              <Table>
                <tbody>
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
                </tbody>
              </Table>
            </Box>
          </Box>
        )}
      </Sheet>
      {/* Host Details Modal */}
      <HostDetailsModal selectedHost={selectedHost} selectedOrg={selectedOrg} onClose={() => setSelectedHost(null)} />
    </Sheet >
  );
}

export default Hosts;