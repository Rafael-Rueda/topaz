interface BadgeProps {
    children: React.ReactNode;
    color?: "amber" | "emerald" | "red" | "blue" | "gray" | "topaz";
    size?: "xs" | "sm";
}

const colorStyles: Record<string, string> = {
    amber: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    emerald: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    red: "bg-red-500/20 text-red-400 border-red-500/30",
    blue: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    gray: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    topaz: "bg-topaz-500/20 text-topaz-400 border-topaz-500/30",
};

export function Badge({ children, color = "gray", size = "sm" }: BadgeProps) {
    const sizeClasses = size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs";

    return (
        <span className={`inline-flex items-center rounded border font-medium ${sizeClasses} ${colorStyles[color]}`}>
            {children}
        </span>
    );
}
