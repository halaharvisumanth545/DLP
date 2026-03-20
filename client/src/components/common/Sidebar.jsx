import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { logout } from "../../services/auth";
import { ROUTES, STUDENT_NAV_ITEMS } from "../../utils/constants";
import {
    DashboardIcon,
    UploadIcon,
    BookIcon,
    PencilIcon,
    LightningIcon,
    ClipboardIcon,
    TargetIcon,
    ChartIcon,
    LogoutIcon
} from "./Icons";
import "./Sidebar.css";

const iconMap = {
    dashboard: DashboardIcon,
    upload: UploadIcon,
    book: BookIcon,
    pencil: PencilIcon,
    lightning: LightningIcon,
    clipboard: ClipboardIcon,
    target: TargetIcon,
    chart: ChartIcon,
};

export default function Sidebar() {
    const location = useLocation();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate(ROUTES.LOGIN);
    };

    return (
        <aside className="sidebar">
            <nav className="sidebar-nav">
                <ul className="nav-list">
                    {STUDENT_NAV_ITEMS.map((item) => {
                        const IconComponent = iconMap[item.icon] || BookIcon;
                        return (
                            <li key={item.path}>
                                <NavLink
                                    to={item.path}
                                    className={({ isActive }) =>
                                        `nav-item ${isActive || location.pathname === item.path ? "active" : ""}`
                                    }
                                >
                                    <span className="nav-icon">
                                        <IconComponent />
                                    </span>
                                    <span className="nav-label">{item.label}</span>
                                </NavLink>
                            </li>
                        );
                    })}
                </ul>
                <button className="nav-item btn-signout" onClick={handleLogout}>
                    <span className="nav-icon">
                        <LogoutIcon />
                    </span>
                    <span className="nav-label">Signout</span>
                </button>
            </nav>
        </aside>
    );
}
