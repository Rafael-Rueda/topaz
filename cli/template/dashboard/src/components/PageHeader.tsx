interface PageHeaderProps {
    title: string;
    description?: string;
    action?: React.ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
    return (
        <div className="mb-6 flex items-center justify-between">
            <div>
                <h2 className="font-bold text-2xl text-white">{title}</h2>
                {description && <p className="mt-1 text-gray-500 text-sm">{description}</p>}
            </div>
            {action}
        </div>
    );
}
