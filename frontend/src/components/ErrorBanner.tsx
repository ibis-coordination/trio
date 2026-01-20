import type { AppError } from '../types';

interface ErrorBannerProps {
  readonly error: AppError;
  readonly onDismiss: () => void;
}

export function ErrorBanner({ error, onDismiss }: ErrorBannerProps) {
  return (
    <div data-testid="error-banner" className="error-banner">
      <span className="error-message">{error.message}</span>
      <button
        data-testid="error-dismiss-button"
        className="error-dismiss"
        onClick={onDismiss}
        aria-label="Dismiss error"
      >
        ×
      </button>
    </div>
  );
}
