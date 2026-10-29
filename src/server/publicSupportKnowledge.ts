type PublicSupportArticle = {
  title: string;
  keywords: string[];
  content: string;
  source: 'platform_verified' | 'industry_general';
};

export type PublicAssistantGuidance = {
  reply: string;
  action?: 'registration' | 'catalog';
};

const publicSupportArticles: PublicSupportArticle[] = [
  {
    title: 'RUDA 注册账户类型与入口',
    keywords: ['怎么注册', '如何注册', '注册入口', '注册账号', '创建账户', '买家注册', '企业注册', '注册成为', 'sign up', 'register', 'registrazione'],
    source: 'platform_verified',
    content: 'RUDA 注册入口 /register-wholesale 会先让用户选择账户类型：企业账户（生产商、批发商或零售商，需提交企业资料并完成相应验证/审核）、商家账户（商家后台账户，企业资料可后续补充，是否开放及具体条件以注册页面为准）、个人零售账户（个人购物账户）。员工账户不开放自助注册，需由所属商家管理员创建。AI 可以提供入口并说明选择方式，但不得在聊天里索取或代收密码、验证码、完整税号或证件资料。'
  },
  {
    title: 'RUDA 公开收费与商品价格说明',
    keywords: ['注册费', '入驻费', '平台费', '平台收费', '怎么收费', '收费标准', '佣金', '手续费', '订阅价格', '会员费', '费用是多少', 'platform fee', 'registration fee', 'commission', 'subscription price', 'costi di registrazione', 'commissioni'],
    source: 'platform_verified',
    content: '当前已核实的公开资料没有提供适用于所有用户的 RUDA 注册费、商家入驻费、交易佣金或平台服务费统一金额；不得推断为免费，也不得编造费率或报价。公开商品页会展示对应商品已发布的批发价格、起订量及规格信息；税费、运费、可用库存、报价有效期和交货条件需在商品页及与商家确认。ModaUI 商家套餐及 Credits 属于商家后台的独立服务，公开访客 AI 不应承诺可购买、引用过期套餐数字或将其说成 RUDA 入驻费；应引导登录后查看当前套餐页面。'
  },
  {
    title: 'RUDA 平台与商家目录',
    keywords: ['RUDA', '平台', '商家', '供应商', '公司', '品牌', '店铺', 'showroom', '商家地图', 'directory'],
    source: 'platform_verified',
    content: 'RUDA Fashion 是面向服装行业的 B2B 平台。访客可以在官方展厅/商家地图浏览已认证商家，并打开商家的官方店铺查看公开资料。商家搜索结果以平台已认证且公开展示的商家资料为准；没有匹配结果时不能推测平台外的公司。'
  },
  {
    title: '查找商品、商品价格与起订量',
    keywords: ['找货', '商品', '产品', '现货', '价格', '批发价', '起订量', 'MOQ', '库存', '款号', '配码'],
    source: 'platform_verified',
    content: '买家可以在现货商城或商家官方店铺浏览公开商品。商品详情页展示该商品已发布的价格、起订量及可公开的规格资料。AI 可以按平台当前已发布的公开商品记录查找，但不能保证实时可分配库存、报价有效期、税费、运费或交货时间；下单前应在商品页和商家确认。'
  },
  {
    title: '特价与折扣市场',
    keywords: ['特价', '折扣', '清仓', '促销', '便宜', '最低价', '打折', 'clearance', 'discount', 'sale'],
    source: 'platform_verified',
    content: 'RUDA 首页有特价市场。特价搜索只应匹配已发布、非私密、未受独家保护且状态为 clearance 的公开商品。商品价格比较使用平台展示的批发单价；起订量和实际库存仍需查看商品详情并向商家确认。'
  },
  {
    title: '买家批发采购流程',
    keywords: ['怎么采购', '怎么下单', '批发', '采购', '购物车', '结算', '订单', '买家注册', '买手'],
    source: 'platform_verified',
    content: '买家通常先浏览公开商品或商家店铺，核对款号、颜色、尺码、价格和起订量，再将可采购商品加入采购车并按页面流程提交订单。具体商品的 SKU 配比、库存、付款和发货条件以商品页、订单页及买卖双方确认的信息为准。'
  },
  {
    title: '商家入驻与经营类型',
    keywords: ['商家入驻', '开店', '注册商家', '申请商家', '生产厂家', '工厂', '批发商', '零售店', '品牌商', '制造商'],
    source: 'platform_verified',
    content: 'RUDA 商家申请可选择生产商/品牌商、制造商、批发商、Atelier/设计工作室或分销商等经营类型，并选择平台经营区域。申请表需要填写企业及联系人资料，提交后进入平台审核。审核结果、所需补件、费用和处理时间必须以平台实际通知为准，不能预先承诺。'
  },
  {
    title: '商家工作台常用功能',
    keywords: ['商家工作台', '商品管理', '上架', '库存流水', '发货', '物流', '商户资料', '系统设置', '财务对账'],
    source: 'platform_verified',
    content: '商家工作台中，经营总览查看经营数据和待办；商品管理维护商品资料和上架；库存流水查看库存变动；配货发货处理订单履约和物流记录；商户资料维护店铺基本信息；系统设置管理店铺规则与通知偏好；财务对账查看对账记录和收款账户审核状态。AI 不读取商家私有后台数据，不能确认个案状态。'
  },
  {
    title: '公开目录搜索边界',
    keywords: ['国家', '城市', '地点', '希腊', '意大利', '找商家', '找公司', '有哪些店'],
    source: 'platform_verified',
    content: '商家目录可按平台登记的国家、城市、商家类型和公开主营资料筛选。搜索仅返回平台已认证商家；没有匹配时应如实说明，并可建议浏览全部商家目录或调整筛选条件。'
  },
  {
    title: 'RUDA AI 助手可以做什么',
    keywords: [
      '你能做什么', '你能帮我做什么', '你可以做什么', '可以做什么', '你会什么', '能帮什么', '你可以帮我', '可以帮忙', '怎么用你', '助手功能', '功能介绍', 'AI功能', '能不能帮我',
      '订单查询', '我的订单', '订单号', '客户资料', '销售额', '销售数据', '流量分析',
      '后台数据', '主题', '域名', '自动化', '促销活动', '修改商品', '编辑商品', '保存设置',
      'shopify', 'Shopify后台', 'capabilities', 'what can you do'
    ],
    source: 'platform_verified',
    content: 'RUDA 首页 AI 助手可按公司名、国家/城市、商家类型和公开主营资料查找已认证商家；可查找公开上架商品，问“便宜/最低价”时只在特价区按平台批发单价筛选，普通品类查询则搜索公开商品；可解释 RUDA 已确认的公开流程、服装批发和 B2B 基础知识，并协助起草文案或给出经营建议。首页助手不能读取买家或商家的私有订单、客户、后台库存、销售分析或账户资料；不能替用户编辑并保存商品、订单、设置、主题或营销自动化，也不能声称已完成这些操作。价格、库存和交易条件以商品详情及商家确认为准。'
  },
  {
    title: '服装批发经营建议与文案',
    keywords: ['经营建议', '选品建议', '销售建议', '写文案', '商品标题', '商品描述', '促销文案', '营销创意', '利润', '毛利'],
    source: 'industry_general',
    content: '助手可以根据用户提供的商品特点、目标客户和市场，起草商品标题、描述、推广文案或给出一般性的选品与经营建议。此类内容属于通用辅助，不代表 RUDA 的经营承诺、销售数据、平台政策或专业法律/税务意见；发布前应由商家核对事实并自行决定。'
  }
];

