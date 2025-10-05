import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  description?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  title,
  description,
}) => (
  <div
    className={`rounded-lg border border-gray-200 bg-white p-6 shadow-sm ${className}`}
  >
    {Boolean(title) && (
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {Boolean(description) && (
          <p className="mt-1 text-sm text-gray-600">{description}</p>
        )}
      </div>
    )}
    <div>{children}</div>
  </div>
);
