import React, { useState } from 'react';
import { useAdminPassword } from '../context/adminContext';
import { Modal, ModalDialog, Typography, Button, Input, IconButton, ModalClose } from '@mui/joy';

export function AdminPasswordModal({ open, onClose }) {
    const { setAdminPassword, passwordValid, testPassword } = useAdminPassword();
    const [input, setInput] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        const ok = await testPassword(input);
        if (ok) {
            setAdminPassword(input);
            setInput('');
            if (onClose) onClose();
        }
        setSubmitting(false);
    };

    // Show modal if open prop is true or password is invalid
    const shouldOpen = open || !passwordValid;

    return (
        <Modal open={shouldOpen} onClose={onClose}>
            <ModalDialog>
                <ModalClose />
                <Typography level="h4" component="h2" sx={{ mb: 2 }}>
                    Admin Password Required
                </Typography>
                <form onSubmit={handleSubmit}>
                    <Input
                        type="password"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        placeholder="Enter admin password"
                        sx={{ mb: 2, width: '100%' }}
                        autoFocus
                    />
                    <Button
                        type="submit"
                        loading={submitting}
                        disabled={submitting}
                        fullWidth
                        variant="solid"
                    >
                        Submit
                    </Button>
                    {!passwordValid && (
                        <Typography color="danger" sx={{ mt: 1 }}>
                            Invalid password. Please try again.
                        </Typography>
                    )}
                </form>
            </ModalDialog>
        </Modal>
    );
}