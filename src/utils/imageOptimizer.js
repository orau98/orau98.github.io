/**
 * Image optimization utilities for better loading performance
 */

/**
 * Check if WebP is supported by the browser
 */
export const checkWebPSupport = () => {
  return new Promise((resolve) => {
    const webP = new Image();
    webP.onload = webP.onerror = () => {
      resolve(webP.height === 2);
    };
    webP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
  });
};

/**
 * Get optimized image URL with WebP support
 */
export const getOptimizedImageUrl = async (baseUrl, filename, extension = '.jpg') => {
  const supportsWebP = await checkWebPSupport();
  
  // If WebP is supported and the image exists, try WebP first
  if (supportsWebP) {
    const webpUrl = `${baseUrl}${filename}.webp`;
    // Check if WebP version exists
    try {
      const response = await fetch(webpUrl, { method: 'HEAD' });
      if (response.ok) {
        return webpUrl;
      }
    } catch (_e) {
      // WebP version doesn't exist, fall back to original
    }
  }
  
  return `${baseUrl}${filename}${extension}`;
};

/**
 * Preload images with priority
 */
export const preloadImage = (url, priority = 'auto') => {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = url;
    link.fetchPriority = priority;
    
    // Also preload via Image object
    const img = new Image();
    img.decoding = 'async';
    img.fetchPriority = priority;
    
    img.onload = () => {
      document.head.appendChild(link);
      resolve(url);
    };
    
    img.onerror = () => {
      reject(new Error(`Failed to preload image: ${url}`));
    };
    
    img.src = url;
  });
};

/**
 * Create responsive image srcset
 */
export const createSrcSet = (baseUrl, filename, sizes = [400, 800, 1200]) => {
  return sizes
    .map(size => `${baseUrl}${filename}_${size}w.jpg ${size}w`)
    .join(', ');
};

/**
 * Lazy load images with Intersection Observer
 */
export class ImageLazyLoader {
  constructor(options = {}) {
    this.options = {
      rootMargin: options.rootMargin || '400px 0px',
      threshold: options.threshold || 0.01,
      ...options
    };
    
    this.observer = null;
    this.imageQueue = [];
    this.loadingImages = new Set();
    this.maxConcurrent = options.maxConcurrent || 3;
  }
  
  init() {
    if ('IntersectionObserver' in window) {
      this.observer = new IntersectionObserver(
        this.handleIntersection.bind(this),
        this.options
      );
    }
  }
  
  handleIntersection(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        this.queueImage(img);
        this.observer.unobserve(img);
      }
    });
    
    this.processQueue();
  }
  
  queueImage(img) {
    if (!this.imageQueue.includes(img) && !this.loadingImages.has(img)) {
      this.imageQueue.push(img);
    }
  }
  
  async processQueue() {
    while (this.imageQueue.length > 0 && this.loadingImages.size < this.maxConcurrent) {
      const img = this.imageQueue.shift();
      this.loadImage(img);
    }
  }
  
  async loadImage(img) {
    this.loadingImages.add(img);
    
    const dataSrc = img.dataset.src;
    const dataSrcset = img.dataset.srcset;
    
    if (dataSrc) {
      // Use requestIdleCallback for non-critical images
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          img.src = dataSrc;
          if (dataSrcset) {
            img.srcset = dataSrcset;
          }
        }, { timeout: 100 });
      } else {
        img.src = dataSrc;
        if (dataSrcset) {
          img.srcset = dataSrcset;
        }
      }
    }
    
    img.onload = () => {
      this.loadingImages.delete(img);
      img.classList.add('loaded');
      this.processQueue();
    };
    
    img.onerror = () => {
      this.loadingImages.delete(img);
      this.processQueue();
    };
  }
  
  observe(img) {
    if (this.observer) {
      this.observer.observe(img);
    } else {
      // Fallback for browsers without IntersectionObserver
      this.loadImage(img);
    }
  }
  
  disconnect() {
    if (this.observer) {
      this.observer.disconnect();
    }
    this.imageQueue = [];
    this.loadingImages.clear();
  }
}

/**
 * Progressive image loading with blur-up effect
 */
export const loadProgressiveImage = (src, placeholder) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = src;
    img.onload = () => resolve(src);
    img.onerror = () => resolve(placeholder);
  });
};
