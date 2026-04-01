import Navbar from "../components/common/Navbar";
import SystemArchitecture from "../components/student/SystemArchitecture";
import "./ArchitecturePage.css";

export default function ArchitecturePage() {
    return (
        <div className="architecture-shell">
            <Navbar />
            <main className="architecture-shell__main">
                <SystemArchitecture />
            </main>
        </div>
    );
}
