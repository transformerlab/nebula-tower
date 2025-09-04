import React from 'react';
import useSWR from 'swr';
import { CssBaseline, Box, Divider, Typography, Sheet, List, ListItem, ListItemButton, ListItemDecorator, Button, Avatar, Chip } from '@mui/joy';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import Cert from './Cert';
import Hosts from './Hosts';
import { Shield, Server, TowerControlIcon, Users as UsersIcon } from 'lucide-react';
import Lighthouse from './Lighthouse';
import NebulaProcessStatusCard from './NebulaProcessStatusCard';
import API_BASE_URL from './apiConfig';
import Login from './Login';
import { useIsAuthenticated, useSignOut } from 'react-auth-kit';
import { useAuthedFetcher } from './lib/api';
import md5 from 'blueimp-md5';
import Users from './Users';



function Sidebar() {
  const signOut = useSignOut();
  const fetcher = useAuthedFetcher();
  const { data: caData } = useSWR(`${API_BASE_URL}/admin/api/ca`, fetcher);
  const { data: lhData } = useSWR(`${API_BASE_URL}/admin/api/lighthouse/config`, fetcher);
  const { data: me } = useSWR(`${API_BASE_URL}/users/me`, fetcher);

  const certExists = !!caData?.exists && caData?.key_exists;
  const lighthouseConfigExists = !!lhData?.config;

  const location = useLocation();
  const navItems = [
    { label: 'Lighthouse', to: '/lighthouse', icon: <TowerControlIcon size={20} />, disabled: !certExists },
    { label: 'Hosts', to: '/hosts', icon: <Server size={20} />, disabled: !lighthouseConfigExists },
    { label: 'Primary Cert', to: '/cert', icon: <Shield size={20} />, disabled: false },
    ...(me?.is_superuser ? [{ label: 'Users', to: '/users', icon: <UsersIcon size={20} />, disabled: false }] : []),
  ];
  return (
    <Sheet sx={{ width: 250, minHeight: '100vh', p: 2, borderRight: 1, borderColor: 'divider', }}>
      <Typography level="h4"><img src="/trayIcon.png" alt="Nebula Logo" style={{ width: 24, height: 24, marginRight: 8 }} />Nebula Tower</Typography>
      <NebulaProcessStatusCard disableButtons={!lighthouseConfigExists} />
      <List>
        {navItems.map(item => (
          <ListItem key={item.to} selected={location.pathname === item.to} >
            <ListItemButton component={Link} to={item.to} selected={location.pathname === item.to} disabled={item.disabled}>
              <ListItemDecorator>{item.icon}</ListItemDecorator>
              {item.label}
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider />
      <Box sx={{ mt: 'auto' }}>
        {me && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, mb: 1 }}>
            <Avatar size="sm" src={`https://www.gravatar.com/avatar/${md5((me.email || '').trim().toLowerCase())}?d=identicon`} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography level="body-sm">{me.email}</Typography>
              {me.is_superuser && <Chip size="sm" color="success" variant="soft">admin</Chip>}
            </Box>
          </Box>
        )}
        <Button variant="outlined" size="sm" color="neutral" onClick={() => signOut()}>Sign out</Button>
      </Box>
    </Sheet>
  );
}

function MainLayout({ children }) {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
      <Sidebar />
      <Sheet sx={{ flex: 1, pl: 2, width: '100%' }}>{children}</Sheet>
    </Box>
  );
}

function Home() {
  return (
    <Sheet>
      <Typography level="h2" mt={3}>Nebula Tower</Typography>
      <Box sx={{ border: '10px solid #999', m: 4 }}>
        <img src="/tower.png" alt="Tower" width="100%" />
      </Box>
    </Sheet>
  );
}

function RequireAuth({ children }) {
  const isAuthenticated = useIsAuthenticated();
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  return children;
}

function App() {
  return (
    <Router>
      <CssBaseline />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <RequireAuth>
              <MainLayout>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/cert" element={<Cert />} />
                  <Route path="/lighthouse" element={<Lighthouse />} />
                  <Route path="/hosts" element={<Hosts />} />
                  <Route path="/users" element={<Users />} />
                </Routes>
              </MainLayout>
            </RequireAuth>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;