export function getPublicAssistantGuidance(message: string): PublicAssistantGuidance | null {
  const normalized = normalize(message);
  const isChinese = /[\u4e00-\u9fff]/.test(message);
  const isItalian = /\b(?:registrare|registrazione|costi|commissione|prezzo|prezzi|quanto costa)\b/i.test(message);
  const asksRegistration = /注册|入驻|开店|创建.{0,8}(?:账户|账号)|(?:账户|账号).{0,8}注册|成为(?:买家|商家)|sign\s?up|register|registration|registrarsi|registrazione/i.test(message);
  const asksPlatformFees = /注册费|入驻费|平台费|平台收费|怎么收费|收费|费用|费率|多少钱|价格|佣金|手续费|会员费|服务费|订阅(?:价格|费用|收费)?|套餐.{0,8}(?:价格|费用|收费|多少钱)|(?:价格|费用).{0,8}套餐|平台.{0,8}(?:费用|费率)|(?:费用|费率).{0,8}平台|registration fee|platform fee|commission|service fee|subscription price|cost|price|quanto costa|costi di registrazione|commissioni|tariffa/i.test(message);
  const asksItemPrice = /商品|产品|款号|sku|批发价|这款|这个款|product|item|style|wholesale price|prodotto|articolo/i.test(message);
  if (asksPlatformFees && !asksItemPrice) {
    return {
      reply: isChinese
        ? '我目前没有核实到适用于所有用户的 RUDA 注册费、入驻费或交易佣金统一金额，因此不会猜测“免费”或报一个费率。商品批发价和起订量可在对应商品详情查看；如果你问的是 ModaUI 商家套餐，请登录商家后台查看当前套餐与 Credits 页面。你想了解的是注册/平台费用，还是某件商品的采购价？'
        : isItalian
          ? 'Non ho una tariffa RUDA pubblica verificata e valida per tutti per registrazione, adesione o commissioni; non posso quindi inventare un prezzo o dire che sia gratuito. Prezzo all’ingrosso e quantità minima sono indicati nella scheda del prodotto. Per i piani ModaUI, accedi al portale merchant e consulta la pagina Piano e Credits. Intendi i costi della piattaforma o il prezzo di un prodotto?'
          : 'I do not have a verified public RUDA-wide amount for registration, seller onboarding, or transaction fees, so I will not guess a price or claim it is free. Wholesale prices and minimum quantities appear on each product page. For ModaUI merchant plans, sign in to the merchant portal and check the current Plan and Credits page. Are you asking about platform fees or a specific product?',
      action: asksRegistration ? 'registration' : undefined
    };
  }

  if (asksRegistration) {
    return {
      reply: isChinese
        ? '可以从 RUDA 注册入口开始，并按用途选择企业账户、商家账户或个人零售账户；员工账户需由所属商家管理员创建。企业账户需填写企业资料并完成页面要求的验证/审核。你可以先打开入口，我也可以继续解释每种账户的区别。请不要在聊天里发送密码或验证码。'
        : isItalian
          ? 'Puoi iniziare dalla pagina di registrazione RUDA e scegliere account aziendale, merchant o personale in base alle tue esigenze. Gli account dipendente sono creati dall’amministratore del merchant. Per l’account aziendale servono i dati richiesti e le verifiche indicate nella pagina. Non inviare password o codici in chat.'
          : 'Start from RUDA’s registration page and choose a business, merchant, or personal retail account. Employee accounts must be created by the merchant’s administrator. Business registration requires the information and verification shown on the page. Never send passwords or verification codes in chat.',
      action: 'registration'
    };
  }

  return null;
}

