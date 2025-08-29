import React, { useState } from 'react';
import { useAdminPassword } from '../context/adminContext';
import { Modal } from '@mui/joy';

export function AdminPasswordModal({ open }) {
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
        }
        setSubmitting(false);
    };

    // Show modal if open prop is true or password is invalid
    if (!open && passwordValid) return null;

    return (
        <Modal open>
            {/* ...existing modal code... */}
            <form onSubmit={handleSubmit}>
                <input
                    type="password"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Enter admin password"
                />
                <button type="submit" disabled={submitting}>Submit</button>
                {!passwordValid && <div style={{ color: 'red' }}>Invalid password. Please try again.</div>}
            </form>
        </Modal>
    );
}