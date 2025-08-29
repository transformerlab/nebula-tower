import React, { useState, useEffect } from 'react';
import { AdminContext } from './adminContext';

export function AdminPasswordProvider({ children }) {
  const [adminPassword, setAdminPassword] = useState(localStorage.getItem('adminPassword') || '');
  const [passwordValid, setPasswordValid] = useState(true);

  // Test password by calling a protected endpoint
  async function testPassword(pw) {
    try {
      const res = await fetch('/admin/api/ping', {
        headers: { 'Authorization': pw ? `Bearer ${pw}` : '' }
      });
      if (res.status === 200) {
        setPasswordValid(true);
        return true;
      } else {
        setPasswordValid(false);
        return false;
      }
    } catch {
      setPasswordValid(false);
      return false;
    }
  }

  // Test password on mount or when it changes
  useEffect(() => {
    if (adminPassword) testPassword(adminPassword);
  }, [adminPassword]);

  return (
    <AdminContext.Provider value={{
      adminPassword,
      setAdminPassword,
      passwordValid,
      testPassword,
    }}>
      {children}
    </AdminContext.Provider>
  );
}

