import { Download, FileJson, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Observation } from '@/types/weather';
import { convertToCSV, downloadFile } from '@/lib/weatherUtils';

interface DownloadButtonsProps {
  observations: Observation[];
  stationName: string;
  disabled: boolean;
}

export function DownloadButtons({ observations, stationName, disabled }: DownloadButtonsProps) {
  const handleDownloadCSV = () => {
    const csv = convertToCSV(observations);
    const filename = `meteo-bcn-${stationName.replace(/\s+/g, '-').toLowerCase()}.csv`;
    downloadFile(csv, filename, 'text/csv');
  };

  const handleDownloadJSON = () => {
    const json = JSON.stringify(observations, null, 2);
    const filename = `meteo-bcn-${stationName.replace(/\s+/g, '-').toLowerCase()}.json`;
    downloadFile(json, filename, 'application/json');
  };

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleDownloadCSV}
        disabled={disabled}
        className="gap-2"
      >
        <FileSpreadsheet className="h-4 w-4" />
        CSV
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleDownloadJSON}
        disabled={disabled}
        className="gap-2"
      >
        <FileJson className="h-4 w-4" />
        JSON
      </Button>
    </div>
  );
}
