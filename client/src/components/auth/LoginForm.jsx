import { useState } from "react";
import { Link } from "react-router-dom";
import { login } from "../../services/auth";
import { ROUTES } from "../../utils/constants";
import { parseError } from "../../utils/helpers";
import "./AuthForms.css";

export default function LoginForm() {
    const [formData, setFormData] = useState({
        email: "",
        password: "",
    });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError("");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const response = await login(formData.email, formData.password);
            console.log("Login successful:", response);

            // Use window.location for reliable navigation after localStorage is set
            if (response.user.role === "teacher") {
                window.location.href = ROUTES.TEACHER.HOME;
            } else {
                window.location.href = ROUTES.STUDENT.HOME;
            }
        } catch (err) {
            console.error("Login error:", err);
            setError(parseError(err));
            setLoading(false);
        }
    };

    return (
        <div className="auth-form-container">
            <div className="auth-form-card">
                <div className="auth-header">
                    <h1>Welcome Back</h1>
                    <p>Sign in to continue your learning journey</p>
                </div>

                {error && <div className="auth-error">{error}</div>}

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="Enter your email"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            placeholder="Enter your password"
                            required
                        />
                    </div>

                    <button type="submit" className="btn-submit" disabled={loading}>
                        {loading ? "Signing in..." : "Sign In"}
                    </button>
                </form>

                <div className="auth-footer">
                    <p>
                        Don&apos;t have an account?{" "}
                        <Link to={ROUTES.REGISTER}>Create one</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
