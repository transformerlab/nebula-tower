import { useState } from 'react'
import { Box, Button, Input, Sheet, Typography, Alert } from '@mui/joy'
import API_BASE_URL from './apiConfig'
import { useSignIn } from 'react-auth-kit'
import { useNavigate } from 'react-router-dom'

export default function Login() {
    const signIn = useSignIn();
    const navigate = useNavigate();
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError('')
        try {
            const res = await fetch(`${API_BASE_URL}/auth/jwt/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ username: email, password }),
            })
            if (!res.ok) {
                const txt = await res.text().catch(() => '')
                throw new Error(txt || 'Login failed')
            }
            const data = await res.json();
            const token = data?.access_token || data?.token || data?.accessToken
            if (!token) throw new Error('Token missing in response')
            const ok = signIn({
                token,
                expiresIn: 3600,
                tokenType: 'Bearer',
                authState: { email },
            })
            if (ok) navigate('/')
        } catch (e) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Sheet sx={{ maxWidth: 380, mx: 'auto', mt: 10, p: 3 }}>
            <Typography level="h2" mb={2}>Sign in</Typography>
            {error && <Alert color="danger" sx={{ mb: 2 }}>{error}</Alert>}
            <form onSubmit={handleSubmit}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    <Button type="submit" loading={loading}>Sign in</Button>
                </Box>
            </form>
        </Sheet>
    )
}
