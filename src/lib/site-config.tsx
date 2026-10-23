import { createContext, useContext } from 'react';
export const SiteConfigContext = createContext({siteName:'Dev Room'});
export const useSiteConfig = () => useContext(SiteConfigContext);
