import React, { createContext, useState, useContext, useEffect } from 'react';
import { login as loginApi, signup as signupApi, fetchCurrentUser } from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            setLoading(false);
            return;
        }
        const loadUser = async () => {
            try {
                const profile = await fetchCurrentUser();
                setUser({ token, ...profile });
            } catch (error) {
                localStorage.removeItem('token');
                setUser(null);
            } finally {
                setLoading(false);
            }
        };
        loadUser();
    }, []);

    const login = async (email, password) => {
        try {
            const data = await loginApi(email, password);
            localStorage.setItem('token', data.access_token);
            setUser({ token: data.access_token, email });
            try {
                const profile = await fetchCurrentUser();
                setUser({ token: data.access_token, ...profile });
            } catch (error) {
                // Keep basic session so routing can decide what to do next.
            }
            return true;
        } catch (error) {
            console.error("Login failed", error);
            return false;
        }
    };

    const signup = async (email, password, name) => {
        try {
            const data = await signupApi(email, password, name);
            // Assuming signup auto-logs in, or requires login after. 
            // If it returns a token, we set it.
            if (data.access_token) {
                localStorage.setItem('token', data.access_token);
                setUser({ token: data.access_token });
            }
            return true;
        } catch (error) {
            console.error("Signup failed", error);
            throw error; // Propagate to component
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, signup, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
