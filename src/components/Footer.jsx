import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-neutral-white/80 dark:bg-neutral-900/80 backdrop-blur-md shadow-sm mt-12">
      <div className="container mx-auto px-4 py-6 text-center text-neutral-500 dark:text-neutral-400">
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">サイト管理者について</h3>
            <p className="text-xs">
              研究者・博士 (理学)<br/>
              専門分野: 昆虫学、生態学、昆虫と植物の相互作用<br/>
              所属: 研究機関・大学
            </p>
          </div>
          
          <div className="border-t border-neutral-200 dark:border-neutral-700 pt-4">
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
        </div>
      </div>
    </footer>
  );
};

export default Footer;
