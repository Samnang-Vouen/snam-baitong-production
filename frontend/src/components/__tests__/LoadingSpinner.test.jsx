import { render, screen } from '@testing-library/react';
import LoadingSpinner from '../LoadingSpinner';

describe('LoadingSpinner', () => {
  it('renders provided label', () => {
    render(<LoadingSpinner label="Fetching" />);
    expect(screen.getAllByText('Fetching').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });
});
