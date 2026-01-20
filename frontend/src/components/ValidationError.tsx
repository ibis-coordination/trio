interface ValidationErrorProps {
  readonly message: string;
}

export function ValidationError({ message }: ValidationErrorProps) {
  return (
    <div data-testid="validation-error" className="validation-error">
      {message}
    </div>
  );
}
