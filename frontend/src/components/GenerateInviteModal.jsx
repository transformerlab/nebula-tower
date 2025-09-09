import { useState } from 'react';
import { Typography, Box, Button, Modal, ModalDialog, ModalClose, Input, Divider } from '@mui/joy';
import API_BASE_URL from '../apiConfig';
import { useAuthedFetcher } from '../lib/api';

function GenerateInviteModal({ open, onClose, selectedOrg }) {
    const fetcher = useAuthedFetcher();
    const [inviteCode, setInviteCode] = useState('');
    const [inviteLoading, setInviteLoading] = useState(false);
    const [inviteError, setInviteError] = useState('');
    const [copied, setCopied] = useState(false);
    const [numberOfUses, setNumberOfUses] = useState(1);
    const [daysValid, setDaysValid] = useState(7);

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
            const resp = await fetcher(`/admin/api/invites/generate?org=${encodeURIComponent(selectedOrg)}&days_valid=${daysValid}&number_of_uses=${numberOfUses}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await resp;
            setInviteCode(data.invite.code);
        } catch (e) {
            setInviteError(e.message);
        } finally {
            setInviteLoading(false);
        }
    };

    const handleCreate = () => {
        if (!selectedOrg || !open) return;
        generateInvite();
    }


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
                <Typography level="h2" mb={1}>Invite Code</Typography>
                <Typography level="body2" color="neutral">
                    Create a Code for <b>{selectedOrg}</b> that can be used
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                    <Input
                        type="number"
                        value={numberOfUses}
                        onChange={(e) => setNumberOfUses(Math.max(1, parseInt(e.target.value) || 1))}
                        inputProps={{ min: 1 }}
                        sx={{ width: 80, mr: 1 }}
                    />
                    <Typography level="body2" color="neutral">
                        time{numberOfUses > 1 ? 's' : ''}
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 2, mb: 2 }}>
                    <Typography level="body2" color="neutral">
                        and will expire in
                    </Typography>
                    <Input
                        type="number"
                        value={daysValid}
                        onChange={(e) => setDaysValid(Math.max(1, parseInt(e.target.value) || 1))}
                        inputProps={{ min: 1 }}
                        sx={{ width: 80, mx: 1 }}
                    />
                    <Typography level="body2" color="neutral">
                        days
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex' }}>
                    <Button
                        onClick={() => {
                            handleCreate();
                        }}
                        variant="outlined"
                        color="primary"
                        disabled={inviteLoading}
                    >
                        Generate
                    </Button>
                </Box>
                <Divider mb={8} />
                {inviteLoading && <Typography>Generating...</Typography>}
                {inviteError && <Typography color="danger">{inviteError}</Typography>}
                {inviteCode && typeof inviteCode === 'string' && (
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
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
                {inviteCode && typeof inviteCode !== 'string' && (
                    <Box sx={{ mb: 1 }}>
                        <Typography color="danger">Invalid invite code format</Typography>
                    </Box>
                )}
            </ModalDialog>
        </Modal>
    );
}

export default GenerateInviteModal;
