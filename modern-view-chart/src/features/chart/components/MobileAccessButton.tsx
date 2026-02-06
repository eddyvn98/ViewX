import { useState, useEffect } from "react";
import { Smartphone, X, Copy, ExternalLink, RefreshCw } from "lucide-react";
import QRCode from "react-qr-code";
import { cn } from "@/lib/utils";

export function MobileAccessButton() {
    const [isOpen, setIsOpen] = useState(false);
    const [config, setConfig] = useState<{ mobile_link: string } | null>(null);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    const fetchConfig = async () => {
        setLoading(true);
        try {
            // Add timestamp to prevent caching
            const res = await fetch('/mobile-access.json?t=' + Date.now());
            if (res.ok) {
                const data = await res.json();
                setConfig(data);
            }
        } catch (e) {
            console.error("Failed to fetch mobile access config", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen && !config) {
            fetchConfig();
        }
    }, [isOpen]);

    const handleCopy = () => {
        if (config?.mobile_link) {
            navigator.clipboard.writeText(config.mobile_link);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    // Construct Telegram Share Link
    const telegramLink = config?.mobile_link
        ? `https://t.me/share/url?url=${encodeURIComponent(config.mobile_link)}&text=${encodeURIComponent("Trading Mobile Access Link")}`
        : "#";

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "text-zinc-500 hover:text-white transition active:scale-90 flex items-center gap-2",
                    isOpen && "text-blue-400"
                )}
                title="Mobile Access"
            >
                <Smartphone size={18} />
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40 bg-black/20"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute top-full right-0 mt-2 z-50 w-72 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl p-4 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-white text-sm uppercase tracking-wider">Mobile Access</h3>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={fetchConfig}
                                    className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-white transition"
                                    title="Refresh Link"
                                >
                                    <RefreshCw size={14} className={cn(loading && "animate-spin")} />
                                </button>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-white transition"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        {loading ? (
                            <div className="h-48 flex items-center justify-center text-zinc-500 text-xs">
                                Loading access link...
                            </div>
                        ) : config?.mobile_link ? (
                            <div className="flex flex-col items-center gap-4">
                                <div className="p-3 bg-white rounded-lg">
                                    <QRCode
                                        value={config.mobile_link}
                                        size={160}
                                        style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                        viewBox={`0 0 256 256`}
                                    />
                                </div>

                                <div className="w-full space-y-2">
                                    <button
                                        onClick={handleCopy}
                                        className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs font-bold text-zinc-300 flex items-center justify-center gap-2 transition-all"
                                    >
                                        {copied ? <span className="text-green-400">Copied!</span> : <><Copy size={14} /> Copy Link</>}
                                    </button>

                                    <a
                                        href={telegramLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full py-2 bg-[#229ED9]/10 hover:bg-[#229ED9]/20 border border-[#229ED9]/30 rounded-lg text-xs font-bold text-[#229ED9] flex items-center justify-center gap-2 transition-all"
                                    >
                                        <ExternalLink size={14} /> Send to Telegram
                                    </a>
                                </div>
                                <p className="text-[10px] text-zinc-600 text-center px-4">
                                    Scan QR or copy link to access charts on your phone securely.
                                </p>
                            </div>
                        ) : (
                            <div className="h-48 flex flex-col items-center justify-center text-zinc-600 text-xs text-center p-4 gap-2">
                                <Smartphone size={32} className="opacity-20" />
                                <p>Mobile access script not running.</p>
                                <p className="text-[10px] text-zinc-700">Run `python start_mobile_access.py`</p>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
