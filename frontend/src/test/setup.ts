import "@testing-library/jest-dom/vitest";

// jsdom does not implement matchMedia — provide a minimal stub so components
// that rely on it (e.g. the video player) can render in tests.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
