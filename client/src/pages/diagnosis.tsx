import { useEffect } from 'react';
import { Link } from 'wouter';

const Diagnosis = () => {
  useEffect(() => {
    // Log to confirm the component is mounting
    console.log('Diagnosis page loaded');
    
    // Check if Tailwind classes are loaded
    const styles = window.getComputedStyle(document.documentElement);
    console.log('Body background color:', styles.getPropertyValue('background-color'));
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center p-4 space-y-6">
      {/* Navigation Bar */}
      <div className="w-full glass mb-6 p-4 flex justify-between items-center">
        <h2 className="text-xl font-bold">Style Diagnosis</h2>
        <nav className="flex space-x-4">
          <Link href="/">
            <a className="text-accent hover:text-accent-glow transition-colors">Back to Dashboard</a>
          </Link>
        </nav>
      </div>
      
      <h1 className="text-4xl font-bold text-accent">Styling Diagnosis Page</h1>
      
      <div className="glass p-6 w-full max-w-md">
        <h2 className="text-2xl font-semibold mb-4">Glass Card Test</h2>
        <p className="text-muted mb-4">This card should have a frosted glass effect if styles are loading properly.</p>
        <button className="bg-accent text-white px-4 py-2 rounded-md hover:bg-accent-glow transition-colors">
          Styled Button
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl">
        <div className="glass-glow p-4 rounded-xl">
          <h3 className="text-xl font-medium">Orange Glow Card</h3>
          <p>Should have orange glow effect</p>
        </div>
        
        <div className="glass-glow-cyan p-4 rounded-xl">
          <h3 className="text-xl font-medium">Cyan Glow Card</h3>
          <p>Should have cyan glow effect</p>
        </div>
        
        <div className="glass-depth p-4 rounded-xl">
          <h3 className="text-xl font-medium">Depth Card</h3>
          <p>Should have depth effect</p>
        </div>
      </div>
      
      <div className="text-center mt-8">
        <p className="text-sm text-muted">
          CSS Classes Status: <span className="text-accent">Diagnosis Complete</span>
        </p>
        <p className="text-xs mt-2">
          If this page looks styled with glass effects, then Tailwind CSS is working correctly.
        </p>
      </div>
    </div>
  );
};

export default Diagnosis; 