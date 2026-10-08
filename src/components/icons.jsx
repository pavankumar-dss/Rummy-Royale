import React from 'react';

// Small inline icon set (stroke icons, 24×24), sized and coloured via className.
const Icon = ({ children, className = 'w-5 h-5', ...props }) => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={className}
        {...props}
    >
        {children}
    </svg>
);

export const VolumeIcon = (p) => (
    <Icon {...p}>
        <path d="M11 5 6 9H2v6h4l5 4V5z" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
        <path d="M19 5a10 10 0 0 1 0 14" />
    </Icon>
);

export const MuteIcon = (p) => (
    <Icon {...p}>
        <path d="M11 5 6 9H2v6h4l5 4V5z" />
        <path d="m23 9-6 6M17 9l6 6" />
    </Icon>
);

export const HelpIcon = (p) => (
    <Icon {...p}>
        <circle cx="12" cy="12" r="10" />
        <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" />
        <path d="M12 17h.01" />
    </Icon>
);

export const ExitIcon = (p) => (
    <Icon {...p}>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="m16 17 5-5-5-5M21 12H9" />
    </Icon>
);

export const BulbIcon = (p) => (
    <Icon {...p}>
        <path d="M9 18h6M10 22h4" />
        <path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z" />
    </Icon>
);

export const SparklesIcon = (p) => (
    <Icon {...p}>
        <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
        <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z" />
    </Icon>
);

export const LayersIcon = (p) => (
    <Icon {...p}>
        <path d="m12 2 10 5-10 5L2 7l10-5z" />
        <path d="m2 17 10 5 10-5M2 12l10 5 10-5" />
    </Icon>
);

export const GroupIcon = (p) => (
    <Icon {...p}>
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="9" rx="1" />
        <path d="M3 17h18M7 21h10" />
    </Icon>
);

export const CheckIcon = (p) => (
    <Icon {...p}>
        <path d="M20 6 9 17l-5-5" />
    </Icon>
);

export const CrownIcon = ({ className = 'w-6 h-6' }) => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path d="M2 8l5 4 5-7 5 7 5-4-2 11H4L2 8z" fill="currentColor" />
        <rect x="4" y="20" width="16" height="2" rx="1" fill="currentColor" />
    </svg>
);