export function getPublicAssistantIntroReply(message: string): string | null {
  const normalized = normalize(message);
  const isChinese = /[\u4e00-\u9fff]/.test(message);
  const isItalian = /\b(?:chi sei|cosa sei|cosa puoi fare|come puoi aiutarmi)\b/i.test(message);
  const asksIdentity = /你是谁|你叫什么|你是(?:谁|什么|哪种|一个|人工智能|AI|机器人)?[?？。!！ ]*$/i.test(message) ||
    /\bwho are you\b|\bwhat are you\b/i.test(normalized);
  const asksCapabilities = /你能(?:帮我)?做什么|你可以(?:帮我)?做什么|你会什么|你能帮什么|你可以帮我|能帮我什么|what can you do|how can you help|cosa puoi fare|come puoi aiutarmi/i.test(message);
  if (!asksIdentity && !asksCapabilities) return null;

  if (isChinese) {
    return asksIdentity
      ? '我是 RUDA Fashion 的 AI 助手，可以帮你查找平台认证商家、公开商品和特价商品，也能回答 RUDA 平台流程及服装批发问题。你可以直接告诉我国家、城市、品类或商家名称。'
      : '我可以按公司名、国家/城市、经营类型和主营资料查找认证商家；查找公开商品和特价区最低价；解释 RUDA 平台流程、服装批发和 B2B 常识，也可以帮你起草商品文案和经营建议。私人订单、客户资料和后台数据需要登录后查看，我不能假装已经替你修改或保存设置。';
  }
  if (isItalian) {
    return asksIdentity
      ? 'Sono l’assistente AI di RUDA Fashion. Posso aiutarti a trovare commercianti verificati e prodotti pubblici e a rispondere a domande sulla piattaforma RUDA e sul commercio B2B della moda.'
      : 'Posso cercare commercianti verificati per nome, paese, città e attività; trovare prodotti pubblici e offerte; spiegare le procedure RUDA e aiutarti a preparare testi e suggerimenti commerciali. Ordini privati, clienti e dati riservati sono accessibili solo dopo l’accesso.';
  }
  return asksIdentity
    ? 'I’m the RUDA Fashion AI assistant. I can help find verified merchants and public products, including sale items, and answer questions about RUDA and fashion B2B.'
    : 'I can find verified merchants by name, location, business type, and specialties; search public products and sale prices; explain confirmed RUDA workflows and general fashion B2B topics; and help draft product copy or business suggestions. Private orders, customer records, and back-office data require an authenticated account.';
}

