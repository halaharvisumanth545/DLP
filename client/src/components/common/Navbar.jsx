import { Link, useNavigate } from "react-router-dom";
import { getCurrentUser, logout, isAuthenticated } from "../../services/auth";
import { ROUTES } from "../../utils/constants";
import { getInitials } from "../../utils/helpers";
import "./Navbar.css";

export default function Navbar() {
    const navigate = useNavigate();
    const user = getCurrentUser();
    const authenticated = isAuthenticated();

    const handleLogout = () => {
        logout();
        navigate(ROUTES.LOGIN);
    };

    return (
        <nav className="navbar">
            <div className="navbar-container">
                <Link to={ROUTES.HOME} className="navbar-brand">
                    <span className="brand-icon">📚</span>
                    <span className="brand-text">LearnAI</span>
                </Link>

                <div className="navbar-menu">
                    {authenticated ? (
                        <>
                            <div className="navbar-user">
                                <div className="user-avatar">{getInitials(user?.name)}</div>
                                <div className="user-info">
                                    <span className="user-name">{user?.name}</span>
                                    <span className="user-role">{user?.role}</span>
                                </div>
                                <button className="btn-logout" onClick={handleLogout}>
                                    Logout
                                </button>
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
