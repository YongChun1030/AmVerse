import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import ChatApp from './ChatApp'; // AmVerse-only page
import ChatAppVsGpt from './ChatAppVsGpt'; // AmVerse vs ChatGPT page
import Login from './LoginPage';
import SignUp from './SignupPage';
import Homepage from './HomePage';
import CustomizeAmverse from './CustomizeAmVerse';

const App = () => {
    const [token, setToken] = useState(null);

    useEffect(() => {
        const storedToken = sessionStorage.getItem('token');
        if (storedToken) {
            setToken(JSON.parse(storedToken));
        }
    }, []);

    useEffect(() => {
        if (token) {
            sessionStorage.setItem('token', JSON.stringify(token));
        }
    }, [token]);

    return (
        <Router>
            <Routes>
                <Route path="/signup" element={<SignUp setToken={setToken} />} />
                <Route path="/login" element={<Login setToken={setToken} />} />
                <Route path="/homepage" element={<Homepage token={token} />} />
                <Route path="/chatapp" element={token ? <ChatApp token={token} /> : <Navigate to="/login" />} />
                <Route path="/chatappvsgpt" element={token ? <ChatAppVsGpt token={token} /> : <Navigate to="/login" />} />
                <Route path="/customize-amverse" element={token ? <CustomizeAmverse /> : <Navigate to="/login" />} />
                {/* Redirect root route to Homepage */}
                <Route path="/" element={<Navigate to="/homepage" />} />
            </Routes>
        </Router>
    );
};

export default App;
