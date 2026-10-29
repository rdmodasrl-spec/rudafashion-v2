import '@fontsource-variable/bodoni-moda/wght.css';
import '@fontsource-variable/cormorant-garamond/wght.css';
import '@fontsource-variable/manrope/wght.css';
import '../shared/foundation.css';
import './styles.css';
import App from '../shared/PublicFrontendApp';
import { mountApp } from '../shared/mountApp';

mountApp('frontend-web', <App />);
