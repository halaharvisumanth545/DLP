import { useState, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { resetPassword } from "../services/auth";
import { ROUTES } from "../utils/constants";
import { parseError } from "../utils/helpers";
import "../components/auth/AuthForms.css";

export default function ResetPassword() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get("token");

    const [formData, setFormData] = useState({
        password: "",
        confirmPassword: ""
    });
    const [status, setStatus] = useState("idle"); // idle, loading, success, error
    const [message, setMessage] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (!token) {
            setStatus("error");
            setMessage("Invalid password reset link. No token provided.");
        }
    }, [token]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        if (status === "error") setStatus("idle");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (formData.password !== formData.confirmPassword) {
            setStatus("error");
            setMessage("Passwords do not match");
            return;
        }

        if (formData.password.length < 6) {
            setStatus("error");
            setMessage("Password must be at least 6 characters long");
            return;
        }

        setStatus("loading");
        setMessage("");

        try {
            await resetPassword(token, formData.password);
            setStatus("success");
            setMessage("Password has been successfully reset!");

            // Redirect to login after 3 seconds
            setTimeout(() => {
                navigate(ROUTES.LOGIN);
            }, 3000);
        } catch (err) {
            console.error("Reset password error:", err);
            setStatus("error");
            setMessage(parseError(err) || "Failed to reset password. The link may have expired.");
        }
    };

    if (!token && status === "error") {
        return (
            <div className="auth-form-container">
                <div className="auth-form-card">
                    <div className="auth-header">
                        <h1>Invalid Link</h1>
                    </div>
                    <div className="auth-error">{message}</div>
                    <div className="auth-footer">
                        <Link to={ROUTES.LOGIN}>Back to Login</Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="auth-form-container">
            <div className="auth-form-card">
                <div className="auth-header">
                    <h1>Create New Password</h1>
                    <p>Please enter your new password below</p>
                </div>

                {status === "error" && <div className="auth-error">{message}</div>}
                {status === "success" && (
                    <div className="auth-success" style={{
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        color: 'var(--success)',
                        padding: '12px 16px',
                        borderRadius: '10px',
                        marginBottom: '20px',
                        fontSize: '0.9rem',
                        textAlign: 'center'
                    }}>
                        {message}
                        <p style={{ marginTop: '10px', fontSize: '0.8rem' }}>Redirecting to login...</p>
                    </div>
                )}

                {status !== "success" && (
                    <form onSubmit={handleSubmit} className="auth-form">
                        <div className="form-group">
                            <label htmlFor="password">New Password</label>
                            <div className="password-input-wrapper">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    id="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder="Enter new password"
                                    required
                                />
                                <button
                                    type="button"
                                    className="btn-toggle-password"
                                    onClick={() => setShowPassword(!showPassword)}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                                            <line x1="1" y1="1" x2="23" y2="23"></line>
                                        </svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                            <circle cx="12" cy="12" r="3"></circle>
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="confirmPassword">Confirm New Password</label>
                            <input
                                type={showPassword ? "text" : "password"}
                                id="confirmPassword"
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                placeholder="Confirm new password"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn-submit"
                            disabled={status === "loading" || !formData.password || !formData.confirmPassword}
                        >
                            {status === "loading" ? "Resetting..." : "Reset Password"}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
