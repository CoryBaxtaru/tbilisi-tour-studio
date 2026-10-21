// Hash routing: works on static hosting (GitHub Pages) without server rewrites.
import { useEffect, useState } from 'preact/hooks';

export function currentPath(): string {
  return location.hash.replace(/^#/, '') || '/';
}

export function navigate(path: string): void {
  location.hash = path;
}

export function usePath(): string {
  const [path, setPath] = useState(currentPath());
  useEffect(() => {
    const on = () => setPath(currentPath());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return path;
}
