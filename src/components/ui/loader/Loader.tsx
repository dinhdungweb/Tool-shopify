interface LoaderProps {
    size?: "sm" | "md" | "lg";
    text?: string;
    className?: string;
}

export default function Loader({ size = "md", text, className = "" }: LoaderProps) {
    const sizeClasses = {
        sm: "h-5 w-5 border-2",
        md: "h-8 w-8 border-2",
        lg: "h-12 w-12 border-4",
    };

    return (
        <div className={`flex flex-col items-center justify-center ${className}`}>
            <div
                className={`animate-spin rounded-full border-gray-200 border-t-brand-500 dark:border-gray-700 dark:border-t-brand-500 ${sizeClasses[size]}`}
            />
            {text && (
                <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">{text}</p>
            )}
        </div>
    );
}
