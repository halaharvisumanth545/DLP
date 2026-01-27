import { Outlet } from "react-router-dom";
import Navbar from "../components/common/Navbar";
import Sidebar from "../components/common/Sidebar";
import "./StudentHome.css";

export default function StudentHome() {
    return (
        <div className="student-layout">
            <Navbar />
            <div className="student-content">
                <Sidebar />
                <main className="student-main">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
