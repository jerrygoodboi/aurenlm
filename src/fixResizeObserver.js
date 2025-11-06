// src/fixResizeObserver.js
const resizeObserverErr = /(ResizeObserver loop limit exceeded|ResizeObserver loop completed|ResizeObserver loop depth exceeded)/i;

// Block normal errors
window.addEventListener('error', (e) => {
  if (resizeObserverErr.test(e.message)) {
    console.debug('[suppressed ResizeObserver error]');
    e.stopImmediatePropagation();
  }
});

// Block promise rejections
window.addEventListener('unhandledrejection', (e) => {
  if (resizeObserverErr.test(e.reason?.message || '')) {
    console.debug('[suppressed ResizeObserver rejection]');
    e.preventDefault();
  }
});

// Monkey-patch console.error itself
const origError = console.error;
console.error = (...args) => {
  if (args && args.length && typeof args[0] === 'string' && resizeObserverErr.test(args[0])) {
    return; // swallow it silently
  }
  origError.apply(console, args);
};