import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

const nav = [
    {
        to: "/",
        label: "Overview",
        icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4",
    },
    {
        to: "/dlq",
        label: "Dead Letter Queue",
        icon: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16",
    },
    {
        to: "/alerts",
        label: "Alerts",
        icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
    },
    {
        to: "/replay",
        label: "Replay",
        icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
    },
    {
        to: "/sources",
        label: "Sources",
        icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
    },
    {
        to: "/routes",
        label: "Routes",
        icon: "M13 10V3L4 14h7v7l9-11h-7z",
    },
    {
        to: "/transforms",
        label: "Transforms",
        icon: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4",
    },
    {
        to: "/schemas",
        label: "Schemas",
        icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    },
];

function MenuIcon({ open }: { open: boolean }) {
    return (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            {open ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
        </svg>
    );
}

export function Sidebar() {
    const [isOpen, setIsOpen] = useState(false);
    const location = useLocation();

    // Close mobile menu when route changes
    useEffect(() => {
        setIsOpen(false);
    }, [location]);

    // Close mobile menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            const target = event.target as HTMLElement;
            // Don't close if clicking on sidebar or menu button
            if (isOpen && !target.closest("[data-sidebar]") && !target.closest("[data-menu-button]")) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    // Prevent body scroll when mobile menu is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    return (
        <>
            {/* Mobile Header */}
            <header className="fixed top-0 right-0 left-0 z-50 flex h-16 items-center justify-between border-gray-800 border-b bg-gray-900 px-4 md:hidden">
                <div className="flex items-center gap-3">
                    <img src="/logo.png" alt="Topaz" className="h-8 w-8 rounded-lg object-contain" />
                    <div>
                        <h1 className="font-semibold text-sm text-white">Topaz</h1>
                        <p className="text-gray-500 text-xs">Ingestion Dashboard</p>
                    </div>
                </div>
                <button
                    data-menu-button
                    onClick={() => setIsOpen((prev) => !prev)}
                    className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white"
                    aria-label={isOpen ? "Close menu" : "Open menu"}
                >
                    <MenuIcon open={isOpen} />
                </button>
            </header>

            {/* Mobile Menu Overlay */}
            {isOpen && <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden" />}

            {/* Sidebar Navigation */}
            <aside
                data-sidebar
                className={`fixed top-0 left-0 z-50 flex h-full w-64 flex-col border-gray-800 border-r bg-gray-900 transition-transform duration-300 ease-in-out md:translate-x-0 ${
                    isOpen ? "translate-x-0" : "-translate-x-full"
                }`}
            >
                {/* Logo - hidden on mobile (shown in header) */}
                <div className="hidden h-16 items-center gap-3 border-gray-800 border-b px-6 md:flex">
                    <img src="/logo.png" alt="Topaz" className="h-8 w-8 rounded-lg object-contain" />
                    <div>
                        <h1 className="font-semibold text-sm text-white">Topaz</h1>
                        <p className="text-gray-500 text-xs">Ingestion Dashboard</p>
                    </div>
                </div>

                {/* Spacer for mobile (header height) */}
                <div className="h-16 md:hidden" />

                {/* Navigation */}
                <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
                    {nav.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.to === "/"}
                            onClick={() => setIsOpen(false)}
                            className={({ isActive }) =>
                                `flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium text-sm transition-colors ${
                                    isActive
                                        ? "bg-topaz-500/10 text-topaz-400"
                                        : "text-gray-400 hover:bg-gray-800 hover:text-white"
                                }`
                            }
                        >
                            <svg
                                className="h-5 w-5 shrink-0"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={1.5}
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                            </svg>
                            {item.label}
                        </NavLink>
                    ))}
                </nav>

                {/* Footer */}
                <div className="border-gray-800 border-t px-6 py-4">
                    <p className="text-gray-600 text-xs">Rueda Gems</p>
                </div>
            </aside>
        </>
    );
}
