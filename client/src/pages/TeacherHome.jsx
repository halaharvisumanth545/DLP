import Navbar from "../components/common/Navbar";
import "./TeacherHome.css";

export default function TeacherHome() {
    return (
        <div className="teacher-layout">
            <Navbar />
            <main className="teacher-main">
                <div className="coming-soon">
                    <span className="coming-soon-icon">👨‍🏫</span>
                    <h1>Teacher Mode</h1>
                    <p>Coming Soon!</p>
                    <div className="features-preview">
                        <h3>Planned Features:</h3>
                        <ul>
                            <li>📝 Exam Creation</li>
                            <li>📄 Paper Generation</li>
                            <li>📊 Student Analytics</li>
                            <li>🎯 Conduct Exams</li>
                            <li>📈 Class-wise Reports</li>
                        </ul>
                    </div>
                </div>
            </main>
        </div>
    );
}
