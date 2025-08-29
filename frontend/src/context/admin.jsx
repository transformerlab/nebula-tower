import React, { useState, useEffect } from 'react';
import { AdminContext } from './adminContext';
import API_BASE_URL from '../apiConfig';

export function AdminPasswordProvider({ children }) {
  const [adminPassword, setAdminPassword] = useState(localStorage.getItem('adminPassword') || '');
  const [passwordValid, setPasswordValid] = useState(true);

  // Test password by calling a protected endpoint
  async function testPassword(pw) {
    console.log('Testing password:', pw);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/api/ping`, {
        headers: { 'Authorization': pw ? `Bearer ${pw}` : '' }
      });
      console.log('Response status:', res.status);
      if (res.status === 200) {
        setPasswordValid(true);
        console.log('Password is valid');
        return true;
      } else {
        setPasswordValid(false);
        console.log('Password is invalid');
        return false;
      }
    } catch (error) {
      setPasswordValid(false);
      console.error('Error testing password:', error);
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

