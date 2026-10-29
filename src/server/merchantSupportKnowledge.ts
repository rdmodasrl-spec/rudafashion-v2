export type MerchantSupportKnowledgeCategory =
  | 'platform'
  | 'onboarding'
  | 'b2b_basics'
  | 'wholesale'
  | 'products'
  | 'operations'
  | 'fashion';

export type MerchantSupportKnowledgeSource = 'platform_verified' | 'industry_general';

export type MerchantSupportKnowledgeArticle = {
  id: string;
  title: string;
  category: MerchantSupportKnowledgeCategory;
  source: MerchantSupportKnowledgeSource;
  content: string;
};

export const merchantSupportKnowledgeCategories: Array<{
  id: MerchantSupportKnowledgeCategory;
  label: string;
}> = [
  { id: 'platform', label: 'RUDA 平台流程' },
  { id: 'onboarding', label: '商家入驻与开店' },
  { id: 'b2b_basics', label: 'B2B 基础' },
  { id: 'wholesale', label: '服装批发' },
  { id: 'products', label: '商品与商品资料' },
  { id: 'operations', label: '店铺经营与履约' },
  { id: 'fashion', label: '时尚行业常识' }
];

export const builtInMerchantSupportKnowledge: MerchantSupportKnowledgeArticle[] = [
  {
    id: 'platform-workbench-map',
    title: 'RUDA 商家工作台功能入口',
    category: 'platform',
    source: 'platform_verified',
    content: `RUDA 商家工作台常见入口：经营数据和待办打开「经营总览」；商品资料、上架和商品图片打开「商品管理」，规格/SKU 相关操作打开「规格生成」；库存数量和变动记录打开「库存流水」；订单履约、配货、发货和物流记录打开「配货发货」；店铺基本信息打开「商户资料」，店铺规则与通知偏好打开「系统设置」；财务对账和收款账户审核状态打开「财务对账」。真实库存、订单、付款、账户和审核结果必须通过平台数据或人工核查，AI 不应从通用知识推断。`
  },
  {
    id: 'platform-merchant-registration',
    title: 'RUDA 商家入驻申请与资料准备',
    category: 'onboarding',
    source: 'platform_verified',
    content: `RUDA 商家注册表单支持生产商/品牌商、服装工厂、批发商、设计工作室/Atelier、区域代理/分销商等经营类型，并选择服装现货区、服装订货区、精品皮包区或精品百货区。页面申请资料包括店铺/品牌名称、公司法定全称、商户 VAT/税号、联系人、邮箱、电话、城市、经营地址、经营类型、经营区域和登录密码；页面要求密码至少 8 位。提交后状态为待平台审核，审核通过后店铺和商家后台才会正式启用。不要承诺审核通过、处理时限或任何未列明的必交文件；企业证明文件要求、补件方式和申请状态的个案问题交平台人工确认。密码不能发给客服。`
  },
  {
    id: 'b2b-commerce-basics',
    title: 'B2B 服装交易的基本流程',
    category: 'b2b_basics',
    source: 'industry_general',
    content: `B2B 是企业与企业之间的交易。服装批发常见流程是：确认买卖双方主体与合作条件；浏览或索取商品目录；核对款号、颜色、尺码、可售数量、起订条件和交付地；书面确认报价、税费、运费、付款、发货与售后条款；生成订单并由双方核对；按约履约、收货验货并保存单据。具体交易条件以买卖双方确认的合同、报价单和平台显示为准。RUDA 的平台费、付款保障、账期、履约保证或争议裁决政策不得从一般 B2B 常识推断，应查阅已确认的 RUDA 规则或转人工。`
  },
  {
    id: 'wholesale-business-model',
    title: '服装批发商、品牌商与工厂的区别',
    category: 'wholesale',
    source: 'industry_general',
    content: `服装品牌商通常负责品牌定位、设计或商品企划，生产可由自有或合作工厂完成；制造工厂主要按订单或自有款式组织生产；批发商采购现货或集合多品牌货品，再面向零售商供货；代理/分销商依据约定的地域、渠道或客户范围推广和销售品牌；Atelier/设计工作室通常侧重小批量设计、打样或定制。实际业务可能兼具多种角色，合作前应确认货权、授权范围、生产主体、品质责任和可销售区域，不要仅凭企业名称推定资质。`
  },
  {
    id: 'wholesale-buyer-preparation',
    title: '买手下服装批发订单前的核对清单',
    category: 'wholesale',
    source: 'industry_general',
    content: `下单前建议买手逐项核对：款号和商品版本；颜色、尺码及各 SKU 数量；是现货、预售还是按单生产；每款/每色/每尺码的起订限制；批发价适用的数量档位与有效期；是否含税、运费、关税或其他费用；发货地、预计交期和分批发货安排；付款方式及付款对象；验货、瑕疵、短装、取消、退换货和争议流程；品牌商标及图片素材的使用许可。所有约定尽量保留书面确认。AI 无法查看某笔订单或确认卖家的实时库存、报价与发货时效。`
  },
  {
    id: 'wholesale-moq-assortment',
    title: '服装批发 MOQ 与混批的含义',
    category: 'wholesale',
    source: 'industry_general',
    content: `MOQ 是 Minimum Order Quantity，即最低起订量；卖家可能按订单总件数、单款、单色、单尺码或整手（尺码组合）计算，定义并不统一。“混批”通常指不同款、颜色或尺码可以组合达到起订要求，但是否允许以及组合规则由供应商设定。询价时要问清计量单位、每个 SKU 的最低数量、整手配比、补单限制、价格阶梯及不满足起订时的处理方式。RUDA 某家商户的起订规则只能以其具体商品/报价和人工确认为准。`
  },
  {
    id: 'wholesale-pricing-and-margin',
    title: '批发报价与零售毛利的基础核算',
    category: 'wholesale',
    source: 'industry_general',
    content: `比较服装批发报价时，应先统一币种、含税口径、数量档位、发货地和交付条件。买手可估算到岸成本：采购价 + 运输/保险 + 关税或进口税费 + 清关与其他可归属成本，再按当地税务口径计算销售毛利。简化毛利率常用（不含税销售收入－不含税商品成本）÷不含税销售收入；税务处理、税率和费用归属取决于交易地与企业情况，应咨询会计或税务专业人士。RUDA 不应承诺特定利润、汇率或税务结论。`
  },
  {
    id: 'wholesale-stock-vs-preorder',
    title: '现货、预售与按单生产的区别',
    category: 'wholesale',
    source: 'industry_general',
    content: `现货通常表示卖家已备有可售商品，但下单前仍应确认即时可分配数量和库存更新时间；预售通常先接受订单再按约定补货或发出；按单生产则在订单确认后排产，需额外确认打样、物料、生产周期、验货和取消条件。商品标题中的“现货”或“预售”不能代替卖家对具体 SKU、数量和交期的书面确认。平台 AI 不读取实时库存，不可保证可售数量或到货时间。`
  },
  {
    id: 'products-sku-and-size-runs',
    title: '服装 SKU、款号与尺码手数',
    category: 'products',
    source: 'industry_general',
    content: `SKU 是用于区分可售变体的库存单位，通常由款式/款号、颜色和尺码等组合形成；同款不同色码往往是不同 SKU。款号用于识别款式，不一定等同于 SKU。尺码手数是供应商预先设定的一组尺码及件数比例，例如每个尺码的配货数量，具体比例因品牌、市场和款式而异。建立商品资料时要让款号、色名、尺码系统、条码和 SKU 对应清晰，避免重复编码。尺码转换并非全球统一，必须核对供应商尺码表与目标市场。`
  },
  {
    id: 'products-quality-check',
    title: '服装批发收货验货的基础做法',
    category: 'products',
    source: 'industry_general',
    content: `收货验货可按双方已确认的规格与合同执行：核对箱数、款号、颜色、尺码和各 SKU 数量；抽查面料、颜色、缝制、辅料、标签和包装；记录瑕疵类型、数量、批次及照片；将发现的问题及时书面告知卖家并保存送货单、订单和沟通记录。抽检比例、可接受缺陷标准、索赔期限和补偿方式必须事先约定；行业通用建议不是法律规定，也不替代合同或专业质量检验。`
  },
  {
    id: 'products-description-and-imagery',
    title: '批发商品目录应包含的商品信息',
    category: 'products',
    source: 'industry_general',
    content: `便于专业买手采购的商品目录通常包含：准确款号、商品名称、品类、面料成分（以供应商核实资料为准）、颜色、可选尺码及尺码表、SKU/条码、产品实拍图、护理说明、包装方式、批发价及价格适用条件、MOQ、可售状态、产地（如已核实）、发货地及交付说明。图片应获得权利人许可，不应以修图掩盖商品真实状况。不得把未验证的成分、认证、原产地或可持续属性写成事实。`
  },
  {
    id: 'operations-store-opening',
    title: '服装商家开店前的准备步骤',
    category: 'operations',
    source: 'industry_general',
    content: `开设服装批发店铺前，可先确定目标客户和商品定位；整理合法经营主体、品牌/供货授权及联系人资料；建立准确的款号、尺码、颜色和库存记录；准备真实清晰且获授权的商品图片与描述；制定报价、MOQ、库存更新、包装、发货、售后和退换货规则；确认客服响应与订单对账流程；小范围测试下单、拣货、包装和售后流程后再扩大上新。各平台的入驻门槛、费用和审核规则不同，不能用通用开店建议代替 RUDA 官方要求。`
  },
  {
    id: 'operations-store-conversion',
    title: '批发店铺的商品陈列与客户转化',
    category: 'operations',
    source: 'industry_general',
    content: `B2B 商品陈列应优先帮助买手快速判断是否适配其门店：按品类、季节、风格、价格段或交付状态分类；标题呈现可检索的款号与品类；图片展示正反面、细节和上身效果并确保授权；清晰展示颜色尺码、MOQ、价格条件和库存更新时间；把热销补单款与新品系列分开管理；及时答复缺失信息并跟踪询盘。转化提升应基于真实数据和合规营销，不要虚构销量、稀缺性或品牌授权。`
  },
  {
    id: 'operations-fulfillment',
    title: '批发订单拣货、发货与物流协作',
    category: 'operations',
    source: 'industry_general',
    content: `订单履约可采用“订单确认—库存锁定或生产确认—按款色码拣货—复核数量与品质—包装并贴箱唛—交承运商—回填跟踪号—确认签收”的控制点。跨境交易还需事先确认交货方式、出口/进口责任、运输保险、关税和清关资料由谁负责。不同 Incoterms® 条款有特定含义，应使用明确版本并由熟悉贸易的专业人员确认。AI 不可查询或保证 RUDA 的实际订单状态、物流轨迹或送达日期。`
  },
  {
    id: 'operations-returns-and-disputes',
    title: '服装批发退换货与争议预防',
    category: 'operations',
    source: 'industry_general',
    content: `服装 B2B 交易中退换货权利和例外可能受到合同、交易类型及适用法律影响，不存在可对所有批发订单一概适用的统一期限。合作前书面约定质量瑕疵定义、验货期限、证据形式、短装/错发处理、退货授权、运费承担、退款或补货方式和争议升级渠道。发生问题时保存订单、发票、物流与照片记录，先按平台正式流程提交。具体退款、赔偿、法律权利或争议个案必须人工核查，不能由 AI 作法律判断或承诺结果。`
  },
  {
    id: 'fashion-seasonal-buying',
    title: '时尚零售季节性采购与系列规划',
    category: 'fashion',
    source: 'industry_general',
    content: `时尚零售采购通常结合目标客群、历史销售、当地气候、节庆/假期、上新节奏和供应商交期制定系列。可将预算分给基础常青款、季节主推款和小比例趋势试验款，并根据试销、售罄率、退货原因和尺码销售分布及时补货或调整。趋势不是销量保证；不同国家、渠道和客群差异很大，应使用买手自己的销售数据验证。`
  },
  {
    id: 'fashion-trend-adoption',
    title: '如何谨慎评估时尚趋势',
    category: 'fashion',
    source: 'industry_general',
    content: `评估趋势时可交叉观察专业展会、品牌系列、零售陈列、消费者搜索与社交讨论，但要区分短期话题和持续需求；再核对供应能力、成本、颜色/尺码覆盖、目标客群接受度和上架时点。先小批量测试或收集预订单反馈，避免仅凭趋势报道大量备货。趋势资料是参考，不代表 RUDA 商家一定供应相应款式，也不构成销售保证。`
  },
  {
    id: 'fashion-sustainability-claims',
    title: '服装材料与可持续声明的核实原则',
    category: 'fashion',
    source: 'industry_general',
    content: `服装材料或“有机、再生、可持续、低碳、认证”等声明应有供应链文件、证书范围和适用产品依据；须核对证书持有人、有效期、具体产品/工厂覆盖范围及允许的营销措辞。不得仅凭供应商口头描述或面料外观作认证推断，也不要作绝对、宽泛或无法证明的环境声明。相关法规要求依销售市场而异，应咨询合规或法律专业人员。`
  },
  {
    id: 'fallback-information-request',
    title: '信息不足时的客服兜底与转人工话术',
    category: 'platform',
    source: 'platform_verified',
    content: `无法确认答案时不要猜测。先简短承接：“收到，我先帮您把问题确认清楚。”根据问题只问一个最关键的问题，例如“您目前在哪个页面，看到的完整提示是什么？”或“请问您咨询的是现货、预售还是按单生产？”说明可通过「平台客服」由人工继续核查。排查页面故障可请商家提供页面名称、操作步骤、错误提示和大致时间。不要索取密码、验证码、完整银行卡资料、IBAN 或买家付款资料。不得承诺审核、退款、结算或回复时限。`
  }
];

