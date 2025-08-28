
import { CssBaseline, Box, Typography, Sheet, List, ListItem, ListItemButton, ListItemDecorator } from '@mui/joy';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import Cert from './Cert';
import Hosts from './Hosts';
import { Shield, HomeIcon, Server, TowerControlIcon } from 'lucide-react';
import Lighthouse from './Lighthouse';

function Sidebar() {
  const location = useLocation();
  const navItems = [
    { label: 'Lighthouse', to: '/lighthouse', icon: <TowerControlIcon size={20} /> },
    { label: 'Hosts', to: '/hosts', icon: <Server size={20} /> },
    { label: 'Cert', to: '/cert', icon: <Shield size={20} /> },
  ];
  return (
    <Sheet variant="outlined" sx={{ width: 200, minHeight: '100vh', p: 2, borderRight: 1, borderColor: 'divider' }}>
      <Typography level="h4">Nebula</Typography>
      <List>
        {navItems.map(item => (
          <ListItem key={item.to} selected={location.pathname === item.to}>
            <ListItemButton component={Link} to={item.to} selected={location.pathname === item.to}>
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
      <Box sx={{ flex: 1 }}>{children}</Box>
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
