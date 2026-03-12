import { Route, Routes } from "react-router-dom";

import { Layout } from "@/components/Layout";

import { Alerts } from "@/pages/Alerts";
import { DLQ } from "@/pages/DLQ";
import { Overview } from "@/pages/Overview";
import { Replay } from "@/pages/Replay";
import { Routes as RoutesPage } from "@/pages/Routes";
import { Schemas } from "@/pages/Schemas";
import { Sources } from "@/pages/Sources";
import { Transforms } from "@/pages/Transforms";

export function App() {
    return (
        <Layout>
            <Routes>
                <Route path="/" element={<Overview />} />
                <Route path="/dlq" element={<DLQ />} />
                <Route path="/alerts" element={<Alerts />} />
                <Route path="/replay" element={<Replay />} />
                <Route path="/routes" element={<RoutesPage />} />
                <Route path="/schemas" element={<Schemas />} />
                <Route path="/sources" element={<Sources />} />
                <Route path="/transforms" element={<Transforms />} />
            </Routes>
        </Layout>
    );
}
