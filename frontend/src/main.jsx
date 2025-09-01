import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from 'react-auth-kit'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider authType="localstorage" authName="_auth">
      <App />
    </AuthProvider>
  </StrictMode>,
)
