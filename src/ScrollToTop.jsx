import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// React Router no sube el scroll solo al cambiar de página.
// Sin esto, entrar a /terminos desde el final de otra página te deja a mitad de camino.
export default function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}