export function getPublicAssistantSmallTalkReply(message: string): string | null {
  const normalized = normalize(message).replace(/[!?.,，。！、]+$/g, '').trim();
  const isChinese = /[\u4e00-\u9fff]/.test(message);
  const isItalian = /\b(?:ciao|salve|buongiorno|buonasera|buonanotte|grazie|arrivederci|a presto|come stai|posso chiederti|per favore|aiuto)\b/i.test(message);

  if (/^(?:你)?(?:吃了没有|吃了没|吃饭了吗|吃饭了没|吃过饭了吗|吃过了吗|have you eaten|did you eat|hai mangiato)$/.test(normalized)) {
    return isItalian ? 'Non mangio, sono un assistente AI, ma grazie per avermelo chiesto! E tu, come va?'
      : isChinese ? '我不会吃饭，不过谢谢你关心我！你呢，吃过了吗？'
        : 'I don’t eat, since I’m an AI assistant, but thanks for asking! How are you doing?';
  }
  if (/^(?:你多大|你几岁|你年龄多大|你多大了|多大了|how old are you|quanti anni hai)$/.test(normalized)) {
    return isItalian ? 'Non ho un’età reale: sono un assistente AI. Però sono qui volentieri per fare due chiacchiere!'
      : isChinese ? '我没有真实年龄，是一个 AI 助手。不过很乐意陪你聊聊天！'
        : 'I don’t have a real age—I’m an AI assistant. But I’m happy to chat with you!';
  }

  if (/^(?:你好|您好|嗨|哈喽|哈啰|早|早上好|上午好|中午好|下午好|晚上好|在吗|有人吗|ciao|salve|buongiorno|buonasera|hello|hello there|hi|hey|hey there|good morning|good afternoon|good evening)(?:呀|啊|喔|哦|呢)?$/.test(normalized)) {
    if (isChinese) return '你好！我在这里，可以帮你找认证商家、查公开商品和特价，也可以回答 RUDA 平台和服装批发问题。你想先了解什么？';
    if (isItalian) return 'Ciao! Sono qui per aiutarti a trovare commercianti verificati, prodotti pubblici e offerte, oppure a rispondere alle domande su RUDA e sulla moda B2B. Da dove vuoi iniziare?';
    return 'Hello! I can help you find verified merchants, public products and sale offers, or answer questions about RUDA and fashion B2B. What would you like to do?';
  }
  if (/^(?:谢谢|谢谢你|多谢|辛苦了|感谢|thank you|thanks|thanks a lot|thank you so much|thx|grazie|grazie mille)$/.test(normalized)) {
    return isChinese ? '不客气！如果你愿意，可以告诉我想找的商品、商家或平台问题，我继续帮你查。'
      : isItalian ? 'Prego! Dimmi pure se vuoi cercare un prodotto, un commerciante o hai una domanda sulla piattaforma.'
        : 'You’re welcome! Tell me if you’d like to find a product or merchant, or ask about the platform.';
  }
  if (/^(?:再见|拜拜|回头见|下次聊|bye|goodbye|see you|arrivederci|a presto)$/.test(normalized)) {
    return isChinese ? '再见，欢迎随时回来咨询 RUDA 商家、商品或批发采购问题！'
      : isItalian ? 'Arrivederci! Torna quando vuoi per domande su commercianti, prodotti o acquisti B2B RUDA.'
        : 'Goodbye! Come back anytime for help with RUDA merchants, products, or B2B purchasing.';
  }
  if (/^(?:你好吗|最近怎么样|你还好吗|how are you|come stai)$/.test(normalized)) {
    return isChinese ? '谢谢关心，我随时可以帮你查 RUDA 商家和公开商品。你今天想找什么？'
      : isItalian ? 'Grazie, sono pronto ad aiutarti. Che commerciante o prodotto stai cercando?'
        : 'Thanks for asking! I’m ready to help you find RUDA merchants or public products. What are you looking for today?';
  }
  if (/^(?:我想问一下|我可以问你吗|可以问你吗|有个问题|我有问题|帮帮我|需要帮助|我需要帮助|can i ask you something|can i ask you a question|i need help|help me|posso chiederti una cosa|ho bisogno di aiuto)$/.test(normalized)) {
    return isChinese ? '当然可以，请说。你可以问商家怎么找、某类商品哪里有、特价商品价格，或 RUDA 平台怎么使用。'
      : isItalian ? 'Certo, chiedimi pure. Posso aiutarti a trovare commercianti, prodotti e offerte o spiegarti come usare RUDA.'
        : 'Of course—go ahead. You can ask me to find merchants, products or sale prices, or explain how to use RUDA.';
  }
  if (/^(?:好的|好吧|明白了|知道了|ok|okay|got it|va bene|capito)$/.test(normalized)) {
    return isChinese ? '好的！需要查找时，直接告诉我商品品类、商家名称，或国家和城市即可。'
      : isItalian ? 'Perfetto! Quando vuoi, indicami il prodotto, il commerciante oppure paese e città.'
        : 'Great! When you’re ready, tell me a product category, merchant name, or country and city.';
  }
  return null;
}

