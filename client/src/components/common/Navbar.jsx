import { Link } from "react-router-dom";
import { useEffect } from "react";
import { getCurrentUser, isAuthenticated } from "../../services/auth";
import { ROUTES } from "../../utils/constants";
import { getInitials } from "../../utils/helpers";
import "./Navbar.css";

export default function Navbar() {
    const user = getCurrentUser();
    const authenticated = isAuthenticated();

    // Always enforce light mode
    useEffect(() => {
        document.documentElement.removeAttribute("data-theme");
        localStorage.removeItem("theme");
    }, []);

    return (
        <nav className="navbar">
            <div className="navbar-container">
                <Link to={ROUTES.HOME} className="navbar-brand">
                    <span className="brand-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                            <path d="M6 12v5c3 3 9 3 12 0v-5" />
                        </svg>
                    </span>
                    <div className="brand-title-group">
                        <span className="brand-text">LearnAI</span>
                        <span className="brand-subtitle">Digital Learning Platform</span>
                    </div>
                </Link>

                <div className="navbar-menu">
                    {authenticated ? (
                        <>
                            <div className="navbar-user">
                                <div className="user-avatar" style={{ overflow: "hidden" }}>
                                    <Link to={`/${user?.role}/profile`} style={{ textDecoration: 'none', color: 'inherit', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {user?.profilePicture ? (
                                            <img src={user.profilePicture} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                                        ) : (
                                            getInitials(user?.name)
                                        )}
                                    </Link>
                                </div>
                                <div className="user-info">
                                    <Link to={`/${user?.role}/profile`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column' }}>
                                        <span className="user-name">{user?.name}</span>
                                        <span className="user-role">{user?.role}</span>
                                    </Link>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="navbar-auth">
                            <Link to={ROUTES.LOGIN} className="nav-link">
                                Login
                            </Link>
                            <Link to={ROUTES.REGISTER} className="btn-register">
                                Get Started
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
}
