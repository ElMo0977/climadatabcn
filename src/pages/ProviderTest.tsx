/**
 * Provider Test Page
 * 
 * Page wrapper for testing provider integrations.
 * Access at /provider-test
 */

import { Header } from '@/components/Header';
import { ProviderTestPanel } from '@/components/ProviderTestPanel';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ProviderTestPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header onRefresh={() => {}} isRefreshing={false} />
      
      <main className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <Button variant="ghost" asChild>
            <Link to="/" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Volver al dashboard
            </Link>
          </Button>
        </div>

        <div className="flex justify-center">
          <ProviderTestPanel />
        </div>

        <div className="mt-8 max-w-2xl mx-auto rounded-lg border bg-muted/30 p-4">
          <h3 className="font-medium mb-2">📝 Notas de implementación</h3>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>
              <strong>Modo mock:</strong> Activa con <code className="bg-muted px-1 rounded">VITE_DATA_MODE=mock</code> 
              para desarrollar sin API keys.
            </li>
            <li>
              <strong>Meteocat:</strong> Requiere API key. Solicita en{' '}
              <a 
                href="https://apidocs.meteocat.gencat.cat/documentacio/acces-ciutada-i-administracio/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                apidocs.meteocat.gencat.cat
              </a>
            </li>
            <li>
              <strong>Open Data BCN:</strong> Token opcional. Funciona en modo básico sin autenticación.
            </li>
            <li>
              <strong>CORS:</strong> Si hay problemas de CORS, las llamadas deberían pasar por una 
              Edge Function en el backend.
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
};

export default ProviderTestPage;
