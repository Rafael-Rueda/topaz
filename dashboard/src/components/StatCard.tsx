import { Card } from "@tremor/react";

interface StatCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    trend?: "up" | "down" | "neutral";
    color?: "amber" | "red" | "green" | "blue" | "gray";
}

const colorMap = {
    amber: "text-topaz-400",
    red: "text-red-400",
    green: "text-emerald-400",
    blue: "text-blue-400",
    gray: "text-gray-400",
};

const trendIcons = {
    up: "↑",
    down: "↓",
    neutral: "→",
};

export function StatCard({ title, value, subtitle, trend, color = "amber" }: StatCardProps) {
    return (
        <Card className="!bg-gray-900 !border-gray-800 !ring-0">
            <p className="text-gray-500 text-sm">{title}</p>
            <p className={`mt-1 font-semibold text-3xl ${colorMap[color]}`}>
                {value}
                {trend && <span className="ml-2 text-sm">{trendIcons[trend]}</span>}
            </p>
            {subtitle && <p className="mt-1 text-gray-600 text-xs">{subtitle}</p>}
        </Card>
    );
}
