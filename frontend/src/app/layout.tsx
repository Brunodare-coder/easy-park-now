/**
 * Root Layout Component
 * 
 * This is the root layout for the EasyParkNow Next.js application.
 * It wraps all pages and provides global styles and basic structure.
 */

import './globals.css';

// Metadata for SEO and social sharing
export const metadata = {
  title: {
    default: 'EasyParkNow - Find & Book Parking Spaces',
    template: '%s | EasyParkNow'
  },
  description: 'Find and book parking spaces instantly or earn money by renting out your driveway. Join thousands of drivers and space owners using EasyParkNow.',
  keywords: [
    'parking',
    'book parking',
    'find parking',
    'parking spaces',
    'driveway rental',
    'parking app',
    'UK parking',
    'London parking'
  ],
};

/**
 * Root Layout Component
 * 
 * This component wraps all pages in the application and provides:
 * - Global styles and fonts
 * - Common HTML structure
 * - Basic layout structure
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Preconnect to external domains for better performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
        
        {/* Favicon and app icons */}
        <link rel="icon" href="/favicon.ico" />
        
        {/* Theme color for mobile browsers */}
        <meta name="theme-color" content="#2563eb" />
        
        {/* Viewport meta tag for responsive design */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
      </head>
      <body className="font-inter antialiased bg-white text-gray-900">
        {/* Skip to main content link for accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 rounded-md z-50"
        >
          Skip to main content
        </a>
        
        {/* Main application content */}
        <div id="main-content" className="min-h-screen flex flex-col">
          {children}
        </div>
        
        {/* Portal for modals and overlays */}
        <div id="modal-root" />
        <div id="tooltip-root" />
      </body>
    </html>
  );
}
