import React, { createContext, useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api, {
    login as loginApi,
    signup as signupApi,
    fetchCurrentUser,
    updateCurrentUser,
    disableLoginRedirect,
    enableLoginRedirect,
} from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            setLoading(false);
            return;
        }
        api.defaults.headers.common.Authorization = `Bearer ${token}`;
        const loadUser = async () => {
            try {
                const profile = await fetchCurrentUser();
                setUser({ token, ...profile });
            } catch (error) {
                localStorage.removeItem('token');
                delete api.defaults.headers.common.Authorization;
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
            localStorage.setItem('zerodha_connected', 'false');
            api.defaults.headers.common.Authorization = `Bearer ${data.access_token}`;
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
            if (data.access_token) {
                localStorage.setItem('token', data.access_token);
                localStorage.setItem('zerodha_connected', 'false');
                api.defaults.headers.common.Authorization = `Bearer ${data.access_token}`;
                setUser({ token: data.access_token });
                return true;
            }

            const loginData = await loginApi(email, password);
            localStorage.setItem('token', loginData.access_token);
            localStorage.setItem('zerodha_connected', 'false');
            api.defaults.headers.common.Authorization = `Bearer ${loginData.access_token}`;
            setUser({ token: loginData.access_token, email });
            try {
                const profile = await fetchCurrentUser();
                setUser({ token: loginData.access_token, ...profile });
            } catch (error) {
                // Keep basic session so routing can decide what to do next.
            }
            return true;
        } catch (error) {
            console.error("Signup failed", error);
            throw error;
        }
    };

    const logout = () => {
        disableLoginRedirect();
        localStorage.removeItem('token');
        localStorage.setItem('zerodha_connected', 'false');
        delete api.defaults.headers.common.Authorization;
        setUser(null);
        disableLoginRedirect();
        navigate('/');
        setTimeout(() => {
            enableLoginRedirect();
        }, 200);
    };

    const updateProfile = async (payload) => {
        const updatedUser = await updateCurrentUser(payload);
        const token = localStorage.getItem('token');
        setUser({ token, ...updatedUser });
        return updatedUser;
    };

    const completeOAuthLogin = async (token) => {
        localStorage.setItem('token', token);
        localStorage.setItem('zerodha_connected', 'false');
        api.defaults.headers.common.Authorization = `Bearer ${token}`;
        try {
            const profile = await fetchCurrentUser();
            setUser({ token, ...profile });
        } catch (error) {
            setUser({ token });
        }
        return true;
    };

    return (
        <AuthContext.Provider value={{ user, login, signup, logout, updateProfile, completeOAuthLogin, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