export function getPublicAssistantFallbackReply(message: string): string {
  const isChinese = /[\u4e00-\u9fff]/.test(message);
  const isItalian = /\b(?:ciao|grazie|negozio|negozi|prodotto|prodotti|commerciante|commercianti|prezzo|aiuto|come|quale|quali)\b/i.test(message);
  if (isChinese) {
    return '没关系，我在这里，可以陪你把问题一步步理清楚。我们可以随便聊聊，也可以从找商家、查公开商品和特价、了解 RUDA 平台流程，或讨论服装批发生意开始。你现在最想聊什么？';
  }
  if (isItalian) {
    return 'Nessun problema, sono qui per aiutarti. Possiamo fare due chiacchiere, cercare commercianti e prodotti pubblici, trovare offerte o chiarire come funziona RUDA. Di cosa vorresti parlare?';
  }
  return 'No worries—I’m here to help. We can chat, look for verified merchants or public products, find sale offers, or talk through how RUDA works and general fashion B2B questions. What’s on your mind?';
}

function normalize(value: string): string {
  return value.normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function retrievePublicSupportKnowledge(question: string): string[] {
  const normalizedQuestion = normalize(question);
  return publicSupportArticles
    .map(article => ({
      article,
      score: article.keywords.reduce((score, keyword) => {
        const normalizedKeyword = normalize(keyword);
        return normalizedQuestion.includes(normalizedKeyword) ? score + normalizedKeyword.length : score;
      }, 0)
    }))
    .filter(result => result.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 4)
    .map(({ article }) => {
      const source = article.source === 'platform_verified' ? 'RUDA 已确认公开平台资料' : '服装/B2B 行业通用参考';
      return `[来源：${source}；标题：${article.title}]\n${article.content}`;
    });
}
