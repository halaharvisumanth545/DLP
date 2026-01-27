import "./Footer.css";

export default function Footer() {
    return (
        <footer className="footer">
            <div className="footer-container">
                <div className="footer-grid">
                    <div className="footer-section">
                        <h3 className="footer-brand">
                            <span>📚</span> LearnAI
                        </h3>
                        <p className="footer-desc">
                            AI-powered learning platform for personalized education and exam preparation.
                        </p>
                    </div>

                    <div className="footer-section">
                        <h4>Features</h4>
                        <ul>
                            <li><a href="#">AI Study Materials</a></li>
                            <li><a href="#">Practice Sessions</a></li>
                            <li><a href="#">Smart Analytics</a></li>
                            <li><a href="#">Weak Topic Detection</a></li>
                        </ul>
                    </div>

                    <div className="footer-section">
                        <h4>Resources</h4>
                        <ul>
                            <li><a href="#">Documentation</a></li>
                            <li><a href="#">API Reference</a></li>
                            <li><a href="#">Support</a></li>
                            <li><a href="#">FAQ</a></li>
                        </ul>
                    </div>

                    <div className="footer-section">
                        <h4>Contact</h4>
                        <ul>
                            <li><a href="mailto:support@learnai.com">support@learnai.com</a></li>
                            <li><a href="#">Twitter</a></li>
                            <li><a href="#">LinkedIn</a></li>
                            <li><a href="#">GitHub</a></li>
                        </ul>
                    </div>
                </div>

                <div className="footer-bottom">
                    <p>&copy; {new Date().getFullYear()} LearnAI. All rights reserved.</p>
                    <div className="footer-links">
                        <a href="#">Privacy Policy</a>
                        <a href="#">Terms of Service</a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
