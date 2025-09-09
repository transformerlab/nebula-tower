import { useState, useEffect } from 'react';
import { Typography, Box, Button, Modal, ModalDialog, ModalClose, Input } from '@mui/joy';
import API_BASE_URL from '../apiConfig';
import { useAuthedFetcher } from '../lib/api';

function GenerateInviteModal({ open, onClose, selectedOrg }) {
    const fetcher = useAuthedFetcher();
    const [inviteCode, setInviteCode] = useState('');
    const [inviteLoading, setInviteLoading] = useState(false);
    const [inviteError, setInviteError] = useState('');
    const [copied, setCopied] = useState(false);

    // Generate invite when modal opens if selectedOrg exists
    useEffect(() => {
        const generateInvite = async () => {
            setInviteLoading(true);
            setInviteError('');
            setInviteCode('');
            if (!selectedOrg) {
                setInviteError('Please select a subnet first.');
                setInviteLoading(false);
                return;
            }
            try {
                const resp = await fetcher(`/admin/api/invites/generate?org=${encodeURIComponent(selectedOrg)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                    // No body needed, org is passed as query param
                });
                const data = await resp;
                setInviteCode(data.invite.code);
            } catch (e) {
                setInviteError(e.message);
            } finally {
                setInviteLoading(false);
            }
        };

        if (open && selectedOrg) {
            generateInvite();
        }
    }, [open, selectedOrg]);

    const handleClose = () => {
        setInviteError('');
        setInviteCode('');
        setCopied(false);
        onClose();
    };

    return (
        <Modal open={open} onClose={handleClose}>
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
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                    <Button
                        onClick={() => {
                            // This will trigger the useEffect since we're a dependency on 'open'
                            setCopied(false);
                            setInviteCode('');
                            setInviteError('');
                        }}
                        variant="outlined"
                        color="primary"
                        disabled={inviteLoading}
                    >
                        Regenerate
                    </Button>
                    <Button onClick={handleClose} variant="outlined">Close</Button>
                </Box>
            </ModalDialog>
        </Modal>
    );
}

export default GenerateInviteModal;
