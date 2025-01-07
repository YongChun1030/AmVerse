import React from 'react';
import { useNavigate } from 'react-router-dom';
import HeaderImage from './assets/amversechatbot.png'; // Adjust the path to your asset folder
import AdviceImage1 from './assets/amverseonetouch.jpg';
import AdviceImage2 from './assets/amverseupload.jpg';
import AdviceImage3 from './assets/amverseaccurate.jpg';
import Feature1 from './assets/amverseadvice.jpg';
import Feature2 from './assets/amverseintegrate.jpg';
import Feature3 from './assets/amversenopay.jpg';
import Feature4 from './assets/amverseuf.jpg';

const Homepage = () => {
    const navigate = useNavigate();

    const handleSignIn = () => {
        navigate('/login');
    };

    const handleSignUp = () => {
        navigate('/signup');
    };

    const goToChatApp = () => {
        navigate('/login');
    };

    const scrollToSection = (id) => {
        const section = document.getElementById(id);
        if (section) {
            section.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <div style={styles.container}>
            {/* Navigation Bar */}
            <header style={styles.navbar}>
                <div style={styles.logo}>AmVerse</div>
                <nav style={styles.navLinks}>
                <button style={styles.navLink} onClick={() => scrollToSection('main-section')}>Home</button>
                    <button style={styles.navLink} onClick={() => scrollToSection('about')}>About</button>
                    <button style={styles.navLink} onClick={() => scrollToSection('features')}>Features</button>
                    <button style={styles.signInButton} onClick={handleSignIn}>Sign In</button>
                    <button style={styles.signUpButton} onClick={handleSignUp}>Sign Up</button>
                </nav>
            </header>

            {/* Main Content */}
            <main style={styles.mainContent} id="main-section">
                <div style={styles.textSection}>
                    <h1 style={styles.title}>Get your personalized financial advice</h1>
                    <p style={styles.subtitle}>
                        Personalized financial advice with AmVerse to help you achieve your goals and build a secure future.
                    </p>
                    <div style={styles.buttonGroup}>
                        
                        <button style={styles.getStartedButton} onClick={goToChatApp}>
                            Get Started
                        </button>
                    </div>
                </div>
                <div style={styles.imageSection}>
                    <img src={HeaderImage} alt="Financial Advice Illustration" style={styles.image} />
                </div>
            </main>

            {/* Why Choose Us Section */}
            <section id="about" style={styles.whyChooseUsSection}>
                <h2 style={styles.sectionTitle}>Why you choose us?</h2>
                <p style={styles.sectionSubtitle}>
                    Personalized financial advice with AmVerse to help you achieve your goals and build a secure future.
                </p>
                <div style={styles.cardContainer}>
                    <div style={styles.card}>
                        <img src={AdviceImage1} alt="Advice" style={styles.cardImage} />
                        <h3 style={styles.cardTitle}>Advice in One Touch</h3>
                        <p style={styles.cardDescription}>
                            Get a quick personalized financial advice with just one click.
                        </p>
                    </div>
                    <div style={styles.card}>
                        <img src={AdviceImage2} alt="Customize AmVerse" style={styles.cardImage} />
                        <h3 style={styles.cardTitle}>Customize AmVerse</h3>
                        <p style={styles.cardDescription}>
                            You can customize your own AmVerse by just uploading a file.
                        </p>
                    </div>
                    <div style={styles.card}>
                        <img src={AdviceImage3} alt="Accurate Responses" style={styles.cardImage} />
                        <h3 style={styles.cardTitle}>Accurate Responses</h3>
                        <p style={styles.cardDescription}>
                            AmVerse is using retrieval augmented generation to retrieve the relevant resources to generate the accurate responses.
                        </p>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" style={styles.featuresSection}>
                <h2 style={styles.sectionTitle}>Features AmVerse Has</h2>
                <p style={styles.sectionSubtitle}>
                    Personalized financial advice with AmVerse to help you achieve your goals and build a secure future.
                </p>
                <div style={styles.featureGrid}>
                    {/* Feature 1 */}
                    <div style={styles.featureCard}>
                        <img src={Feature1} alt="Get Financial Advice" style={styles.featureImage} />
                        <h3 style={styles.featureTitle}>Get financial advice</h3>
                        <p style={styles.featureDescription}>
                            With your personal financial data, we will generate your personalized financial advice.
                        </p>
                    </div>
                    {/* Feature 2 */}
                    <div style={styles.featureCard}>
                        <img src={Feature3} alt="Free of Charges" style={styles.featureImage} />
                        <h3 style={styles.featureTitle}>Free of charges</h3>
                        <p style={styles.featureDescription}>
                            Don’t worry about generated fees.
                        </p>
                    </div>
                    {/* Feature 3 */}
                    <div style={styles.featureCard}>
                        <img src={Feature2} alt="Integrating RAG" style={styles.featureImage} />
                        <h3 style={styles.featureTitle}>Integrating RAG</h3>
                        <p style={styles.featureDescription}>
                            AmVerse is integrating retrieval-augmented generation to provide precise, context-aware responses driven by reliable resources.
                        </p>
                    </div>
                    {/* Feature 4 */}
                    <div style={styles.featureCard}>
                        <img src={Feature4} alt="User-Friendly Interface" style={styles.featureImage} />
                        <h3 style={styles.featureTitle}>User friendly interface</h3>
                        <p style={styles.featureDescription}>
                            The interface is clean, responsive, and easy to use, ensuring an engaging experience for users of all levels.
                        </p>
                    </div>
                </div>
            </section>
        </div>
    );
};

const styles = {
    container: {
        fontFamily: 'Roboto, sans-serif',
        background: 'linear-gradient(135deg, #6e7fcd, #88a0ea)',
        color: '#333',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
    },
    navbar: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px 40px',
        backgroundColor: '#fff',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
    },
    logo: {
        fontSize: '1.5rem',
        fontWeight: 'bold',
        color: '#007bff',
    },
    navLinks: {
        display: 'flex',
        alignItems: 'center',
    },
    navLink: {
        marginRight: '20px',
        textDecoration: 'none',
        color: '#333',
        fontSize: '1rem',
        fontWeight: '500',
        backgroundColor: 'transparent',
        border: 'none',
        cursor: 'pointer',
    },
    signInButton: {
        padding: '8px 16px',
        border: '2px solid #007bff',
        backgroundColor: 'transparent',
        color: '#007bff',
        borderRadius: '20px',
        marginRight: '10px',
        cursor: 'pointer',
    },
    signUpButton: {
        padding: '8px 16px',
        backgroundColor: '#007bff',
        color: '#fff',
        border: 'none',
        borderRadius: '20px',
        cursor: 'pointer',
    },
    mainContent: {
        display: 'flex',
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '20px',
        minHeight: '100vh',
    },
    textSection: {
        maxWidth: '600px',
        marginBottom: '40px',
        textAlign: 'center',
    },
    title: {
        fontSize: '3rem',
        color: '#fff',
        marginBottom: '20px',
    },
    subtitle: {
        fontSize: '1.2rem',
        marginBottom: '40px',
        color: '#eaeaea',
    },
    buttonGroup: {
        display: 'flex',
        gap: '20px',
        justifyContent: 'center',
    },
    takeTripButton: {
        padding: '12px 20px',
        border: '2px solid #fff',
        backgroundColor: 'transparent',
        color: '#fff',
        borderRadius: '25px',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'transform 0.2s ease, background-color 0.3s ease',
    },
    getStartedButton: {
        padding: '12px 20px',
        backgroundColor: '#007bff',
        color: '#fff',
        border: 'none',
        borderRadius: '25px',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'transform 0.2s ease, background-color 0.3s ease',
    },
    imageSection: {
        textAlign: 'center',
    },
    image: {
        width: '100%',
        maxWidth: '500px',
        borderRadius: '10px',
    },
    whyChooseUsSection: {
        padding: '60px 20px',
        backgroundColor: '#fff',
        textAlign: 'center',
    },
    sectionTitle: {
        fontSize: '2.5rem',
        color: '#333',
        marginBottom: '10px',
    },
    sectionSubtitle: {
        fontSize: '1.2rem',
        color: '#555',
        marginBottom: '40px',
    },
    cardContainer: {
        display: 'flex',
        justifyContent: 'center',
        gap: '20px',
        flexWrap: 'wrap',
    },
    card: {
        width: '300px',
        padding: '20px',
        backgroundColor: '#f9f9f9',
        borderRadius: '10px',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
        textAlign: 'center',
    },
    cardImage: {
        width: '100%',
        height: 'auto',
        marginBottom: '20px',
    },
    cardTitle: {
        fontSize: '1.5rem',
        color: '#007bff',
        marginBottom: '10px',
    },
    cardDescription: {
        fontSize: '1rem',
        color: '#555',
    },
    featuresSection: {
        padding: '60px 20px',
        backgroundColor: '#f9f9f9',
        textAlign: 'center',
    },
    featureGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '20px',
        maxWidth: '1000px',
        margin: '0 auto',
    },
    featureCard: {
        backgroundColor: '#fff',
        borderRadius: '10px',
        padding: '20px',
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
        textAlign: 'center',
    },
    featureImage: {
        width: '80px',
        height: '80px',
        marginBottom: '20px',
    },
    featureTitle: {
        fontSize: '1.5rem',
        color: '#333',
        marginBottom: '10px',
    },
    featureDescription: {
        fontSize: '1rem',
        color: '#555',
    },
};

export default Homepage;
