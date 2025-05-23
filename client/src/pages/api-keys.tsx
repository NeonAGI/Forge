import React from 'react';
import { ApiKeyPanel } from '@/components/api-key-panel';
import { Link } from 'wouter';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ApiKeysPage: React.FC = () => {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-background to-card p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Navigation */}
        <div className="mb-8">
          <Link href="/">
            <Button variant="ghost" className="flex items-center hover:bg-card/50">
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
        
        {/* Page content */}
        <div className="space-y-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold">API Key Settings</h1>
            <p className="text-muted-foreground mt-2">
              Configure your API keys for weather data and AI features
            </p>
          </div>
          
          <ApiKeyPanel />
          
          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>
              These API keys are stored securely in your .env file and used to access external services.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiKeysPage; 