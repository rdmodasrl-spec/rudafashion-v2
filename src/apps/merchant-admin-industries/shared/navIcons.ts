import {
  ArrowLeftRight,
  Boxes,
  ClipboardList,
  LayoutDashboard,
  MessageSquare,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Store,
  Truck,
  Users,
  UsersRound
} from 'lucide-react';
import type { MerchantIndustryModuleKey } from '../../../constants/merchantIndustryCapabilities';

/** 模块键 → 图标。只是展示映射，不承载业务差异。 */
export const industryModuleIcons: Record<MerchantIndustryModuleKey, typeof Package> = {
  dashboard: LayoutDashboard,
  products: Package,
  inventory: Boxes,
  orders: ShoppingCart,
  customers: Users,
  suppliers: Truck,
  procurement: ClipboardList,
  pos: Receipt,
  pos_sales: Receipt,
  pos_shifts: Receipt,
  stores: Store,
  transfers: ArrowLeftRight,
  team: UsersRound,
  messages: MessageSquare,
  settings: Settings
};
