import { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DownloadButtonsProps {
  onDownloadExcel: () => Promise<void>;
  disabled: boolean;
}

export function DownloadButtons({ onDownloadExcel, disabled }: DownloadButtonsProps) {
  const [exportingExcel, setExportingExcel] = useState(false);

  const handleDownloadExcel = async () => {
    setExportingExcel(true);
    try {
      await onDownloadExcel();
    } finally {
      setExportingExcel(false);
    }
  };

  return (
    <div className="flex items-center">
      <Button
        variant="default"
        size="sm"
        onClick={handleDownloadExcel}
        disabled={disabled || exportingExcel}
        className="gap-2 min-w-[7rem]"
      >
        {exportingExcel ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileDown className="h-4 w-4" />
        )}
        {exportingExcel ? 'Exportando...' : 'Excel'}
      </Button>
    </div>
  );
}
