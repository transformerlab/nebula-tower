import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import API_BASE_URL from './apiConfig';
import {
  Box, Button, Input, Typography, Sheet, CircularProgress, Alert,
  Table, Switch, FormControl, FormLabel, Stack, IconButton, Chip
} from '@mui/joy';
import { useAuthedFetcher } from './lib/api';
import { EyeIcon, EyeOffIcon, TicketIcon, Trash2Icon } from 'lucide-react'

export default function Invites() {
  const fetcher = useAuthedFetcher();

  // SWR for invites
  const { data: invitesData, error: invitesError, isLoading: invitesLoading } = useSWR(
    `${API_BASE_URL}/admin/api/invites`,
    fetcher
  );

  // Filter states
  const [orgFilter, setOrgFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  // Track which codes are shown
  const [shownCodes, setShownCodes] = useState({});

  const handleToggleCode = code => {
    setShownCodes(prev => ({
      ...prev,
      [code]: !prev[code]
    }));
  };

  // Function to handle invite deletion
  const handleDeleteInvite = async (code) => {
    try {
      await fetcher(`${API_BASE_URL}/admin/api/invites/${code}`, {
        method: 'DELETE'
      });
      mutate(`${API_BASE_URL}/admin/api/invites`); // Refresh the invites list
    } catch (error) {
      console.error('Failed to delete invite:', error);
    }
  };

  // Filtered invites
  const invites = invitesData?.invites || [];
  const filteredInvites = invites.filter(invite => {
    const orgMatch = orgFilter ? invite.org.toLowerCase().includes(orgFilter.toLowerCase()) : true;
    const activeMatch = showInactive ? true : invite.active;
    return orgMatch && activeMatch;
  });

  return (
    <Sheet sx={{ minWidth: 700, mx: 'auto', p: 2, width: '100%' }}>
      <Typography level="h1" fontSize="2rem" mb={2}>Invites</Typography>

      {/* Filter Controls */}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <FormControl>
          <FormLabel>Filter by Org</FormLabel>
          <Input
            placeholder="Org name"
            value={orgFilter}
            onChange={e => setOrgFilter(e.target.value)}
            size="sm"
          />
        </FormControl>
        <FormControl>
          <FormLabel>Show Inactive</FormLabel>
          <Switch
            checked={showInactive}
            onChange={e => setShowInactive(e.target.checked)}
            size="sm"
          />
        </FormControl>
      </Stack>

      {invitesLoading ? <CircularProgress /> : (
        <>
          {filteredInvites.length > 0 ? (
            <Table sx={{ mt: 2 }}>
              <thead>
                <tr>
                  <th width="40px">&nbsp;</th>
                  <th>Org</th>
                  <th>Expires</th>
                  <th>Code</th>
                  <th>Active</th>
                  <th>Available Uses</th>
                  <th>&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvites.map((invite, idx) => {
                  const codeShown = shownCodes[invite.code];
                  const code = invite.code || '';
                  const shortCode = code.length > 8
                    ? `${code.slice(0, 4)}...${code.slice(-4)}`
                    : code;
                  return (
                    <tr key={code || idx}>
                      <td><TicketIcon /></td>
                      <td>{invite.org}</td>
                      <td>{invite.expires_at ? `${new Date(invite.expires_at).toLocaleString()} (${Math.ceil((new Date(invite.expires_at) - new Date()) / (1000 * 60 * 60 * 24))} days from now)` : ''}</td>
                      <td>
                        <Typography component="span" sx={{ fontFamily: 'monospace' }} startDecorator={<IconButton
                          size="sm"
                          variant="plain"
                          onClick={() => handleToggleCode(code)}
                          sx={{ ml: 1 }}
                          aria-label={codeShown ? "Hide code" : "Show code"}
                        >
                          {codeShown ? <EyeOffIcon /> : <EyeIcon />}
                        </IconButton>}>
                          {codeShown ? code : shortCode}
                        </Typography>

                      </td>
                      <td>
                        {invite.active ? (
                          <Chip color="success">Active</Chip>
                        ) : (
                          <Chip color="danger">Inactive</Chip>
                        )}
                      </td>
                      <td>{invite.available_uses}</td>
                      <td><IconButton onClick={() => handleDeleteInvite(invite.code)}><Trash2Icon /></IconButton></td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          ) : (
            <Box>
              <Typography>No invites found.</Typography>
            </Box>
          )}
        </>
      )}
      {(invitesError) && (
        <Alert color="danger" sx={{ mt: 2 }}>
          {invitesError?.message || 'Failed to load invites.'}
        </Alert>
      )}
    </Sheet>
  );
}
