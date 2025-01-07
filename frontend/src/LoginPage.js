// src/Login.js
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from './supabase';

const Login = ({ setToken }) => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    const handleChange = (event) => {
        setFormData((prevFormData) => ({
            ...prevFormData,
            [event.target.name]: event.target.value,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
    
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: formData.email,
                password: formData.password,
            });
    
            if (error) throw error;
    
            // Fetch user data after login
            const { data: userData, error: userError } = await supabase.auth.getUser();
    
            if (userError) throw userError;
    
            const fullName = userData.user?.user_metadata?.full_name || "User"; // Default to "User" if full_name is missing
    
            const userToken = { access_token: data.session.access_token, email: data.user.email, full_name: fullName };
            sessionStorage.setItem('token', JSON.stringify(userToken));
            sessionStorage.setItem('fullName', fullName); // Store the full name
            setToken(userToken);
            setSuccess("Login successful!");
    
            // Redirect to homepage after successful login
            navigate('/chatapp'); 
        } catch (error) {
            setError(error.message);
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.formContainer}>
                <h2 style={styles.heading}>Login</h2>
                <form onSubmit={handleSubmit} style={styles.form}>
                    <input
                        type="email"
                        placeholder="Email"
                        name="email"
                        onChange={handleChange}
                        required
                        style={styles.input}
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        name="password"
                        onChange={handleChange}
                        required
                        style={styles.input}
                    />
                    <button type="submit" style={styles.button}>Login</button>
                    {error && <p style={styles.error}>{error}</p>}
                    {success && <p style={styles.success}>{success}</p>}
                </form>
                <p style={styles.text}>
                    Don't have an account? <Link to="/signup" style={styles.link}>Sign Up</Link>
                </p>
            </div>
        </div>
    );
};

const styles = {
    container: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        backgroundColor: "#f0f4f8",
    },
    formContainer: {
        width: "100%",
        maxWidth: "400px",
        padding: "20px",
        backgroundColor: "#ffffff",
        boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
        borderRadius: "8px",
        textAlign: "center",
    },
    heading: {
        color: "#333",
        marginBottom: "20px",
    },
    form: {
        display: "flex",
        flexDirection: "column",
    },
    input: {
        padding: "10px",
        margin: "10px 0",
        borderRadius: "5px",
        border: "1px solid #ddd",
        fontSize: "16px",
    },
    button: {
        padding: "10px",
        marginTop: "10px",
        borderRadius: "5px",
        border: "none",
        backgroundColor: "#4CAF50",
        color: "white",
        fontSize: "16px",
        cursor: "pointer",
    },
    error: {
        color: "red",
        marginTop: "10px",
    },
    success: { 
        color: "green", 
        marginTop: "10px",
    },
    text: {
        marginTop: "20px",
        color: "#555",
    },
    link: {
        color: "#4CAF50",
        textDecoration: "none",
    },
};

export default Login;
