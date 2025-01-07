import React, { useState, useEffect } from "react";
import axios from "axios";
import '@fortawesome/fontawesome-free/css/all.min.css';
import { useNavigate } from "react-router-dom";

const ChatAppVsGpt = () => {
    const [userMessage, setUserMessage] = useState("");
    const [amVerseConversation, setAmVerseConversation] = useState([]);
    const [chatGptConversation, setChatGptConversation] = useState([]);
    const [loading, setLoading] = useState(false);
    const [cancelToken, setCancelToken] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const token = sessionStorage.getItem('token');
        if (!token) {
            // If there's no token, the user is logged out, so show an alert
            alert("You have been logged out. Please log in to continue.");
            // Redirect to login page
            navigate("/login", { replace: true });
        }

        // Event listener for the browser back button
        const handlePopState = (event) => {
            // Check again if the user is logged in when they try to go back
            const token = sessionStorage.getItem('token');
            if (!token) {
                // If not logged in, show an alert and redirect
                alert("You need to log in first.");
                navigate("/login", { replace: true });
            }
        };

        // Listen for popstate event
        window.addEventListener('popstate', handlePopState);

        // Cleanup listener when the component unmounts
        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, [navigate]);
    
    const handleQuery = async () => {
        if (!userMessage.trim()) return;
    
        setUserMessage("");
        setLoading(true);
        
        // Retrieve the fullName from sessionStorage
        const userToken = JSON.parse(sessionStorage.getItem('token'));
        const fullName = userToken?.full_name || sessionStorage.getItem('fullName');
    
        // Check if fullName is available; if not, handle it gracefully (you can also return an error or prompt)
        if (!fullName) {
            console.error("Full name is required but not found.");
            setLoading(false);
            return;
        }
    
        // Add user's message to both AmVerse and ChatGPT conversations
        setAmVerseConversation((prev) => [...prev, { sender: "user", text: userMessage }]);
        setChatGptConversation((prev) => [...prev, { sender: "user", text: userMessage }]);
    
        const source = axios.CancelToken.source();
        setCancelToken(source);
    
        try {
            // Define a list of financial keywords and corresponding endpoints
            const financialEndpoints = {
                "financial assessment": "http://127.0.0.1:5000/get_financial_assessment",
                "goal setting": "http://127.0.0.1:5000/get_goal_setting",
                "tax planning": "http://127.0.0.1:5000/get_tax_planning",
                "budgeting": "http://127.0.0.1:5000/get_budgeting",
                "retirement planning": "http://127.0.0.1:5000/get_retirement_planning",
                "monitoring": "http://127.0.0.1:5000/get_monitoring"
            };
    
            let amVerseEndpoint = "http://127.0.0.1:5000/rag_query";  // Default RAG endpoint
            let chatGptEndpoint = "http://127.0.0.1:5000/gpt_query"; // GPT endpoint
    
            // Check if user message contains financial keywords and set the appropriate endpoint
            for (const [keyword, url] of Object.entries(financialEndpoints)) {
                if (userMessage.toLowerCase().includes(keyword)) {
                    amVerseEndpoint = url;  // Override the default RAG endpoint
                    break;
                }
            }
    
            // Make the API requests for AmVerse (RAG or financial) and ChatGPT
            const amVerseResponse = await axios.post(
                amVerseEndpoint, 
                { 
                    query: userMessage, 
                    customer_name: fullName  // Include the fullName in the request payload
                },
                { 
                    headers: { "Content-Type": "application/json" }, 
                    cancelToken: source.token 
                }
            );
    
            const chatGptResponse = await axios.post(
                chatGptEndpoint, 
                { 
                    query: userMessage 
                },
                { 
                    headers: { "Content-Type": "application/json" }, 
                    cancelToken: source.token 
                }
            );
    
            // Update AmVerse and ChatGPT conversations with the responses
            setAmVerseConversation((prev) => [
                ...prev,
                { sender: "AmVerse", text: formatResponse(amVerseResponse.data.response) }
            ]);
            setChatGptConversation((prev) => [
                ...prev,
                { sender: "ChatGPT", text: formatResponse(chatGptResponse.data.response) }
            ]);
    
        } catch (error) {
            if (axios.isCancel(error)) {
                console.log("Request canceled by user");
            } else {
                console.error("Error fetching data:", error.response ? error.response.data : error.message);
            }
        } finally {
            setLoading(false);
            setCancelToken(null);
        }
    };    

    const handleStopLoading = () => {
        if (cancelToken) {
            cancelToken.cancel();
            setLoading(false);
        }
    };

    const handleInputChange = (e) => setUserMessage(e.target.value);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            console.log("File selected:", file);
            // Here you can add code to handle file upload
        }
    };

    const formatResponse = (text) => {
        const hasNumberedList = /^\d+\.\s/.test(text);
    
        if (hasNumberedList) {
            const lines = text.split('\n');
            return lines.map((line, index) => {
                return line.replace(/^\d+\.\s/, `${index + 1}. `).trim();
            }).join('\n');
        }
    
        // Remove Markdown-style headings (e.g., ### or ####)
        const sanitizedText = text.replace(/^#+\s/gm, ""); // Removes '#### ', '### ', etc.
    
        // Handle bold formatting
        return sanitizedText.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    }; 

    const handleLogout = () => {
        // Clear session storage
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('fullName');
        
        // Navigate to the login page
        navigate("/login", { replace: true });
    };    

    return (
        <div style={styles.chatApp}>
            <div style={styles.sidebar}>
                <button style={styles.newChatButton} onClick={() => navigate("/chatapp")}>
                    AmVerse
                </button>
                <div style={styles.bottomButtons}>
                    <button style={styles.logoutButton} onClick={() => navigate("/customize-amverse")}>
                        Customize AmVerse
                    </button>
                    <button style={styles.logoutButton} onClick={() => navigate("/chatappvsgpt")}>
                        AmVerse VS ChatGPT
                    </button>
                    <button style={styles.logoutButton} onClick={handleLogout}>Log out</button>
                </div>  
            </div>

            <div style={styles.mainContainer}>
                <div style={styles.topHeader}>
                    <i className="fas fa-download" style={styles.icon}></i>
                    <i className="fas fa-user" style={styles.icon}></i>
                </div>

                <div style={styles.header}>
                    <h3>AmVerse</h3>
                    <h3>ChatGPT</h3>
                </div>

                <div style={styles.chatContainer}>
                    <div style={styles.botContainer}>
                        <div style={styles.messageContainer}>
                            {amVerseConversation.map((msg, index) => (
                                <div
                                    key={index}
                                    style={{
                                        ...styles.message,
                                        ...(msg.sender === "user" ? { ...styles.userMessageRight, flexDirection: "row-reverse" } : styles.amVerseMessageLeft),
                                    }}
                                >
                                    <span style={{ whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: msg.text }}></span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={styles.divider}></div>

                    <div style={styles.botContainer}>
                        <div style={styles.messageContainer}>
                            {chatGptConversation.map((msg, index) => (
                                <div
                                    key={index}
                                    style={{
                                        ...styles.message,
                                        ...(msg.sender === "user" ? { ...styles.userMessageRight, flexDirection: "row-reverse" } : styles.chatGptMessageLeft),
                                    }}
                                >
                                    <span style={{ whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: msg.text }}></span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div style={styles.inputContainer}>
                    <input
                        type="text"
                        value={userMessage}
                        onChange={handleInputChange}
                        placeholder="Type a new message here"
                        style={styles.textInput}
                    />
                    <button
                        onClick={loading ? handleStopLoading : handleQuery}
                        style={{
                            ...styles.sendButton,
                            opacity: !userMessage.trim() ? 0.5 : 1,
                        }}
                        disabled={loading} // Disable only while loading
                    >
                        {loading ? (
                            <i className="fas fa-spinner fa-spin"></i>
                        ) : (
                            <i className="fas fa-paper-plane"></i>
                        )}
                    </button>
                </div>

                {/* Hidden file input for file selection */}
                <input
                    type="file"
                    id="fileInput"
                    style={{ display: "none" }}
                    onChange={handleFileChange}
                />
            </div>
        </div>
    );
};

const styles = {
    chatApp: {
        display: "flex",
        height: "100vh",
        fontFamily: "Arial, sans-serif",
        backgroundColor: "#333",
        color: "white",
    },
    sidebar: {
        width: "200px",
        backgroundColor: "#111",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "20px",
    },
    newChatButton: {
        padding: "10px",
        backgroundColor: "#444",
        color: "#fff",
        border: "none",
        cursor: "pointer",
        borderRadius: "5px",
        marginBottom: "10px",
    },
    bottomButtons: {
        display: "flex",
        flexDirection: "column",
        gap: "10px",
    },
    logoutButton: {
        padding: "10px",
        backgroundColor: "#444",
        color: "#fff",
        border: "none",
        cursor: "pointer",
        borderRadius: "5px",
    },
    mainContainer: {
        display: "flex",
        flexDirection: "column",
        flex: 1,
        overflow: "hidden",
    },
    topHeader: {
        display: "flex",
        justifyContent: "flex-end",
        padding: "10px 20px",
        backgroundColor: "#333",
        borderBottom: "1px solid #666",
        gap: "10px",
    },
    icon: {
        color: "white",
        fontSize: "20px",
        cursor: "pointer",
    },
    header: {
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        padding: "10px",
        backgroundColor: "#444",
        borderBottom: "1px solid #666",
    },
    chatContainer: {
        display: "flex",
        flex: 1,
        padding: "10px",
        gap: "10px",
    },
    botContainer: {
        flex: 1,
        backgroundColor: "#333",
        borderRadius: "5px",
        overflowY: "auto",
        padding: "10px",
    },
    divider: {
        width: "1px",
        backgroundColor: "#666",
        height: "100%",
        alignSelf: "stretch",
    },
    messageContainer: {
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        overflowY: "auto",
        maxHeight: "500px",
        paddingRight: "10px", 
    },
    message: {
        display: "flex",
        padding: "10px",
        borderRadius: "10px",
        maxWidth: "80%",
        wordWrap: "break-word",
    },
    userMessageRight: {
        alignSelf: "flex-end",
        backgroundColor: "#555",
        color: "#fff",
        marginLeft: "auto",
    },
    amVerseMessageLeft: {
        alignSelf: "flex-start",
        backgroundColor: "#888",
        color: "#fff",
    },
    chatGptMessageLeft: {
        alignSelf: "flex-start",
        backgroundColor: "#4caf50",
        color: "#fff",
    },
    inputContainer: {
        display: "flex",
        alignItems: "center",
        padding: "10px",
        backgroundColor: "#444",
        borderTop: "1px solid #666",
        gap: "8px", // Space between input, attach, and send buttons
    },
    textInput: {
        flex: 1,
        padding: "10px",
        backgroundColor: "#222",
        color: "#fff",
        border: "none",
        borderRadius: "5px",
    },
    attachButton: {
        padding: "8px",
        backgroundColor: "transparent",
        color: "white",
        border: "none",
        fontSize: "18px",
        cursor: "pointer",
    },
    sendButton: {
        padding: "8px",
        backgroundColor: "transparent",
        color: "white",
        border: "none",
        fontSize: "18px",
        cursor: "pointer",
        borderRadius: "5px",
    },
    loadingIconContainer: {
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },
    pauseIcon: {
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)", // Center the pause icon
        color: "#fff",
        fontSize: "20px",
    },
    loader: {
        border: "2px solid #444",
        borderTop: "2px solid #888",
        borderRadius: "50%",
        width: "30px", // Adjusted size
        height: "30px", // Adjusted size
        animation: "spin 1s linear infinite",
    },
};

// CSS for loading animation
const globalStyles = `
@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
`;
document.head.insertAdjacentHTML("beforeend", <style>${globalStyles}</style>);

export default ChatAppVsGpt;