export const defaultMerchantSupportKnowledgeArticleIds = new Set(
  builtInMerchantSupportKnowledge.map(article => article.id)
);

export function isMerchantSupportKnowledgeCategory(value: unknown): value is MerchantSupportKnowledgeCategory {
  return typeof value === 'string' && merchantSupportKnowledgeCategories.some(category => category.id === value);
}

export function validateMerchantSupportKnowledgeArticles(value: unknown): MerchantSupportKnowledgeArticle[] | null {
  if (!Array.isArray(value) || value.length > 100) return null;
  const ids = new Set<string>();
  const articles: MerchantSupportKnowledgeArticle[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') return null;
    const record = item as Record<string, unknown>;
    if (
      typeof record.id !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,80}$/.test(record.id) ||
      ids.has(record.id) ||
      typeof record.title !== 'string' ||
      !record.title.trim() ||
      record.title.trim().length > 160 ||
      !isMerchantSupportKnowledgeCategory(record.category) ||
      (record.source !== 'platform_verified' && record.source !== 'industry_general') ||
      typeof record.content !== 'string' ||
      !record.content.trim() ||
      record.content.trim().length > 8000
    ) return null;
    ids.add(record.id);
    articles.push({
      id: record.id,
      title: record.title.trim(),
      category: record.category,
      source: record.source,
      content: record.content.trim()
    });
  }
  return articles;
}
