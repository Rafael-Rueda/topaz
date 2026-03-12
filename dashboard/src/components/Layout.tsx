import type { ReactNode } from "react";

import { Sidebar } from "./Sidebar";

export function Layout({ children }: { children: ReactNode }) {
    return (
        <div className="h-full">
            <Sidebar />
            <main className="pl-64">
                <div className="px-8 py-6">{children}</div>
            </main>
        </div>
    );
}
