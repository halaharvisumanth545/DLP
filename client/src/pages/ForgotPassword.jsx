import { useState } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../services/auth";
import { ROUTES } from "../utils/constants";
import { parseError } from "../utils/helpers";
import "../components/auth/AuthForms.css";

export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState("idle"); // idle, loading, success, error
    const [message, setMessage] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email) return;

        setStatus("loading");
        setMessage("");

        try {
            const response = await forgotPassword(email);
            setStatus("success");
            setMessage(response.message || "If that email exists, a reset link has been sent.");
        } catch (err) {
            console.error("Forgot password error:", err);
            setStatus("error");
            setMessage(parseError(err) || "Failed to send reset link. Please try again.");
        }
    };

    return (
        <div className="auth-form-container">
            <div className="auth-form-card">
                <div className="auth-header">
                    <h1>Reset Password</h1>
                    <p>Enter your email to receive a password reset link</p>
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
                    </div>
                )}

                {status !== "success" ? (
                    <form onSubmit={handleSubmit} className="auth-form">
                        <div className="form-group">
                            <label htmlFor="email">Email Address</label>
                            <input
                                type="email"
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter your registered email"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn-submit"
                            disabled={status === "loading" || !email}
                        >
                            {status === "loading" ? "Sending Link..." : "Send Reset Link"}
                        </button>
                    </form>
                ) : (
                    <div style={{ textAlign: "center", marginTop: "20px" }}>
                        <p style={{ color: "var(--text-muted)", marginBottom: "20px" }}>
                            Please check your email and click the link to reset your password. The link will expire in 30 minutes.
                        </p>
                    </div>
                )}

                <div className="auth-footer">
                    <p>
                        Remember your password?{" "}
                        <Link to={ROUTES.LOGIN}>Back to Login</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
