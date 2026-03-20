import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getProfile, updateProfile, editPassword, logout } from "../services/auth";
import { parseError } from "../utils/helpers";
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import CustomDropdown from '../components/common/CustomDropdown';
import "./Profile.css";

export default function Profile() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        username: "",
        email: "",
        firstName: "",
        middleName: "",
        lastName: "",
        about: "",
        university: "",
        affiliatedCollege: "",
        course: "",
        semester: "",
        branch: "",
        countryCode: "",
        mobileNumber: "",
        profilePicture: ""
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [successMsg, setSuccessMsg] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [universitiesList, setUniversitiesList] = useState([]);
    const [isCustomUniversity, setIsCustomUniversity] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // Password edit state
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [passwordData, setPasswordData] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
    });
    const [passwordError, setPasswordError] = useState("");
    const [passwordSuccess, setPasswordSuccess] = useState("");
    const [passwordSaving, setPasswordSaving] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const [dragOver, setDragOver] = useState(false);
    const [lastSavedData, setLastSavedData] = useState(null);
    const [autoSaveStatus, setAutoSaveStatus] = useState(""); // "", "Saving...", "Saved"
    const [isDirty, setIsDirty] = useState(false); // Only auto-save if user explicitly edits
    const fileInputRef = useRef(null);

    // Custom useDebounce for auto-save
    const useDebounce = (value, delay) => {
        const [debouncedValue, setDebouncedValue] = useState(value);
        useEffect(() => {
            const handler = setTimeout(() => {
                setDebouncedValue(value);
            }, delay);
            return () => {
                clearTimeout(handler);
            };
        }, [value, delay]);
        return debouncedValue;
    };

    const debouncedFormData = useDebounce(formData, 2000);

    // Auto-save effect
    useEffect(() => {
        const performAutoSave = async () => {
            // Don't auto-save if we haven't loaded initial data yet, or if the user hasn't made any manual edits
            if (!lastSavedData || !isDirty) return;

            // Check if there are actual changes (excluding profilePicture as it's handled separately)
            const hasChanges = ['username', 'email', 'firstName', 'middleName', 'lastName', 'about', 'university', 'affiliatedCollege', 'course', 'semester', 'branch', 'countryCode', 'mobileNumber'].some(
                key => debouncedFormData[key] !== lastSavedData[key]
            );

            if (hasChanges) {
                setAutoSaveStatus("Saving...");
                try {
                    await updateProfile(debouncedFormData);
                    setLastSavedData(debouncedFormData);
                    setIsDirty(false); // Reset dirty flag after successful save
                    setAutoSaveStatus("Saved");
                    setTimeout(() => setAutoSaveStatus(""), 3000);
                } catch (err) {
                    console.error("Auto-save failed", err);
                    setAutoSaveStatus("Failed to save");
                }
            }
        };

        if (debouncedFormData) {
            performAutoSave();
        }
    }, [debouncedFormData, lastSavedData]);

    useEffect(() => {
        loadProfile();
        fetchUniversities();
    }, []);

    const fetchUniversities = async () => {
        try {
            const response = await fetch('http://universities.hipolabs.com/search?country=India');
            if (response.ok) {
                const data = await response.json();
                // Extract unique names and sort alphabetically
                const uniqueUniversities = [...new Set(data.map(u => u.name))].sort((a, b) => a.localeCompare(b));
                setUniversitiesList(uniqueUniversities);
                
                // If there's an existing university saved that is NOT in the fetched list, it means it's custom
                setFormData(prev => {
                    if (prev.university && !uniqueUniversities.includes(prev.university)) {
                        setIsCustomUniversity(true);
                    }
                    return prev;
                });
            }
        } catch (err) {
            console.error("Failed to fetch universities:", err);
            // Optionally set error state or just silently fail and let it be an empty dropdown
        }
    };

    const loadProfile = async () => {
        try {
            const data = await getProfile();
            if (data && data.user) {
                const initialData = {
                    username: data.user.username || "",
                    email: data.user.email || "",
                    firstName: data.user.firstName || "",
                    middleName: data.user.middleName || "",
                    lastName: data.user.lastName || "",
                    about: data.user.about || "",
                    university: data.user.university || "",
                    affiliatedCollege: data.user.affiliatedCollege || "",
                    course: data.user.course || "",
                    semester: data.user.semester || "",
                    branch: data.user.branch || "",
                    countryCode: data.user.countryCode || "",
                    mobileNumber: data.user.mobileNumber || "",
                    profilePicture: data.user.profilePicture || ""
                };

                // If they have legacy format and no course, try to handle it gracefully if possible, 
                // but usually better to let them just update it via UI.

                setFormData(initialData);
                setLastSavedData(initialData);
            }
        } catch (err) {
            setError(parseError(err) || "Failed to load profile");
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        let updatedData = { ...formData, [name]: value };

        // Reset dependent fields when course changes
        if (name === "course") {
            updatedData.semester = "";
            updatedData.branch = "";
        }

        setFormData(updatedData);
        setIsDirty(true);
        setError("");
        setSuccessMsg("");
    };

    const handleUniversitySelection = (val) => {
        if (val === "Other") {
            setIsCustomUniversity(true);
            handleChange({ target: { name: 'university', value: '' } });
        } else {
            setIsCustomUniversity(false);
            handleChange({ target: { name: 'university', value: val } });
        }
    };

    const handlePhoneChange = (value) => {
        setFormData({ ...formData, mobileNumber: value || "" });
        setIsDirty(true);
        setError("");
        setSuccessMsg("");
    };

    // Constants for dropdowns
    const COURSES = ["B. Tech", "M. Tech", "MCA", "MBA"];

    const getSemesters = (course) => {
        if (course === "B. Tech") return 8;
        if (["M. Tech", "MCA", "MBA"].includes(course)) return 4;
        return 0;
    };

    const getBranches = (course) => {
        if (["B. Tech", "M. Tech", "MCA"].includes(course)) {
            return [
                "Civil Engineering",
                "Electrical & Electronics Engineering",
                "Electronics & Communication Engineering",
                "Computer Science & Engineering",
                "Mechanical Engineering",
                "Chemical Engineering"
            ];
        }
        return []; // MBA has no branches
    };

    const processFile = (file) => {
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            setError("Image size should be less than 5MB");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = async () => {
            const updatedData = { ...formData, profilePicture: reader.result };
            setFormData(updatedData);
            setIsModalOpen(false); // Close modal on success

            try {
                setSaving(true);
                await updateProfile(updatedData);
                setLastSavedData(updatedData);
                setSuccessMsg("Profile picture uploaded successfully!");
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            } catch (err) {
                setError(parseError(err) || "Failed to save profile picture");
            } finally {
                setSaving(false);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleImageChange = (e) => {
        processFile(e.target.files[0]);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);

        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith("image/")) {
            if (fileInputRef.current) {
                const dt = new DataTransfer();
                dt.items.add(file);
                fileInputRef.current.files = dt.files;
            }
            processFile(file);
        } else {
            setError("Please upload a valid image file.");
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError("");
        setSuccessMsg("");

        try {
            await updateProfile(formData);
            setSuccessMsg("Profile updated successfully!");
            setIsEditing(false);
            setLastSavedData(formData);
            setIsDirty(false);
            // Force a re-render of the navbar by firing a custom event or reloading the page,
            // or we could just rely on localStorage which was updated. For now, a window reload is simplest.
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } catch (err) {
            setError(parseError(err) || "Failed to update profile");
        } finally {
            setSaving(false);
        }
    };

    const handleRemovePicture = async () => {
        const updatedData = { ...formData, profilePicture: "" };
        setFormData(updatedData);
        setIsModalOpen(false);

        try {
            setSaving(true);
            await updateProfile(updatedData);
            setLastSavedData(updatedData);
            setSuccessMsg("Profile picture removed!");
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } catch (err) {
            setError(parseError(err) || "Failed to remove profile picture");
        } finally {
            setSaving(false);
        }
    };

    const handlePasswordEditSubmit = async (e) => {
        e.preventDefault();
        setPasswordError("");
        setPasswordSuccess("");

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setPasswordError("New passwords do not match.");
            return;
        }

        if (passwordData.newPassword.length < 6) {
            setPasswordError("New password must be at least 6 characters long.");
            return;
        }

        setPasswordSaving(true);
        try {
            await editPassword(passwordData.currentPassword, passwordData.newPassword);
            setPasswordSuccess("Password updated successfully! Redirecting to login...");

            setTimeout(() => {
                logout();
            }, 2000);
        } catch (err) {
            setPasswordError(parseError(err) || "Failed to update password. Please check your current password.");
        } finally {
            setPasswordSaving(false);
        }
    };

    const closePasswordModal = () => {
        setIsPasswordModalOpen(false);
        setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
        setPasswordError("");
        setPasswordSuccess("");
    };

    if (loading) {
        return <div className="profile-loading">Loading profile...</div>;
    }

    return (
        <div className="profile-container">
            <div className="profile-card">
                <div className="profile-header-top">
                    <button type="button" className="btn-back" onClick={() => navigate(-1)} aria-label="Go back">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                    </button>
                    <h2 style={{ flex: 1 }}>User Profile</h2>
                    
                    {!isEditing ? (
                        <button 
                            type="button"
                            onClick={() => setIsEditing(true)} 
                            className="btn-edit-toggle"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                            Edit Profile
                        </button>
                    ) : (
                        <button 
                            type="button"
                            onClick={() => {
                                setIsEditing(false);
                                setFormData(lastSavedData);
                                setIsDirty(false);
                            }} 
                            className="btn-cancel-edit"
                        >
                            Cancel
                        </button>
                    )}

                    {autoSaveStatus && (
                        <span className={`auto-save-status ${autoSaveStatus === 'Failed to save' ? 'error' : ''}`}>
                            {autoSaveStatus}
                        </span>
                    )}
                </div>

                {error && <div className="profile-error">{error}</div>}
                {successMsg && <div className="profile-success">{successMsg}</div>}

                {!isEditing ? (
                    <div className="profile-readonly-view">
                        <div className="profile-picture-section readonly" style={{ marginBottom: '1rem' }}>
                            <div className="profile-picture-preview" style={{ width: '150px', height: '150px' }}>
                                {formData.profilePicture ? (
                                    <img src={formData.profilePicture} alt="Profile" />
                                ) : (
                                    <div className="profile-picture-placeholder">No Image</div>
                                )}
                            </div>
                        </div>

                        <div className="readonly-grid">
                            <div className="readonly-item">
                                <span className="readonly-label">Username</span>
                                <span className="readonly-value">{formData.username || "-"}</span>
                            </div>
                            <div className="readonly-item">
                                <span className="readonly-label">Email Address</span>
                                <span className="readonly-value">{formData.email || "-"}</span>
                            </div>
                            <div className="readonly-item">
                                <span className="readonly-label">Mobile Number</span>
                                <span className="readonly-value">{formData.mobileNumber || "-"}</span>
                            </div>
                            <div className="readonly-item">
                                <span className="readonly-label">First Name</span>
                                <span className="readonly-value">{formData.firstName || "-"}</span>
                            </div>
                            <div className="readonly-item">
                                <span className="readonly-label">Middle Name</span>
                                <span className="readonly-value">{formData.middleName || "-"}</span>
                            </div>
                            <div className="readonly-item">
                                <span className="readonly-label">Last Name</span>
                                <span className="readonly-value">{formData.lastName || "-"}</span>
                            </div>
                            <div className="readonly-item">
                                <span className="readonly-label">University</span>
                                <span className="readonly-value">{formData.university || "-"}</span>
                            </div>
                            <div className="readonly-item">
                                <span className="readonly-label">College (Affiliated)</span>
                                <span className="readonly-value">{formData.affiliatedCollege || "-"}</span>
                            </div>
                            <div className="readonly-item">
                                <span className="readonly-label">Course</span>
                                <span className="readonly-value">{formData.course || "-"}</span>
                            </div>
                            {formData.semester && (
                                <div className="readonly-item">
                                    <span className="readonly-label">Semester</span>
                                    <span className="readonly-value">{formData.semester || "-"}</span>
                                </div>
                            )}
                            {formData.branch && (
                                <div className="readonly-item">
                                    <span className="readonly-label">Branch</span>
                                    <span className="readonly-value">{formData.branch || "-"}</span>
                                </div>
                            )}
                            <div className="readonly-item full-width">
                                <span className="readonly-label">About (Bio)</span>
                                <span className="readonly-value bio-value">{formData.about || "-"}</span>
                            </div>
                        </div>
                        
                        <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginTop: '10px' }}>
                            <button
                                type="button"
                                className="btn-save-profile"
                                onClick={() => setIsPasswordModalOpen(true)}
                                style={{
                                    background: 'transparent',
                                    border: '1px solid var(--border-color)',
                                    color: 'var(--text-main)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '10px 18px',
                                    borderRadius: '10px',
                                    fontSize: '1rem',
                                    gap: '8px'
                                }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                </svg>
                                Change Password
                            </button>
                        </div>
                    </div>
                ) : (
                <form onSubmit={handleSubmit} className="profile-form">
                    <div className="profile-picture-section">
                        <div className="profile-picture-wrapper" onClick={() => setIsModalOpen(true)}>
                            <div className="profile-picture-preview">
                                {formData.profilePicture ? (
                                    <img src={formData.profilePicture} alt="Profile Preview" />
                                ) : (
                                    <div className="profile-picture-placeholder">No Image</div>
                                )}
                            </div>
                            <div className="edit-icon-badge">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="username">Username</label>
                                <div className="custom-tooltip-wrapper">
                                    <input
                                        type="text"
                                        id="username"
                                        name="username"
                                        value={formData.username}
                                        onChange={handleChange}
                                        placeholder="e.g. johndoe123"
                                    />
                                    {formData.username && formData.username.length > 20 && (
                                        <span className="custom-tooltip-text">{formData.username}</span>
                                    )}
                                </div>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="email">Email Address</label>
                                <div className="custom-tooltip-wrapper">
                                    <input
                                        type="email"
                                        id="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        placeholder="e.g. user@example.com"
                                    />
                                    {formData.email && formData.email.length > 20 && (
                                        <span className="custom-tooltip-text">{formData.email}</span>
                                    )}
                                </div>
                        </div>
                        <div className="form-group">
                            <label htmlFor="mobileNumber">Mobile Number</label>
                                <div className="custom-tooltip-wrapper">
                                    <PhoneInput
                                        international
                                        defaultCountry="IN"
                                        id="mobileNumber"
                                        name="mobileNumber"
                                        value={formData.mobileNumber}
                                        onChange={handlePhoneChange}
                                        className="phone-input-field"
                                    />
                                    {formData.mobileNumber && formData.mobileNumber.length > 15 && (
                                        <span className="custom-tooltip-text">{formData.mobileNumber}</span>
                                    )}
                                </div>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="firstName">First Name</label>
                                <div className="custom-tooltip-wrapper">
                                    <input
                                        type="text"
                                        id="firstName"
                                        name="firstName"
                                        value={formData.firstName}
                                        onChange={handleChange}
                                    />
                                    {formData.firstName && formData.firstName.length > 15 && (
                                        <span className="custom-tooltip-text">{formData.firstName}</span>
                                    )}
                                </div>
                        </div>
                        <div className="form-group">
                            <label htmlFor="middleName">Middle Name</label>
                                <div className="custom-tooltip-wrapper">
                                    <input
                                        type="text"
                                        id="middleName"
                                        name="middleName"
                                        value={formData.middleName}
                                        onChange={handleChange}
                                    />
                                    {formData.middleName && formData.middleName.length > 15 && (
                                        <span className="custom-tooltip-text">{formData.middleName}</span>
                                    )}
                                </div>
                        </div>
                        <div className="form-group">
                            <label htmlFor="lastName">Last Name</label>
                                <div className="custom-tooltip-wrapper">
                                    <input
                                        type="text"
                                        id="lastName"
                                        name="lastName"
                                        value={formData.lastName}
                                        onChange={handleChange}
                                    />
                                    {formData.lastName && formData.lastName.length > 15 && (
                                        <span className="custom-tooltip-text">{formData.lastName}</span>
                                    )}
                                </div>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="university">University</label>
                            <CustomDropdown
                                options={[...universitiesList, "Other"]}
                                value={isCustomUniversity ? "Other" : formData.university}
                                onChange={handleUniversitySelection}
                                placeholder="Select University"
                                className="form-select-dropdown"
                                searchable={true}
                            />
                        </div>
                        {isCustomUniversity && (
                            <div className="form-group">
                                <label htmlFor="customUniversity">Enter University Name</label>
                                <div className="custom-tooltip-wrapper">
                                    <input
                                        type="text"
                                        id="customUniversity"
                                        name="university"
                                        value={formData.university}
                                        onChange={handleChange}
                                        placeholder="e.g. Jawaharlal Nehru Technological University"
                                    />
                                    {formData.university && formData.university.length > 25 && (
                                        <span className="custom-tooltip-text">{formData.university}</span>
                                    )}
                                </div>
                            </div>
                        )}
                        <div className="form-group">
                            <label htmlFor="affiliatedCollege">College (Affiliated)</label>
                                <div className="custom-tooltip-wrapper">
                                    <input
                                        type="text"
                                        id="affiliatedCollege"
                                        name="affiliatedCollege"
                                        value={formData.affiliatedCollege}
                                        onChange={handleChange}
                                        placeholder="e.g. JNTUA College of Engineering"
                                    />
                                    {formData.affiliatedCollege && formData.affiliatedCollege.length > 25 && (
                                        <span className="custom-tooltip-text">{formData.affiliatedCollege}</span>
                                    )}
                                </div>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="course">Course</label>
                            <CustomDropdown
                                options={COURSES}
                                value={formData.course}
                                onChange={(val) => handleChange({ target: { name: 'course', value: val } })}
                                placeholder="Select Course"
                                className="form-select-dropdown"
                            />
                        </div>

                        {formData.course && getSemesters(formData.course) > 0 && (
                            <div className="form-group">
                                <label htmlFor="semester">Semester</label>
                                <CustomDropdown
                                    options={[...Array(getSemesters(formData.course))].map((_, i) => `Semester ${i + 1}`)}
                                    value={formData.semester}
                                    onChange={(val) => handleChange({ target: { name: 'semester', value: val } })}
                                    placeholder="Select Sem"
                                    className="form-select-dropdown"
                                />
                            </div>
                        )}

                        {formData.course && getBranches(formData.course).length > 0 && (
                            <div className="form-group">
                                <label htmlFor="branch">Branch</label>
                                <CustomDropdown
                                    options={getBranches(formData.course)}
                                    value={formData.branch}
                                    onChange={(val) => handleChange({ target: { name: 'branch', value: val } })}
                                    placeholder="Select Branch"
                                    className="form-select-dropdown"
                                />
                            </div>
                        )}
                    </div>

                    <div className="form-group full-width">
                        <label htmlFor="about">About (Bio)</label>
                        <textarea
                            id="about"
                            name="about"
                            value={formData.about}
                            onChange={handleChange}
                            rows="4"
                            placeholder="Tell us about yourself..."
                        />
                    </div>

                    <div className="form-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <button
                            type="button"
                            className="btn-save-profile"
                            onClick={() => setIsPasswordModalOpen(true)}
                            style={{
                                background: 'transparent',
                                border: '1px solid var(--border-color)',
                                color: 'var(--text-main)',
                                display: 'flex',
                                alignItems: 'center',
                                padding: '10px 18px',
                                borderRadius: '10px',
                                fontSize: '1rem',
                                gap: '8px'
                            }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                            Edit Password
                        </button>
                        <button type="submit" className="btn-save-profile" disabled={saving}>
                            {saving ? "Saving..." : "Save Profile"}
                        </button>
                    </div>
                </form>
                )}
            </div>

            {isModalOpen && (
                <div className="profile-modal-overlay" onClick={() => setIsModalOpen(false)}>
                    <div className="profile-modal-content" onClick={e => e.stopPropagation()}>
                        <div className="profile-modal-header">
                            <h3>Upload Profile Picture</h3>
                            <button className="btn-close-modal" onClick={() => setIsModalOpen(false)}>
                                &times;
                            </button>
                        </div>

                        <div
                            className={`profile-drop-zone ${dragOver ? 'drag-over' : ''}`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageChange}
                                ref={fileInputRef}
                            />
                            <div className="profile-drop-icon">
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="17 8 12 3 7 8" />
                                    <line x1="12" y1="3" x2="12" y2="15" />
                                </svg>
                            </div>
                            <p className="profile-drop-text">Drag and drop an image here</p>
                            <p className="profile-drop-hint">or click to browse (Max 5MB)</p>
                        </div>

                        {formData.profilePicture && (
                            <div className="profile-modal-actions mt-4">
                                <button type="button" className="btn-remove-picture" onClick={handleRemovePicture}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="3 6 5 6 21 6"></polyline>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                        <line x1="10" y1="11" x2="10" y2="17"></line>
                                        <line x1="14" y1="11" x2="14" y2="17"></line>
                                    </svg>
                                    Remove Profile Picture
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {isPasswordModalOpen && (
                <div className="profile-modal-overlay" onClick={closePasswordModal}>
                    <div className="profile-modal-content" onClick={e => e.stopPropagation()}>
                        <div className="profile-modal-header">
                            <h3>Edit Password</h3>
                            <button className="btn-close-modal" onClick={closePasswordModal}>
                                &times;
                            </button>
                        </div>

                        {passwordError && <div className="profile-error" style={{ marginBottom: '15px' }}>{passwordError}</div>}
                        {passwordSuccess && <div className="profile-success" style={{ marginBottom: '15px' }}>{passwordSuccess}</div>}

                        <form onSubmit={handlePasswordEditSubmit} className="profile-form" style={{ gap: '15px' }}>
                            <div className="form-group">
                                <label htmlFor="currentPassword">Current Password</label>
                                <input
                                    type="password"
                                    id="currentPassword"
                                    value={passwordData.currentPassword}
                                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="newPassword">New Password</label>
                                <div className="password-input-wrapper" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        id="newPassword"
                                        value={passwordData.newPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                        required
                                        style={{ width: '100%', paddingRight: '40px' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                                    >
                                        {showPassword ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                        )}
                                    </button>
                                </div>
                            </div>

                            <div className="form-group">
                                <label htmlFor="confirmPassword">Confirm New Password</label>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    id="confirmPassword"
                                    value={passwordData.confirmPassword}
                                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="form-actions" style={{ marginTop: '10px' }}>
                                <button type="submit" className="btn-save-profile" disabled={passwordSaving || passwordSuccess}>
                                    {passwordSaving ? "Updating..." : "Update Password"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
