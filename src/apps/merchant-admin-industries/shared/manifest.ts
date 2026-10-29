/**
 * 行业 manifest 类型。每个行业目录必须导出自己的 manifest，注册表只消费。
 */
import type { MerchantIndustryCapability, MerchantIndustryModuleKey } from '../../../constants/merchantIndustryCapabilities';
import type { MerchantIndustryTemplateId } from '../../../constants/merchantIndustryTemplates';

export type IndustryManifest = {
  templateId: MerchantIndustryTemplateId;
  workspaceName: string;
  capability: MerchantIndustryCapability;
  nav: ReadonlyArray<{ key: MerchantIndustryModuleKey; label: string }>;
};
