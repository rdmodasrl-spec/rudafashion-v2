import '@fontsource-variable/bodoni-moda/wght.css';
import '@fontsource-variable/cormorant-garamond/wght.css';
import '@fontsource-variable/manrope/wght.css';
import '../shared/foundation.css';
import './styles.css';
import { MerchantAdminApp } from './MerchantAdminApp';
import { ProductionFactoryWorkspace, isProductionFactoryEntry } from '../merchant-admin-common/components/merchant/ProductionFactoryWorkspace';
import { mountApp } from '../shared/mountApp';

mountApp('merchant-admin-web', isProductionFactoryEntry() ? <ProductionFactoryWorkspace /> : <MerchantAdminApp />);
