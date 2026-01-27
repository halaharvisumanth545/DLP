import { Routes, Route, Navigate } from "react-router-dom";
import TeacherHome from "../pages/TeacherHome";
import { isAuthenticated, isTeacher } from "../services/auth";

// Protected route wrapper
function ProtectedTeacherRoute({ children }) {
    if (!isAuthenticated()) {
        return <Navigate to="/login" replace />;
    }
    if (!isTeacher()) {
        return <Navigate to="/student" replace />;
    }
    return children;
}

export default function TeacherRoutes() {
    return (
        <Routes>
            <Route
                path="/*"
                element={
                    <ProtectedTeacherRoute>
                        <TeacherHome />
                    </ProtectedTeacherRoute>
                }
            />
        </Routes>
    );
}
