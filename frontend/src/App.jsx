import React from 'react';
import useSWR from 'swr';
import { CssBaseline, Box, Typography, Sheet, List, ListItem, ListItemButton, ListItemDecorator, Card } from '@mui/joy';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import Cert from './Cert';
import Hosts from './Hosts';
import { Shield, HomeIcon, Server, TowerControlIcon } from 'lucide-react';
import Lighthouse from './Lighthouse';
import NebulaProcessStatusCard from './NebulaProcessStatusCard';
import API_BASE_URL from './apiConfig';

const fetcher = url => fetch(url).then(res => res.json());

function Sidebar() {
  // Use SWR for CA cert and Lighthouse config
  const { data: caData } = useSWR(`${API_BASE_URL}/api/ca`, fetcher);
  const { data: lhData } = useSWR(`${API_BASE_URL}/api/lighthouse/config`, fetcher);

  const certExists = !!caData?.exists && caData?.key_exists;
  const lighthouseConfigExists = !!lhData?.config;

  const location = useLocation();
  const navItems = [
    { label: 'Lighthouse', to: '/lighthouse', icon: <TowerControlIcon size={20} />, disabled: !certExists },
    { label: 'Hosts', to: '/hosts', icon: <Server size={20} />, disabled: !lighthouseConfigExists },
    { label: 'Primary Cert', to: '/cert', icon: <Shield size={20} />, disabled: false },
  ];
  return (
    <Sheet variant="outlined" sx={{ width: 250, minHeight: '100vh', p: 2, borderRight: 1, borderColor: 'divider', }}>
      <Typography level="h4">Nebula</Typography>
      <NebulaProcessStatusCard />
      {/* {certExists && <Typography level="body2">CA Certificate exists</Typography>}
      {lighthouseConfigExists && <Typography level="body2">Lighthouse config exists</Typography>} */}
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
    </Sheet>
  );
}

function MainLayout({ children }) {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <Sheet sx={{ flex: 1, pl: 2 }}>{children}</Sheet>
    </Box>
  );
}

function Home() {
  return (
    <Sheet>

    </Sheet>
  );
}

function App() {
  return (
    <Router>
      <CssBaseline />
      <MainLayout>
        {/* You can pass certExists and lighthouseConfigExists as props if needed */}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/cert" element={<Cert />} />
          <Route path="/lighthouse" element={<Lighthouse />} />
          <Route path="/hosts" element={<Hosts />} />
        </Routes>
      </MainLayout>
    </Router>
  );
}

export default App;

