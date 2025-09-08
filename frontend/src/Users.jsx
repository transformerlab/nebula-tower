import { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { Box, Button, Chip, Input, Modal, ModalClose, ModalDialog, Sheet, Table, Typography } from '@mui/joy'
import API_BASE_URL from './apiConfig'
import { useAuthedFetcher } from './lib/api'

export default function Users() {
    const fetcher = useAuthedFetcher()
    const { data, error, isLoading } = useSWR(`${API_BASE_URL}/admin/api/users`, fetcher)
    const users = Array.isArray(data) ? data : []

    const [pwModalOpen, setPwModalOpen] = useState(false)
    const [selectedUser, setSelectedUser] = useState(null)
    const [newPassword, setNewPassword] = useState('')
    const [pwLoading, setPwLoading] = useState(false)
    const [actionError, setActionError] = useState('')

    const refresh = () => mutate(`${API_BASE_URL}/admin/api/users`)

    async function handlePromote(userId, toAdmin) {
        setActionError('')
        const res = await fetcher(`/admin/api/users/${userId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_superuser: !!toAdmin })
        })
        if (!res.ok) {
            const t = await res.text().catch(() => '')
            setActionError(t || 'Failed to update user')
        } else {
            refresh()
        }
    }

    async function handleDelete(userId, email) {
        setActionError('')
        if (!confirm(`Delete user ${email}? This cannot be undone.`)) return
        const res = await fetcher(`/admin/api/users/${userId}`, { method: 'DELETE' })
        if (!res.ok) {
            const t = await res.text().catch(() => '')
            setActionError(t || 'Failed to delete user')
        } else {
            refresh()
        }
    }

    function openPwModal(user) {
        setSelectedUser(user)
        setNewPassword('')
        setPwModalOpen(true)
    }

    async function savePassword() {
        if (!selectedUser) return
        setPwLoading(true)
        setActionError('')
        try {
            const res = await fetcher(`/admin/api/users/${selectedUser.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: newPassword })
            })
            if (!res.ok) {
                const t = await res.text().catch(() => '')
                setActionError(t || 'Failed to update password')
            } else {
                setPwModalOpen(false)
                setSelectedUser(null)
                setNewPassword('')
                refresh()
            }
        } finally {
            setPwLoading(false)
        }
    }

    return (
        <Sheet sx={{ minWidth: 700, mx: 'auto', p: 2 }}>
            <Typography level="h1" fontSize="2rem" mb={2}>Users</Typography>
            {actionError && (
                <Typography color="danger" mb={2}>{actionError}</Typography>
            )}
            {isLoading ? (
                <Typography>Loading…</Typography>
            ) : error ? (
                <Typography color="danger">Failed to load users</Typography>
            ) : (
                <Table>
                    <thead>
                        <tr>
                            <th>Email</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((u) => (
                            <tr key={u.id}>
                                <td>{u.email}</td>
                                <td>
                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                        {u.is_active ? <Chip size="sm" color="success" variant="soft">active</Chip> : <Chip size="sm" color="neutral" variant="soft">inactive</Chip>}
                                        {u.is_superuser && <Chip size="sm" color="success" variant="soft">admin</Chip>}
                                        {u.is_verified && <Chip size="sm" color="primary" variant="soft">verified</Chip>}
                                    </Box>
                                </td>
                                <td>
                                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                        {!u.is_superuser && (
                                            <Button size="sm" onClick={() => handlePromote(u.id, true)}>Promote to admin</Button>
                                        )}
                                        {u.is_superuser && (
                                            <Button size="sm" variant="outlined" color="neutral" onClick={() => handlePromote(u.id, false)}>Remove admin</Button>
                                        )}
                                        <Button size="sm" variant="outlined" onClick={() => openPwModal(u)}>Change password</Button>
                                        <Button size="sm" color="danger" variant="solid" onClick={() => handleDelete(u.id, u.email)}>Delete</Button>
                                    </Box>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            )}

            <Modal open={pwModalOpen} onClose={() => setPwModalOpen(false)}>
                <ModalDialog>
                    <ModalClose />
                    <Typography level="h3" mb={1}>Change password</Typography>
                    <Typography level="body-sm" mb={1}>{selectedUser?.email}</Typography>
                    <Input type="password" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} sx={{ mb: 1 }} />
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                        <Button variant="outlined" onClick={() => setPwModalOpen(false)}>Cancel</Button>
                        <Button loading={pwLoading} onClick={savePassword}>Save</Button>
                    </Box>
                </ModalDialog>
            </Modal>
        </Sheet>
    )
}
