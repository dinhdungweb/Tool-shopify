interface SpinnerIconProps {
    size?: "xs" | "sm" | "md";
    className?: string;
    color?: "brand" | "gray" | "success" | "warning" | "error";
}

export default function SpinnerIcon({ 
    size = "sm", 
    className = "",
    color = "brand" 
}: SpinnerIconProps) {
    const sizeClasses = {
        xs: "h-4 w-4 border-2",
        sm: "h-5 w-5 border-2",
        md: "h-6 w-6 border-2",
    };

    const colorClasses = {
        brand: "border-brand-300 border-t-brand-600 dark:border-brand-700 dark:border-t-brand-400",
        gray: "border-gray-300 border-t-gray-600 dark:border-gray-700 dark:border-t-gray-400",
        success: "border-gray-300 border-t-success-500 dark:border-gray-700 dark:border-t-success-400",
        warning: "border-gray-300 border-t-warning-500 dark:border-gray-700 dark:border-t-warning-400",
        error: "border-gray-300 border-t-error-500 dark:border-gray-700 dark:border-t-error-400",
    };

    return (
        <div
            className={`animate-spin rounded-full ${sizeClasses[size]} ${colorClasses[color]} ${className}`}
        />
    );
}
