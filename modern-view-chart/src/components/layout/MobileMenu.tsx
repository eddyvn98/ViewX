import React from 'react';
import { Settings, User, LogOut, HelpCircle, FileText, Bell, Monitor, ChevronRight, House } from 'lucide-react';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';

export function MobileMenu() {
    const [user, setUser] = React.useState({
        name: 'Guest',
        email: 'guest@vivutrade.io.vn',
        balance: 24500.00,
    });
    const [isAuthenticated, setIsAuthenticated] = React.useState(false);

    React.useEffect(() => {
        if (typeof window === "undefined") return;
        const raw = localStorage.getItem("auth_user") || "";
        const token = (localStorage.getItem("auth_access_token") || "").trim();
        setIsAuthenticated(Boolean(token));
        if (!raw) return;
        try {
            const parsed = JSON.parse(raw);
            const email = String(parsed?.username || "").trim() || "guest@vivutrade.io.vn";
            const name = String(parsed?.display_name || "").trim() || email.split("@")[0] || "Guest";
            setUser((prev) => ({ ...prev, name, email }));
        } catch {
            // Keep default guest profile.
        }
    }, []);

    const handleLogout = React.useCallback(async () => {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({}),
            });
        } catch {
            // Ignore logout API errors and still clear local session.
        } finally {
            if (typeof window !== 'undefined') {
                localStorage.removeItem('auth_access_token');
                localStorage.removeItem('auth_user');
                window.location.href = '/';
            }
        }
    }, []);

    return (
        <div className="flex flex-col h-full bg-zinc-950 text-zinc-300">
            {/* Profile Section */}
            <div className="p-6 bg-zinc-900/50 border-b border-zinc-800 flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-xl font-bold text-white shadow-lg shadow-blue-900/20">
                    {user.name.charAt(0)}
                </div>
                <div className="flex-1">
                    <h2 className="text-base font-bold text-white leading-tight">{user.name}</h2>
                    <p className="text-[11px] text-zinc-500">{user.email}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] uppercase font-bold text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded">Live</span>
                        <p className="text-sm font-mono font-bold text-green-400">${user.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                    </div>
                </div>
            </div>

            {/* Menu Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
                <MenuItem icon={House} label="Trang chủ" onClick={() => { window.location.href = '/'; }} />
                <MenuItem icon={User} label="Account Profile" />
                <MenuItem icon={Bell} label="Notifications" badge="3" />
                <MenuItem icon={Monitor} label="Display Settings" />

                <div className="h-px bg-zinc-800/50 my-3 mx-2" />

                <MenuItem icon={Settings} label="App Settings" />
                <MenuItem icon={HelpCircle} label="Help & Support" />
                <MenuItem icon={FileText} label="Terms of Service" />
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-zinc-800 bg-zinc-900/30">
                {!isAuthenticated ? (
                    <GoogleSignInButton className="mb-3" text="signin_with" size="large" width={280} redirectTo="/chart" />
                ) : (
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 w-full p-3 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors group"
                    >
                        <LogOut size={20} className="group-hover:translate-x-1 transition-transform" />
                        <span className="font-medium text-sm">Sign Out</span>
                    </button>
                )}
                <div className="mt-4 text-center text-[10px] text-zinc-600 font-mono">
                    OpenTrade Mobile v1.0.0-beta
                </div>
            </div>
        </div>
    );
}

type MenuItemProps = {
    icon: React.ComponentType<{ size?: number }>;
    label: string;
    onClick?: () => void;
    badge?: string;
};

function MenuItem({ icon: Icon, label, onClick, badge }: MenuItemProps) {
    return (
        <button onClick={onClick} className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-zinc-800/50 active:bg-zinc-800 transition-colors group">
            <div className="p-2 rounded-md bg-zinc-900 text-zinc-400 group-hover:text-blue-400 group-hover:bg-blue-400/10 transition-colors">
                <Icon size={18} />
            </div>
            <span className="font-medium text-sm flex-1 text-left">{label}</span>
            {badge && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
                    {badge}
                </span>
            )}
            <ChevronRight size={14} className="text-zinc-700 group-hover:text-zinc-500" />
        </button>
    )
}
