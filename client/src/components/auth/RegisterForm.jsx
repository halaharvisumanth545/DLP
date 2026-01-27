import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { register } from "../../services/auth";
import { ROUTES } from "../../utils/constants";
import { parseError } from "../../utils/helpers";
import "./AuthForms.css";

export default function RegisterForm() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
        role: "student",
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

        // Validate passwords match
        if (formData.password !== formData.confirmPassword) {
            setError("Passwords do not match");
            setLoading(false);
            return;
        }

        try {
            const response = await register({
                name: formData.name,
                email: formData.email,
                password: formData.password,
                role: formData.role,
            });

            // Redirect based on role
            if (response.user.role === "teacher") {
                navigate(ROUTES.TEACHER.HOME);
            } else {
                navigate(ROUTES.STUDENT.HOME);
            }
        } catch (err) {
            setError(parseError(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-form-container">
            <div className="auth-form-card">
                <div className="auth-header">
                    <h1>Create Account</h1>
                    <p>Start your personalized learning journey</p>
                </div>

                {error && <div className="auth-error">{error}</div>}

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-group">
                        <label htmlFor="name">Full Name</label>
                        <input
                            type="text"
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            placeholder="Enter your full name"
                            required
                            minLength={2}
                        />
                    </div>

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
                        <label htmlFor="role">I am a</label>
                        <div className="role-selector">
                            <button
                                type="button"
                                className={`role-btn ${formData.role === "student" ? "active" : ""}`}
                                onClick={() => setFormData({ ...formData, role: "student" })}
                            >
                                <span>🎓</span> Student
                            </button>
                            <button
                                type="button"
                                className={`role-btn ${formData.role === "teacher" ? "active" : ""}`}
                                onClick={() => setFormData({ ...formData, role: "teacher" })}
                            >
                                <span>👨‍🏫</span> Teacher
                            </button>
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            placeholder="Create a password"
                            required
                            minLength={6}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirmPassword">Confirm Password</label>
                        <input
                            type="password"
                            id="confirmPassword"
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            placeholder="Confirm your password"
                            required
                        />
                    </div>

                    <button type="submit" className="btn-submit" disabled={loading}>
                        {loading ? "Creating account..." : "Create Account"}
                    </button>
                </form>

                <div className="auth-footer">
                    <p>
                        Already have an account?{" "}
                        <Link to={ROUTES.LOGIN}>Sign in</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
