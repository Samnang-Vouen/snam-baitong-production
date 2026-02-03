export default function LoadingSpinner({ label = 'Loading...' }) {
  return (
    <div className="text-center my-4" data-testid="loading-spinner">
      <div className="spinner-border text-success" role="status">
        <span className="visually-hidden">{label}</span>
      </div>
      <div className="mt-2 fw-semibold">{label}</div>
    </div>
  );
}
