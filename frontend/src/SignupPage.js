// src/SignUp.js
import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from './supabase';

const SignUp = ({ setToken }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        password: '',
    });
    const [modalOpen, setModalOpen] = useState(false);
    const [modalTitle, setModalTitle] = useState("");
    const [modalMessage, setModalMessage] = useState("");
    const [showGmailButton, setShowGmailButton] = useState(false);
    const [showCloseButton, setShowCloseButton] = useState(false);
    const [showLoginButton, setShowLoginButton] = useState(false);

    const handleChange = (event) => {
        setFormData((prevFormData) => ({
            ...prevFormData,
            [event.target.name]: event.target.value,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const { email, password, fullName } = formData;

        // Try signing up the user
        const response = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName, // Store full name during sign-up
                },
                emailRedirectTo: `${location.origin}/auth/callback`,
            },
        });

        // Log the sign-up response
        console.log("Sign-up response:", JSON.stringify(response, null, 2));

        if (response.data && response.data.user) {
            // Log the identities array
            console.log("Identities array:", JSON.stringify(response.data.user.identities, null, 2));
            
            // Check if the user got created
            if (response.data.user.identities && response.data.user.identities.length > 0) {
                console.log("Sign-up successful!");
                setModalTitle("Almost There!");
                setModalMessage("A verification email has been sent. Please verify your email to continue.");
                setShowGmailButton(true);
                setShowCloseButton(false);
                setShowLoginButton(false);
                setModalOpen(true);
                // Do NOT navigate to homepage immediately
            } else {
                console.log("Email address is already taken.");
                // Sign in the existing user
                const signInResponse = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });

                if (signInResponse.error) {
                    console.error("An error occurred during sign-in:", signInResponse.error.message);
                    setModalTitle("Sign-in Error");
                    setModalMessage(signInResponse.error.message || "An unknown error occurred.");
                    setShowCloseButton(true);
                    setShowLoginButton(false);
                    setShowGmailButton(false);
                    setModalOpen(true);
                } else {
                    console.log("Successfully signed in existing user!");
                    const userToken = { 
                        email: signInResponse.data.user.email,
                        full_name: signInResponse.data.user.user_metadata.full_name, // Ensure you get the full name if available
                    };
                    sessionStorage.setItem('token', JSON.stringify(userToken));
                    setToken(userToken); // Update state with user token
                    navigate('/homepage'); // Navigate to homepage after signing in
                }
            }
        } else {
            console.error("An error occurred during sign-up:", response.error?.message);
            setModalTitle("Sign-up Error");
            setModalMessage(response.error?.message || "An unknown error occurred during sign-up.");
            setShowCloseButton(true);
            setShowLoginButton(false);
            setShowGmailButton(false);
            setModalOpen(true);
        }
    };

    const handleGmailRedirect = () => {
        window.location.href = 'https://mail.google.com/';
    };

    const handleCloseModal = () => {
        setModalOpen(false);
        setFormData({ fullName: '', email: '', password: '' });
    };

    const handleGoToLogin = () => {
        navigate("/"); // Navigate to the login page
        setModalOpen(false);
    };

    return (
        <div style={styles.container}>
            <div style={styles.formContainer}>
                <h2 style={styles.heading}>Sign Up</h2>
                <form onSubmit={handleSubmit} style={styles.form}>
                    <input
                        type="text"
                        placeholder="Full name"
                        name="fullName"
                        value={formData.fullName}
                        onChange={handleChange}
                        required
                        style={styles.input}
                    />
                    <input
                        type="email"
                        placeholder="Email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        style={styles.input}
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        required
                        style={styles.input}
                    />
                    <button type="submit" style={styles.button}>Submit</button>
                </form>
                <p style={styles.text}>
                    Already have an account? <Link to="/" style={styles.link}>Login</Link>
                </p>
            </div>

            {modalOpen && (
                <div style={styles.modalOverlay}>
                    <div style={styles.modalContent}>
                        <h2>{modalTitle}</h2>
                        <p>{modalMessage}</p>
                        <div style={styles.modalButtonContainer}>
                            {showGmailButton && (
                                <button style={styles.modalButton} onClick={handleGmailRedirect}>Go to Gmail</button>
                            )}
                            {showCloseButton && (
                                <button style={styles.modalButton} onClick={handleCloseModal}>Close</button>
                            )}
                            {showLoginButton && (
                                <button style={styles.modalButton} onClick={handleGoToLogin}>Go to Login</button>
                            )}
                        </div>
                    </div>
                </div>
            )}
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
    modalButtonContainer: {
        display: 'flex',
        flexDirection: 'column', // Stack buttons vertically
        gap: '10px', // Space between buttons
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
    modalOverlay: {
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },
    modalContent: {
        backgroundColor: "#fff",
        padding: "20px",
        borderRadius: "8px",
        boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
        textAlign: "center",
    },
    modalButton: {
        padding: "10px 20px",
        fontSize: "16px",
        cursor: "pointer",
        marginTop: "10px",
        backgroundColor: "#4CAF50",
        color: "white",
        border: "none",
        borderRadius: "5px",
    },
};

export default SignUp;
