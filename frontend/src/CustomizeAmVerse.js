import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import '@fortawesome/fontawesome-free/css/all.min.css';
import { useNavigate } from "react-router-dom";
import { supabase } from './supabase';

const CustomizeAmVerse = () => {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [indexType, setIndexType] = useState("User");
    const [privateName, setPrivateName] = useState('');
    const [customPrompt, setCustomPrompt] = useState("");
    const [conversation, setConversation] = useState([]);
    const [userMessage, setUserMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [screenshots, setScreenshots] = useState([]);
    const [currentScreenshot, setCurrentScreenshot] = useState(0);
    const [isSectionOpen, setIsSectionOpen] = useState(true);
    const navigate = useNavigate();
    const userToken = JSON.parse(sessionStorage.getItem('token'));
    const customerName = userToken?.full_name || sessionStorage.getItem('fullName');

    const fetchUserId = async () => {
        const { data, error } = await supabase.auth.getUser();
        if (error) {
            console.error("Error fetching user:", error.message);
            return null;
        }
        return data?.user?.id || null;
    };    

    const toggleSection = () => {
        setIsSectionOpen((prev) => !prev);
    };

    const loadChatHistoryFromCustomChat = useCallback(async (userId) => {
        if (!userId) {
            console.error("User ID is null. Cannot load chat history.");
            return;
        }
    
        try {
            const { data, error } = await supabase
                .from('custom_chat')
                .select('message')
                .eq('user_id', userId)
                .single();
    
            if (error) {
                console.error("Error loading chat history from Supabase:", error.message);
                return;
            }
    
            if (data && data.message) {
                const formattedHistory = JSON.parse(data.message); // Deserialize JSON
                setConversation(formattedHistory);
                console.log("Chat history loaded successfully:", formattedHistory);
            } else {
                console.log("No chat history found for this user.");
            }
        } catch (error) {
            console.error("Unexpected error loading chat history:", error.message);
        }
    }, []);
    

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const userId = await fetchUserId();
                console.log("Initializing with User ID:", userId);
                if (userId) {
                    await loadChatHistoryFromCustomChat(userId);
                    await loadLatestPromptTemplate(userId);
                } else {
                    console.error("User ID not found during initialization.");
                }
            } catch (err) {
                console.error("Unexpected error in loadInitialData:", err.message);
            }
        };
    
        loadInitialData();
    }, [loadChatHistoryFromCustomChat]);
    
    

    useEffect(() => {
        const token = sessionStorage.getItem('token');
        if (!token) {
            alert("You have been logged out. Please log in to continue."); 
            navigate("/login", { replace: true });
        }

        const handlePopState = () => {
            const token = sessionStorage.getItem('token');
            if (!token) {
                alert("You need to log in first.");
                navigate("/login", { replace: true });
            }
        };

        window.addEventListener('popstate', handlePopState);

        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, [navigate]);

    const handleCustomPromptChange = (e) => {
        setCustomPrompt(e.target.value);
    };

    const handleNameChange = (e) => {
        setPrivateName(e.target.value);
    }; 

    const handleChatSubmit = async () => {
        if (!userMessage.trim()) return;

        setLoading(true);

        const newMessage = { sender: "user", text: userMessage };
        const updatedConversation = [...conversation, newMessage];
        setConversation(updatedConversation);
        setUserMessage(""); // Clear input field

        try {
            const chatHistory = updatedConversation.map((msg) => msg.text).join("\n");

            const response = await axios.post("http://127.0.0.1:5000/rag_query_custom", {
                query: userMessage,
                context: chatHistory,
                customer_name: customerName,
                customPrompt: customPrompt,
            });

            console.log("Response from backend:", response.data);

            const botResponse = {
                sender: "AmVerse",
                text: response.data.response,
                sources: response.data.sources || [],
            };
            const finalConversation = [...updatedConversation, botResponse];
            setConversation(finalConversation);

            await saveChatToCustomChat(finalConversation);
        } catch (error) {
            console.error("Error during chat:", error.message);
            setConversation([...updatedConversation, {
                sender: "AmVerse",
                text: "Oops! Something went wrong. Please try again later.",
            }]);
        } finally {
            setLoading(false);
        }
    };

    const saveChatToCustomChat = async (messages) => {
        const userId = await fetchUserId();
        if (!userId) return;
    
        console.log("Saving Chat to Custom Chat:", { userId, messages });
    
        try {
            // Use upsert with conflict handling
            const { error } = await supabase
                .from('custom_chat')
                .upsert(
                    [
                        {
                            user_id: userId,
                            message: JSON.stringify(messages), // Save the entire conversation as JSON
                            created_at: new Date().toISOString(), // Ensure the timestamp is updated
                        },
                    ],
                    { onConflict: 'user_id' } // Handle conflict on user_id
                );
    
            if (error) {
                console.error("Error saving/updating chat in Supabase:", error.message);
            } else {
                console.log("Chat saved/updated successfully.");
            }
        } catch (error) {
            console.error("Unexpected error saving chat:", error.message);
        }
    };    
    
    const savePromptTemplate = async (promptTemplate) => {
        const userId = await fetchUserId();
        if (!userId) {
            console.error("User ID not found. Cannot save template.");
            return;
        }
    
        try {
            console.log("Saving prompt template:", promptTemplate);
            const { error } = await supabase
                .from('prompt_template')
                .upsert({ user_id: userId, template: promptTemplate }, { onConflict: 'user_id' });
    
            if (error) {
                console.error("Error saving prompt template:", error.message);
            } else {
                console.log("Prompt template saved successfully.");
            }
        } catch (error) {
            console.error("Unexpected error:", error.message);
        }
    };    

    const loadLatestPromptTemplate = async (userId) => {
        try {
            const { data, error } = await supabase
                .from('prompt_template')
                .select('template')
                .eq('user_id', userId)
                .single();

            if (error) {
                console.error("Error fetching prompt template:", error.message);
            } else {
                setCustomPrompt(data?.template || ""); // Default if no template exists
            }
        } catch (error) {
            console.error("Unexpected error loading prompt template:", error.message);
        }
    };

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile && selectedFile.name.toLowerCase().endsWith(".pdf")) {
            setFile(selectedFile);
        } else {
            alert("Only PDF files are supported.");
            setFile(null);
        }
    };

    const handleUpload = async () => {
        if (!customPrompt.trim()) {
            alert("Please define a custom prompt template.");
            return;
        }
    
        await savePromptTemplate(customPrompt);

        if (!file) {
            alert("Please select a file to upload");
            return;
        }
        
        if (indexType === "Private" && !privateName.trim()) {
            alert("Please provide a name for the Private index.");
            return;
        }

        setUploading(true);
        
        try {
            if (indexType === "User") {
                const deleteResponse = await axios.post("http://127.0.0.1:5000/delete_previous_file", {
                    customer_name: customerName,
                    index_type: indexType,
                });
    
                if (!deleteResponse.data.success) {
                    console.warn("Deletion response:", deleteResponse.data.message);
                } else {
                    console.log(deleteResponse.data.message);
                }
            }

            const formData = new FormData();
            formData.append("file", file);
            formData.append("indexType", indexType);
            formData.append("customerName", indexType === "User" ? customerName : "");
            formData.append("privateName", indexType === "Private" ? privateName : "");
            formData.append("customPrompt", customPrompt);
    
            const uploadResponse = await axios.post("http://127.0.0.1:5000/ingest_pdfs", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
    
            if (uploadResponse.data.success) {
                alert("File successfully uploaded and processed!");
                const updatedConversation = [{ sender: "AmVerse", text: customPrompt }];
                setConversation(updatedConversation);
    
                await saveChatToCustomChat(updatedConversation);
            } else {
                throw new Error(uploadResponse.data.message);
            }
        } catch (error) {
            console.error("Error during file upload:", error.message);
            alert("Error uploading file: " + error.message);
        } finally {
            setUploading(false);
        }
    };

    const handleLogout = () => {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('fullName');
        navigate("/homepage", { replace: true });
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

    const handleResetChatHistory = async () => {
        const userId = await fetchUserId();
        if (!userId) {
            alert("User ID not found. Cannot reset chat history.");
            return;
        }
    
        const confirmReset = window.confirm("Are you sure you want to delete all chat history? This action cannot be undone.");
        if (!confirmReset) return;
    
        try {
            const { error } = await supabase
                .from('custom_chat')
                .delete()
                .eq('user_id', userId);
    
            if (error) {
                console.error("Error resetting chat history in Supabase:", error.message);
                alert("Failed to reset chat history. Please try again.");
            } else {
                setConversation([]); // Clear local state
                alert("Chat history reset successfully.");
            }
        } catch (error) {
            console.error("Unexpected error resetting chat history:", error.message);
            alert("An unexpected error occurred. Please try again.");
        }
    };    

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && userMessage.trim()) {
            handleChatSubmit(); // Call the query function
        }
    };  
    
    return (
        <div style={styles.customizePage}>
            <div style={styles.sidebar}>
                <button style={styles.newChatButton} onClick={() => navigate("/chatapp")}>
                    AmVerse
                </button>
                <div style={styles.bottomButtons}>
                    <button style={styles.logoutButton} onClick={() => navigate("/customize-amverse")}>
                        Customize AmVerse
                    </button>
                    {/*<button style={styles.logoutButton} onClick={() => navigate("/chatappvsgpt")}>AmVerse VS ChatGPT</button>*/}
                    <button style={styles.logoutButton} onClick={handleLogout}>Log out</button>
                </div>  
            </div>
    
            <div style={styles.mainContainer}>
                <h3 style={styles.header}>
                <button style={styles.toggleButton} onClick={toggleSection}>
                    {isSectionOpen ? '▼' : '▲'} Customize AmVerse
                </button>
                </h3>
                {isSectionOpen && (
                    <div style={styles.customizationSection}>
                        <select
                            value={indexType}
                            onChange={(e) => setIndexType(e.target.value)}
                            style={styles.dropdown}
                        >
                            <option value="User">User</option>
                            <option value="Public">Public</option>
                            <option value="Private">Private</option>
                        </select>
        
                        {indexType === "Private" && (
                            <input
                                type="text"
                                placeholder="Enter a name for Private index"
                                value={privateName}
                                onChange={handleNameChange}
                                style={styles.textInput}
                            />
                        )}
        
                        <input type="file" accept=".pdf" onChange={handleFileChange} style={styles.fileInput} />
                        <p style={styles.supportedFiles}>Supported File Type: PDF</p>
        
                        <input
                            type="text"
                            placeholder="Enter your custom prompt template"
                            value={customPrompt}
                            onChange={handleCustomPromptChange}
                            style={styles.textInput}
                        />
        
                        <button
                            onClick={handleUpload}
                            style={styles.uploadButton}
                            disabled={uploading}
                        >
                            {uploading ? "Uploading..." : "Customize"}
                        </button>
                    </div>
                )}
    
                <div style={styles.chatContainer}>
                    <h3 style={styles.chatHeader}>AmVerse</h3>
                    <div style={styles.chatWindow}>
                        {conversation.map((message, index) => (
                            <div
                                key={index}
                                style={{
                                    ...styles.message,
                                    ...(message.sender === "user"
                                        ? styles.userMessageRight
                                        : styles.amVerseMessageLeft),
                                }}
                            >
                                <div style={styles.messageContent}>
                                    <span
                                        style={{ whiteSpace: "pre-wrap" }}
                                        dangerouslySetInnerHTML={{ __html: message.text }}
                                    ></span>
                                    {/* Render the "View Resources" button if sources are available */}
                                    {message.sources && message.sources.length > 0 && (
                                        <div style={styles.viewResourcesWrapper}>
                                            <button
                                                style={styles.viewResourcesButton}
                                                onClick={() => handleViewResources(message.sources)}
                                            >
                                                View Resources
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    <textarea
                        style={styles.chatInput}
                        value={userMessage}
                        onChange={(e) => setUserMessage(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type your message here..."
                        rows={3}
                    />
                    <div style={styles.buttonContainer}>
                        <button
                            onClick={handleChatSubmit}
                            style={styles.chatButton}
                            disabled={loading}
                        >
                            {loading ? "Sending..." : "Send"}
                        </button>
                        <button
                            onClick={handleResetChatHistory}
                            style={styles.resetButton}
                        >
                            Reset
                        </button>
                    </div>
                </div>
            </div>

            {isModalOpen && (
                <div style={styles.modal}>
                    <div style={styles.modalContent}>
                        <button style={styles.closeButton} onClick={closeModal}>
                            &times;
                        </button>
                        <img
                            src={screenshots[currentScreenshot]}
                            alt="Screenshot"
                            style={styles.screenshot}
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
    customizePage: {
        display: "flex",
        height: "100vh",
        fontFamily: "Arial, sans-serif",
        backgroundColor: "#333",
        color: "white",
    },
    toggleButton: {
        padding: "0", 
        backgroundColor: "transparent", 
        color: "#FFF", // Text color same as the button
        border: "none", // No border
        cursor: "pointer",
        marginLeft: "10px", 
        fontSize: "24px",
        marginBottom: "1px",
        fontWeight: "bold",
    },
    customizationSection: {
        width: "100%",
        maxWidth: "600px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        marginBottom: "20px",
        padding: "20px",
        backgroundColor: "#333",
        borderRadius: "10px",
        boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.1)",
    },
    sidebar: {
        width: "200px",
        backgroundColor: "#111",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "20px",
    },
    mainContainer: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "20px",
        overflowY: "auto",
    },
    chatContainer: {
        width: "100%",
        maxWidth: "1200px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        padding: "20px",
        backgroundColor: "#333",
        borderRadius: "10px",
        boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.1)",
    },
    chatWindow: {
        width: "100%",
        height: "400px",
        backgroundColor: "#222",
        border: "1px solid #444",
        borderRadius: "5px",
        padding: "10px",
        overflowY: "auto",
        gap: "5px",
    },
    chatHeader: {
        fontSize: "24px",
        fontWeight: "bold",
        textAlign: "center",
        marginTop: "1px",
    },
    message: {
        display: "flex",
        padding: "10px",
        borderRadius: "10px",
        maxWidth: "80%", // Adjust the width as needed
        wordWrap: "break-word",
        marginBottom: "10px",
    },
    userMessageRight: {
        alignSelf: "flex-end",
        backgroundColor: "#555", // User message color
        color: "#fff",
        marginLeft: "auto", // Push the message to the right
    },
    amVerseMessageLeft: {
        alignSelf: "flex-start",
        backgroundColor: "#888", // Bot message color
        color: "#fff",
    },
    chatInput: {
        width: "100%",
        padding: "10px",
        borderRadius: "5px",
        border: "1px solid #ccc",
    },   
    buttonContainer: {
        display: "flex",
        justifyContent: "space-between",
        gap: "10px",
        width: "100%",
        marginTop: "10px",
    },    
    chatButton: {
        alignSelf: "flex-start", 
        padding: "10px 20px",
        backgroundColor: "#007bff",
        color: "white",
        border: "none",
        borderRadius: "5px",
        cursor: "pointer",
    },
    resetButton: {
        padding: "10px 20px",
        backgroundColor: "#dc3545",
        color: "white",
        border: "none",
        borderRadius: "5px",
        cursor: "pointer",
        maxWidth: "70px",
    },   
    dropdown: {
        padding: "10px",
        borderRadius: "5px",
        border: "1px solid #ccc",
    },
    textInput: {
        padding: "10px",
        flex: 1,
        backgroundColor: "#FFF",
        color: "#000",
        border: "none",
        borderRadius: "5px",
    },
    uploadButton: {
        padding: "10px",
        backgroundColor: "#28a745",
        color: "white",
        border: "none",
        borderRadius: "5px",
        cursor: "pointer",
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
    header: {
        fontSize: "24px",
        marginBottom: "10px",
    },
    supportedFiles: {
        fontSize: "14px",
        marginTop: "0px",
        marginBottom: "5px",
    },
    fileInput: {
        color: "white",
        marginTop: "10px",
    },
    viewResourcesButton: {
        padding: "4px 12px",
        fontSize: "12px",
        color: "#FFFFFF",
        backgroundColor: "transparent",
        border: "2px solid #000000",
        borderRadius: "4px",
        cursor: "pointer",
        transition: "all 0.3s ease",
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


export default CustomizeAmVerse;
