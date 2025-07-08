import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-neutral-white/80 dark:bg-neutral-900/80 backdrop-blur-md shadow-sm mt-12">
      <div className="container mx-auto px-4 py-6 text-center text-neutral-500 dark:text-neutral-400">
        <p className="text-sm">
          Data sourced from a private collection and the National Museum of Nature and Science. 
          This project is open source. You can find the code on {' '}
          <a 
            href="https://github.com/H-Amoto/insects-host-plant-explorer-" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-primary-600 dark:text-primary-400 hover:underline"
          >
            GitHub
          </a>.
        </p>
        <p className="text-xs mt-2">
          Built with React and Tailwind CSS. 
        </p>
      </div>
    </footer>
  );
};

export default Footer;
