import type { ReactNode } from "react";

import { Sidebar } from "./Sidebar";

export function Layout({ children }: { children: ReactNode }) {
    return (
        <div className="h-full">
            <Sidebar />
            <main className="pt-16 pl-0 md:pt-0 md:pl-64">
                <div className="px-4 py-4 md:px-8 md:py-6">{children}</div>
            </main>
        </div>
    );
}
