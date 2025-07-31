import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-neutral-white/80 dark:bg-neutral-900/80 backdrop-blur-md shadow-sm mt-12">
      <div className="container mx-auto px-4 py-6 text-center text-neutral-500 dark:text-neutral-400">
        <p className="text-sm">
          Private collection data. Open source on {' '}
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
        <div className="text-xs mt-3 space-x-4">
          <a 
            href={`${import.meta.env.BASE_URL}privacy-policy.html`}
            className="text-primary-600 dark:text-primary-400 hover:underline"
          >
            プライバシーポリシー
          </a>
          <span className="text-neutral-400">|</span>
          <a 
            href={`${import.meta.env.BASE_URL}terms-of-service.html`}
            className="text-primary-600 dark:text-primary-400 hover:underline"
          >
            利用規約
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
