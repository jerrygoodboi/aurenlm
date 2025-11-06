import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const response = await axios.get('http://localhost:5000/current_user', { withCredentials: true, timeout: 30000 });
        if (response.data.username) {
          setIsAuthenticated(true);
          setUser({ username: response.data.username, id: response.data.id });
        } else {
          setIsAuthenticated(false);
          setUser(null);
        }
      } catch (error) {
        console.error("Error checking login status:", error);
        setIsAuthenticated(false);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkLoginStatus();
  }, []);

  const login = async (username, password) => {
    try {
      const response = await axios.post('http://localhost:5000/login', { username, password }, { withCredentials: true, timeout: 30000 });
      if (response.status === 200) {
        setIsAuthenticated(true);
        setUser({ username: response.data.username });
        return { success: true };
      }
    } catch (error) {
      console.error("Login error:", error);
      return { success: false, message: error.response?.data?.message || "Login failed" };
    }
  };

  const register = async (username, password) => {
    try {
      const response = await axios.post('http://localhost:5000/register', { username, password }, { withCredentials: true, timeout: 30000 });
      if (response.status === 201) {
        return { success: true };
      }
    } catch (error) {
      console.error("Registration error:", error);
      return { success: false, message: error.response?.data?.message || "Registration failed" };
    }
  };

  const logout = async () => {
    try {
      await axios.get('http://localhost:5000/logout', { withCredentials: true, timeout: 30000 });
      setIsAuthenticated(false);
      setUser(null);
      return { success: true };
    } catch (error) {
      console.error("Logout error:", error);
      return { success: false, message: "Logout failed" };
    }
  };

  const authContextValue = {
    isAuthenticated,
    user,
    loading,
    login,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
