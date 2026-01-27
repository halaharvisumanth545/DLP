import { Routes, Route, Navigate } from "react-router-dom";
import StudentHome from "../pages/StudentHome";
import Dashboard from "../components/student/Dashboard";
import SyllabusManager from "../components/student/SyllabusManager";
import UploadSyllabus from "../components/student/UploadSyllabus";

import StudyMaterial from "../components/student/StudyMaterial";
import SavedMaterials from "../components/student/SavedMaterials";
import ViewMaterial from "../components/student/ViewMaterial";
import PracticeSession from "../components/student/PracticeSession";
import SelfAssessment from "../components/student/SelfAssessment";
import QuizSession from "../components/student/QuizSession";
import TestSession from "../components/student/TestSession";
import QuestionView from "../components/student/QuestionView";
import ResultPage from "../components/student/ResultPage";
import Analytics from "../components/student/Analytics";
import WeakTopics from "../components/student/WeakTopics";
import SessionsList from "../components/student/SessionsList";
import { isAuthenticated, isStudent } from "../services/auth";

// Protected route wrapper
function ProtectedStudentRoute({ children }) {
    if (!isAuthenticated()) {
        return <Navigate to="/login" replace />;
    }
    if (!isStudent()) {
        return <Navigate to="/teacher" replace />;
    }
    return children;
}

export default function StudentRoutes() {
    return (
        <Routes>
            <Route
                path="/"
                element={
                    <ProtectedStudentRoute>
                        <StudentHome />
                    </ProtectedStudentRoute>
                }
            >
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="syllabi" element={<SyllabusManager />} />
                <Route path="upload-syllabus" element={<UploadSyllabus />} />
                <Route path="study-material" element={<StudyMaterial />} />
                <Route path="saved-materials" element={<SavedMaterials />} />
                <Route path="practice" element={<PracticeSession />} />
                <Route path="practice/session/:sessionId" element={<QuestionView />} />
                <Route path="self-assessment" element={<SelfAssessment />} />
                <Route path="self-assessment/session/:sessionId" element={<QuestionView />} />
                <Route path="quiz" element={<QuizSession />} />
                <Route path="quiz/session/:sessionId" element={<QuestionView />} />
                <Route path="test" element={<TestSession />} />
                <Route path="test/session/:sessionId" element={<QuestionView />} />
                <Route path="results/:sessionId" element={<ResultPage />} />
                <Route path="analytics" element={<Analytics />} />
                <Route path="weak-topics" element={<WeakTopics />} />
                <Route path="sessions" element={<SessionsList />} />
            </Route>

            {/* Standalone View Material Route (No Sidebar) */}
            <Route
                path="view-material/:id"
                element={
                    <ProtectedStudentRoute>
                        <ViewMaterial />
                    </ProtectedStudentRoute>
                }
            />
        </Routes>
    );
}
