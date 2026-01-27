import { NavLink, useLocation } from "react-router-dom";
import { STUDENT_NAV_ITEMS } from "../../utils/constants";
import "./Sidebar.css";

const icons = {
    dashboard: "📊",
    upload: "📤",
    book: "📖",
    pencil: "✏️",
    lightning: "⚡",
    clipboard: "📋",
    target: "🎯",
    chart: "📈",
};

export default function Sidebar() {
    const location = useLocation();

    return (
        <aside className="sidebar">
            <nav className="sidebar-nav">
                <ul className="nav-list">
                    {STUDENT_NAV_ITEMS.map((item) => (
                        <li key={item.path}>
                            <NavLink
                                to={item.path}
                                className={({ isActive }) =>
                                    `nav-item ${isActive || location.pathname === item.path ? "active" : ""}`
                                }
                            >
                                <span className="nav-icon">{icons[item.icon] || "📌"}</span>
                                <span className="nav-label">{item.label}</span>
                            </NavLink>
                        </li>
                    ))}
                </ul>
            </nav>


        </aside>
    );
}
