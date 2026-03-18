import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DownloadButtons } from './DownloadButtons';

describe('DownloadButtons', () => {
  it('shows loading state while exporting', async () => {
    let resolveExport: (() => void) | null = null;
    const onDownloadExcel = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveExport = resolve;
        }),
    );

    render(<DownloadButtons onDownloadExcel={onDownloadExcel} disabled={false} />);

    fireEvent.click(screen.getByRole('button', { name: /Excel/i }));
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByText('Exportando...')).toBeInTheDocument();

    resolveExport?.();

    await waitFor(() => {
      expect(screen.getByText('Excel')).toBeInTheDocument();
      expect(screen.getByRole('button')).not.toBeDisabled();
    });
  });
});
