import '@fontsource-variable/bodoni-moda/wght.css';
import '@fontsource-variable/cormorant-garamond/wght.css';
import '@fontsource-variable/manrope/wght.css';
import '../shared/foundation.css';
import './styles.css';
import { PlatformAdminApp } from './PlatformAdminApp';
import { mountApp } from '../shared/mountApp';

mountApp('platform-admin-mobile', <PlatformAdminApp />);
