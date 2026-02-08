import { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Observation } from '@/types/weather';
import { buildAndDownloadExcel } from '@/lib/exportExcel';

interface DownloadButtonsProps {
  observations: Observation[];
  stationName: string;
  dataSourceLabel?: string;
  disabled: boolean;
}

export function DownloadButtons({ observations, stationName, dataSourceLabel, disabled }: DownloadButtonsProps) {
  const [exportingExcel, setExportingExcel] = useState(false);

  const handleDownloadExcel = async () => {
    setExportingExcel(true);
    try {
      await buildAndDownloadExcel(observations, stationName, dataSourceLabel);
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
        Excel
      </Button>
    </div>
  );
}
