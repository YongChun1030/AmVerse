import React, { useState, useEffect } from "react";
import axios from "axios";
import '@fortawesome/fontawesome-free/css/all.min.css';
import { useNavigate } from "react-router-dom";
import { supabase } from './supabase';
import { jsPDF } from 'jspdf';
import ScreenshotViewer from "./ScreenshotViewer";

const ChatApp = () => {
    const [userMessage, setUserMessage] = useState("");
    const [conversation, setConversation] = useState([]);
    const [loading, setLoading] = useState(false);
    const [cancelToken, setCancelToken] = useState(null);
    const [chats, setChats] = useState([]);
    const [userId, setUserId] = useState(null);
    const [currentChatId, setCurrentChatId] = useState(null);
    const navigate = useNavigate();
    const [showAdviceButtons, setShowAdviceButtons] = useState(true);
    const [loadingMessage, setLoadingMessage] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentScreenshot, setCurrentScreenshot] = useState(0);
    const [screenshots, setScreenshots] = useState([]);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [username, setUsername] = useState("");

    useEffect(() => {
        const userToken = JSON.parse(sessionStorage.getItem("token"));
        const fullName = userToken?.full_name || sessionStorage.getItem("fullName");
        setUsername(fullName);
    }, []);

    useEffect(() => {
        const fetchUser = async () => {
            const { data, error } = await supabase.auth.getUser();
            if (error) {
                console.error("Error fetching user:", error.message);
                navigate("/login"); // Redirect to login if user is not authenticated
                return;
            }
    
            if (data?.user) {
                setUserId(data.user.id);
                await loadChatHistory(data.user.id);
            } else {
                navigate("/login");
            }
        };
        fetchUser();
    }, [navigate]); // Include navigate in the dependency array        

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
    
    const loadChatHistory = async (userId) => {
        const { data, error } = await supabase
            .from('chats')
            .select('*')
            .eq('user_id', userId);
    
        if (error) {
            console.error("Error fetching chats:", error.message);
        } else {
            console.log("Fetched Chats:", data); 
            setChats(data || []);
        }
    };

    const handleAdviceSelection = async (type) => {
        setShowAdviceButtons(false);
        setLoadingMessage(true);
        setLoading(true);
    
        const source = axios.CancelToken.source();
        setCancelToken(source);
    
        const userToken = JSON.parse(sessionStorage.getItem('token'));
        const fullName = userToken?.full_name || sessionStorage.getItem('fullName');
    
        const financialEndpoints = {
            "financial assessment": "http://127.0.0.1:5000/get_financial_assessment",
            "goal setting": "http://127.0.0.1:5000/get_goal_setting",
            "tax planning": "http://127.0.0.1:5000/get_tax_planning",
            "budgeting": "http://127.0.0.1:5000/get_budgeting",
            "retirement planning": "http://127.0.0.1:5000/get_retirement_planning",
        };
    
        const endpoint = financialEndpoints[type];
    
        try {
            const response = await axios.post(
                endpoint,
                { query: type, customer_name: fullName }, // Include customer_name
                { cancelToken: source.token }
            );
    
            const botResponse = {
                sender: "AmVerse",
                text: formatResponse(response.data.response),
            };
    
            const finalConversation = [...conversation, botResponse];
            setConversation(finalConversation);
            await saveChat(finalConversation);
        } catch (error) {
            if (error.response?.status === 404) {
                setConversation([...conversation, {
                    sender: "AmVerse",
                    text: "No relevant data found in the system. Please contact the system administrator."
                }]);
            } else {
                console.error("Error:", error.message);
            }
        } finally {
            setLoading(false);
            setLoadingMessage(false);
        }
    };
    
    const handleNewChat = () => {
        setConversation([]); // Clear the conversation
        setCurrentChatId(null); // Reset the chat ID
        setShowAdviceButtons(true); // Ensure advice buttons are visible
    };
    
    const saveChat = async (messages) => {
        if (!userId) return;
    
        const title = messages.length > 0 ? messages[0].text : "AmVerse Chat";
        console.log("Saving Chat:", { currentChatId, userId, title, messages });
    
        if (currentChatId) {
            const { error } = await supabase
                .from('chats')
                .update({ title, messages: JSON.stringify(messages) })
                .eq('id', currentChatId);
            if (error) {
                console.error("Error updating chat:", error.message);
            } else {
                await loadChatHistory(userId);
            }
        } else {
            const { data, error } = await supabase
                .from('chats')
                .insert([{ user_id: userId, title, messages: JSON.stringify(messages) }])
                .select()
                .single();
            if (error) {
                console.error("Error saving new chat:", error.message);
            } else {
                setChats((prev) => [...prev, data]);
                setCurrentChatId(data.id);
            }
        }
    };       
    
    const handleQuery = async () => {
        if (!userMessage.trim()) return;
        setShowAdviceButtons(false);
        setLoading(true);
        const newMessage = { sender: "user", text: userMessage };
        const updatedConversation = [...conversation, newMessage];
        setConversation(updatedConversation);
        setUserMessage(""); // Clear input field
    
        const source = axios.CancelToken.source();
        setCancelToken(source);
    
        const userToken = JSON.parse(sessionStorage.getItem('token'));
        const fullName = userToken?.full_name || sessionStorage.getItem('fullName');
    
        try {
            const MAX_HISTORY_LENGTH = 10; // Limit history size
            const chatHistory = updatedConversation
                .slice(-MAX_HISTORY_LENGTH)
                .map(msg => msg.text)
                .join(" ");
    
            // Define financial-specific endpoints
            const financialEndpoints = {
                "financial assessment": "http://127.0.0.1:5000/get_financial_assessment",
                "goal setting": "http://127.0.0.1:5000/get_goal_setting",
                "tax planning": "http://127.0.0.1:5000/get_tax_planning",
                "budgeting": "http://127.0.0.1:5000/get_budgeting",
                "retirement planning": "http://127.0.0.1:5000/get_retirement_planning"
            };
    
            // Detect if query matches a financial-specific keyword
            let endpoint = "http://127.0.0.1:5000/rag_query"; // Default endpoint
            let isFinancialQuery = false;
            for (const [keyword, url] of Object.entries(financialEndpoints)) {
                if (userMessage.toLowerCase().includes(keyword)) {
                    endpoint = url;
                    isFinancialQuery = true;
                    break;
                }
            }
    
            // Prepare payload
            const payload = {
                query: userMessage,
                context: chatHistory,
                customer_name: fullName
            };
    
            // Make the request to the appropriate endpoint
            const response = await axios.post(endpoint, payload, { cancelToken: source.token });
            
            console.log("Response from backend:", response.data);

            // Process response
            const botResponse = {
                sender: "AmVerse",
                text: formatResponse(response.data.response),
                sources: response.data.sources || []
            };
    
            // Update conversation
            const finalConversation = [...updatedConversation, botResponse];
            setConversation(finalConversation);
    
            // Save chat
            await saveChat(finalConversation);
    
            // Log rebuilt query if it's a rag_query
            if (!isFinancialQuery) {
                console.log("Rebuilt Query:", response.data.rebuilt_query); // Debugging
            }
    
        } catch (error) {
            if (axios.isCancel(error)) {
                console.log("Request canceled by user");
            } else if (error.response?.status === 404) {
                setConversation([...updatedConversation, {
                    sender: "AmVerse",
                    text: "No relevant data found in the system. Please contact the system administrator."
                }]);
            } else {
                console.error("Error during query:", error.message);
                setConversation([...updatedConversation, {
                    sender: "AmVerse",
                    text: "Oops! Something went wrong. Please try again later."
                }]);
            }
        } finally {
            setLoading(false);
            setCancelToken(null);
        }
    };         

    const handleViewResources = (sources) => {
        const screenshotUrls = sources.map((source) => source.metadata?.screenshot_url).filter(Boolean);
        setScreenshots(screenshotUrls);
        setCurrentScreenshot(0); // Start from the first screenshot
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setScreenshots([]);
    };

    const nextScreenshot = () => {
        setCurrentScreenshot((prev) => (prev + 1) % screenshots.length);
    };

    const prevScreenshot = () => {
        setCurrentScreenshot((prev) => (prev - 1 + screenshots.length) % screenshots.length);
    };

    const renderResourcesButton = (sources) => {
        if (!sources || sources.length === 0) return null;
        return (
            <button
                style={styles.viewResourcesButton}
                onClick={() => handleViewResources(sources)}
            >
                View Resources
            </button>
        );
    };
     
    const handleStopLoading = () => {
        if (cancelToken) {
            cancelToken.cancel();
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        setUserMessage(e.target.value);
    };    

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            console.log("File selected:", file);
            // Add code to handle file upload here
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

    const downloadConversation = () => {
        if (conversation.length === 0) {
            alert("No conversation to download");
            return;
        }
    
        const doc = new jsPDF();
    
        // Add a title to the PDF
        doc.setFontSize(16);
        doc.text("AmVerse Chat Conversation", 10, 10);
    
        // Leave some space after the title
        let yOffset = 20;
        doc.setFontSize(12);
    
        // Loop through the conversation and add messages to the PDF
        conversation.forEach((msg, index) => {
            const senderPrefix = msg.sender === "user" ? "User: " : "AmVerse: ";
            const text = `${senderPrefix}${msg.text}`;
    
            // Split long text into multiple lines if needed
            const lines = doc.splitTextToSize(text, 180); // Wrap text if too long
            doc.text(lines, 10, yOffset);
            yOffset += 10 * lines.length + 5; // Add spacing
    
            // Add a new page if content exceeds the page height
            if (yOffset > 280) { 
                doc.addPage();
                yOffset = 20;
            }
        });
    
        // Save the PDF file
        doc.save('AmVerse_Conversation.pdf');
    };

    const handleDeleteChat = async (e, chatId) => {
        e.stopPropagation(); // Prevent the click event from triggering the card selection
    
        // Delete the chat from Supabase
        const { error } = await supabase
            .from('chats')
            .delete()
            .eq('id', chatId);
    
        if (error) {
            console.error("Error deleting chat:", error.message);
        } else {
            // Remove the chat from the local state (UI update)
            setChats((prevChats) => prevChats.filter((chat) => chat.id !== chatId));
    
            // If the current chat was deleted, clear the conversation state
            if (chatId === currentChatId) {
                setConversation([]); // Clear the current conversation from UI
                setCurrentChatId(null); // Reset the current chat ID
            }
        }
    };
    
    const handleLogout = () => {
        // Clear session storage
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('fullName');
        
        // Navigate to the login page
        navigate("/homepage", { replace: true });
    };   

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && userMessage.trim()) {
            handleQuery(); // Call the query function
        }
    };    

    return (
        <div style={styles.chatApp}>
            <div style={styles.sidebar}>
                <div style={styles.topSection}>
                    <button 
                        style={styles.newChatButton} 
                        onClick={() => navigate("/chatapp")}
                    >
                        AmVerse
                    </button>
                    <button 
                        style={styles.newChatButton} 
                        onClick={handleNewChat}
                    >
                        + New Chat
                    </button>
                    
                    {/* Recent Chats Section */}
                    <div style={styles.recentChats}>
                        <span style={styles.sectionHeader}>Recent Chats</span>
                        <div style={styles.recentChatsScrollable}>
                            {chats.length > 0 ? (
                                chats.slice().reverse().map(chat => (
                                    <div
                                        key={chat.id}
                                        style={styles.chatCard}
                                        onClick={() => {
                                            setConversation(JSON.parse(chat.messages));
                                            setCurrentChatId(chat.id);
                                        }}
                                    >
                                        <span style={styles.chatTitleText}>
                                            {chat.title.length > 20 ? chat.title.substring(0, 20) + '...' : chat.title}
                                        </span>

                                        {/* Delete Button */}
                                        <button
                                            onClick={(e) => handleDeleteChat(e, chat.id)}
                                            style={styles.deleteButton}
                                            title="Delete Chat"
                                        >
                                            <i className="fas fa-trash"></i>
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <span style={styles.noChats}>No recent chats</span>
                            )}
                        </div>
                    </div>
                </div>
                    <div style={styles.bottomButtons}>
                        <button 
                            style={styles.logoutButton} 
                            onClick={() => navigate("/customize-amverse")}
                        >
                            Customize AmVerse
                        </button>
                        {/*<button style={styles.logoutButton} onClick={() => navigate("/chatappvsgpt")}>AmVerse VS ChatGPT</button>*/}
                        <button style={styles.logoutButton} onClick={handleLogout}>Log out</button>
                    </div>
            </div>

            <div style={styles.mainContainer}>
                <div style={styles.topHeader}>
                    <h3 style={styles.header}>AmVerse</h3>
                    <div style={styles.iconGroup}>
                        <button onClick={downloadConversation} style={styles.iconButton}>
                            <i className="fas fa-download" style={styles.icon}></i>
                        </button>
                        <button 
                            onClick={() => setIsProfileModalOpen(true)} 
                            style={styles.iconButton}>
                            <i className="fas fa-user" style={styles.icon}></i>
                        </button>
                    </div>
                </div>

                {showAdviceButtons && conversation.length === 0 && (
                    <div style={styles.centerContainer}>
                        <h1 style={styles.welcomeMessage}>Welcome to AmVerse!</h1>
                        <p style={styles.subMessage}>
                            Try this!
                        </p>
                        <div style={styles.adviceButtonContainer}>
                            <button 
                                onClick={() => handleAdviceSelection("financial assessment")} 
                                style={styles.adviceButton}
                            >
                                Financial Assessment
                            </button>
                            <button 
                                onClick={() => handleAdviceSelection("goal setting")} 
                                style={styles.adviceButton}
                            >
                                Goal Setting
                            </button>
                            <button 
                                onClick={() => handleAdviceSelection("tax planning")} 
                                style={styles.adviceButton}
                            >
                                Tax Planning
                            </button>
                            <button 
                                onClick={() => handleAdviceSelection("budgeting")} 
                                style={styles.adviceButton}
                            >
                                Budgeting
                            </button>
                            <button 
                                onClick={() => handleAdviceSelection("retirement planning")} 
                                style={styles.adviceButton}
                            >
                                Retirement Planning
                            </button>
                        </div>
                    </div>
                )}

                {loadingMessage && (
                    <div style={styles.centerContainer}>
                        <div style={styles.loadingMessage}>
                            <i className="fas fa-spinner fa-spin"></i> Generating response, please wait...
                        </div>
                    </div>
                )}

                <div style={styles.chatContainer}>
                    <div style={styles.botContainer}>
                    <div style={styles.messageContainer}>
                        {conversation.map((msg, index) => (
                            <div
                            key={index}
                            style={{
                                ...styles.message,
                                ...(msg.sender === "user"
                                ? { ...styles.userMessageRight, flexDirection: "row-reverse" }
                                : styles.amVerseMessageLeft),
                            }}
                            >
                            {/* Container for bot message and button */}
                            <div style={styles.messageContent}>
                                {/* Display the response */}
                                <span
                                style={{ whiteSpace: "pre-wrap" }}
                                dangerouslySetInnerHTML={{ __html: msg.text }}
                                ></span>

                                {/* Place the "View Resources" button below the response */}
                                {msg.sources && msg.sources.length > 0 && (
                                <div style={styles.viewResourcesWrapper}>
                                    {renderResourcesButton(msg.sources)}
                                </div>
                                )}
                            </div>
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
                        onKeyDown={handleKeyDown}
                        placeholder="Type a new message here"
                        style={styles.textInput}
                    />
                    <button
                        onClick={loading ? handleStopLoading : handleQuery}
                        style={{
                            ...styles.sendButton,
                            opacity: !userMessage.trim() ? 0.5 : 1,
                        }}
                        disabled={loading}
                    >
                        {loading ? (
                            <i className="fas fa-spinner fa-spin"></i>
                        ) : (
                            <i className="fas fa-paper-plane"></i>
                        )}
                    </button>
                </div>

                <input
                    type="file"
                    id="fileInput"
                    style={{ display: "none" }}
                    onChange={handleFileChange}
                />
            </div>

            {isProfileModalOpen && (
                <div style={styles.modal}>
                    <div style={styles.modalContent2}>
                        <button style={styles.closeButton} onClick={() => setIsProfileModalOpen(false)}>
                            &times;
                        </button>
                        <h2 style={styles.modalHeader}>User Profile</h2>
                        <p style={styles.modalText}>Username: {username}</p>
                    </div>
                </div>
            )}

            {/* Modal for Viewing Screenshots */}
            {isModalOpen && (
                <div style={styles.modal}>
                    <div style={styles.modalContent}>
                        <button style={styles.closeButton} onClick={closeModal}>
                            &times;
                        </button>
                        {/* Pass screenshots and current index */}
                        <ScreenshotViewer
                            screenshots={screenshots}
                            initialIndex={currentScreenshot}
                            onClose={closeModal}
                        />
                        {screenshots.length > 1 && (
                            <div style={styles.navigationButtons}>
                                <button
                                    onClick={prevScreenshot}
                                    disabled={currentScreenshot === 0}
                                    style={styles.navigationButton}
                                >
                                    &lt; Previous
                                </button>
                                <button
                                    onClick={nextScreenshot}
                                    disabled={currentScreenshot === screenshots.length - 1}
                                    style={styles.navigationButton}
                                >
                                    Next &gt;
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
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
        height: "94.5vh", // Full height
        padding: "20px",
    },
    topSection: {
        display: "flex",
        flexDirection: "column",
        gap: "15px",
    },
    newChatButton: {
        padding: "10px",
        backgroundColor: "#333",
        color: "#fff",
        border: "none",
        cursor: "pointer",
        borderRadius: "5px",
        transition: "background-color 0.3s",
    },
    newChatButtonHover: {
        backgroundColor: "#555",
    },
    messageContent: {
        display: "flex",
        flexDirection: "column", // Ensures vertical stacking of text and button
        alignItems: "flex-start", // Align content to the left
    },
    viewResourcesWrapper: {
        marginTop: "8px", // Adds spacing between the text and the button
        textAlign: "left", // Ensures the button aligns with the text
    },            
    recentChats: {
        marginTop: "20px",
        display: "flex",
        flexDirection: "column",
        color: "#ccc",
        gap: "10px",
    },
    recentChatsScrollable: {
        overflowY: "auto", // Makes the recent chats scrollable
        maxHeight: "370px", // Increase the height of the scrollable area
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        paddingRight: "5px",
    },
    sectionHeader: {
        fontSize: "16px",
        fontWeight: "bold",
        marginBottom: "10px",
        color: "#fff",
        flexShrink: 0, // Prevent shrinking when content overflows
    },
    chatCard: {
        display: "flex",
        justifyContent: "space-between", // Ensure space between chat title and delete button
        alignItems: "center",
        padding: "10px",
        backgroundColor: "#2a2a2a",
        borderRadius: "8px",
        cursor: "pointer",
        transition: "background-color 0.2s ease",
        boxShadow: "0 2px 5px rgba(0, 0, 0, 0.2)",
        marginBottom: "8px", // Add margin for spacing between chat cards
    },
    chatCardHover: {
        backgroundColor: "#3a3a3a",
    },
    chatTitleText: {
        color: "#fff", // Set text color to white
        fontSize: "14px", // Adjust font size as needed
        flex: 1, // Ensure it takes available space
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    },
    noChats: {
        fontSize: "14px",
        color: "#888",
        textAlign: "center",
        marginTop: "20px",
    },
    logoutButton: {
        padding: "10px",
        backgroundColor: "#444",
        color: "#fff",
        border: "none",
        cursor: "pointer",
        borderRadius: "5px",
    },
    logoutButtonHover: {
        backgroundColor: "#555",
    },
    bottomButtons: {
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        marginTop: "auto", // Push buttons to the bottom
    },
    mainContainer: { 
        display: "flex", 
        flexDirection: "column", 
        flex: 1, 
        overflow: "hidden",
    },
    iconButton: {
        backgroundColor: "transparent",
        border: "none",
        cursor: "pointer",
        padding: 0,
        margin: 0,
    },
    topHeader: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0 20px",
        height: "50px", 
        backgroundColor: "#333",
        borderBottom: "1px solid #666",
    },
    icon: {
        color: "white",
        fontSize: "20px",
        cursor: "pointer",
    },
    header: {
        margin: 0, 
        fontSize: "18px",
        fontWeight: "bold",
        color: "#fff",
        padding: "10px",
    },
    iconGroup: {
        display: "flex",
        alignItems: "center",
        gap: "10px",
    },
    chatContainer: {
        display: "flex",
        flex: 1,
        flexDirection: "column", 
        gap: "0px", 
    },
    botContainer: {
        flex: 1,
        backgroundColor: "#333",
        borderRadius: "5px",
        overflowY: "auto",
        padding: "10px",
    },
    messageContainer: {
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        overflowY: "auto",
        paddingRight: "10px",
        flex: 1,
        maxHeight: "calc(100vh - 120px)", // Adjust based on input height & header
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
    inputContainer: {
        display: "flex",
        alignItems: "center",
        padding: "10px",
        backgroundColor: "#444",
        borderTop: "1px solid #666",
        gap: "0px",
        marginTop: "auto", 
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
    centerContainer: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: 'calc(100vh - 120px)', // Adjust height considering header and input areas
        textAlign: 'center',
    },
    welcomeMessage: {
        fontSize: '24px',
        color: '#fff',
        marginBottom: '10px',
    },
    subMessage: {
        fontSize: '16px',
        color: '#ccc',
        marginBottom: '20px',
    },
    adviceButtonContainer: {
        display: 'flex',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: '15px',
        width: '100%',
    },
    adviceButton: {
        padding: '12px 24px',
        backgroundColor: '#333',
        color: '#fff',
        border: '1px solid white',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'background-color 0.3s ease, transform 0.2s ease',
        fontSize: '16px',
        fontWeight: 'bold',
        boxShadow: '0px 4px 6px rgba(0, 0, 0, 0.2)',
    },
    loadingMessage: {
        fontSize: '18px',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
    },
    sourceContainer: {
        marginTop: '10px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '5px',
    },    
    deleteButton: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '5px',
        marginLeft: '10px',
        color: '#ff3b3b', // Red color for the trash icon
        transition: 'color 0.2s ease',
    },
    deleteButtonHover: {
        color: '#ff0000', // Darker red on hover
    },
    viewResourcesButton: {
        padding: "4px 12px", // Compact button size
        fontSize: "12px", // Smaller text size
        color: "#FFFFFF", // Modern blue text color
        backgroundColor: "transparent", // Blank background
        border: "2px solid #000000", // Blue border
        borderRadius: "4px", // Smooth edges
        cursor: "pointer", // Pointer cursor for interactivity
        transition: "all 0.3s ease", // Smooth transition for hover effects
    },
    modal: {
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
    },
    modalContent: {
        position: "relative",
        backgroundColor: "#fff",
        padding: "20px",
        borderRadius: "8px",
        textAlign: "center",
    },
    modalContent2: {
        position: "relative",
        backgroundColor: "#fff",
        padding: "20px",
        borderRadius: "8px",
        textAlign: "center",
        boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
        maxWidth: "400px",
        margin: "0 auto",
        color: "#000", 
    },
    modalHeader: {
        fontSize: "18px",
        fontWeight: "bold",
        color: "#000",
    },
    modalText: {
        fontSize: "16px",
        color: "#000",
    },    
    closeButton: {
        position: "absolute",
        top: "10px",
        right: "10px",
        background: "none",
        border: "none",
        fontSize: "24px",
        cursor: "pointer",
    },
    screenshot: {
        maxWidth: "100%",
        maxHeight: "80vh",
        marginBottom: "20px", 
    },     
    navigationButtons: {
        display: "flex",
        justifyContent: "space-between",
        gap: "10px",
    },
    navigationButton: {
        padding: "10px 20px",
        backgroundColor: "#333",
        color: "#fff",
        border: "1px solid white",
        borderRadius: "5px",
        cursor: "pointer",
        margin: "0 10px",
    },
};

export default ChatApp;
