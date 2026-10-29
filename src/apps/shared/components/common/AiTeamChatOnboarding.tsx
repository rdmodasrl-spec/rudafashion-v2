import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useB2B } from '../../../../context/B2BContext';
import { ArrowLeft, Bot, Send, Sparkles, CheckCircle2 } from 'lucide-react';
import { apiGet, apiPost } from '../../../../api/client';
import { hasSensitiveOnboardingInformation } from '../../../../utils/sensitiveOnboardingInfo';
import {
  BUSINESS_TYPES,
  OPERATING_MODES,
  buildRoster,
  buildModules,
  type BusinessType,
} from '../../../../config/businessTeams';

/**
 * AI 店长对话式入驻预览。
 *
 * 服务端以结构化 AI 分类识别行业；团队与后台模块仍为预览。
 *
 * 重要：只有当匹配到的行业全部是目前平台已真实支持的行业（服装批发/设计制造/皮具/百货/零售）时，
 * 才会出现"提交入驻申请"这个真实可用的按钮，跳转到 MerchantOnboarding.tsx 的真实申请流程。
 * 其余行业只显示"开发中"提示，绝不做假按钮。
 */

type Step = 'business_type' | 'operating_mode' | 'city' | 'reveal';

interface ChatMessage {
  id: string;
  from: 'ai' | 'user';
  text: string;
}

let msgSeq = 0;
const nextId = () => `m${++msgSeq}`;

export const AiTeamChatOnboarding: React.FC = () => {
  const { setCurrentView } = useB2B();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: nextId(), from: 'ai', text: '你好老板 👋 我是你的 AI 店长候选人。' },
    { id: nextId(), from: 'ai', text: '先聊聊你的生意——可以直接描述经营行业，也可以点下面的快捷选项。' },
  ]);
  const [step, setStep] = useState<Step>('business_type');
  const [selectedTypes, setSelectedTypes] = useState<BusinessType[]>([]);
  const [operatingMode, setOperatingMode] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [classifying, setClassifying] = useState(false);
  const [aiDisclosure, setAiDisclosure] = useState<{
    provider: 'local' | 'deepseek';
    cloudConsentRequired: boolean;
    cloudProviderName: string | null;
  } | null>(null);
  const [cloudConsent, setCloudConsent] = useState(false);
  const [disclosureError, setDisclosureError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    void apiGet<{
      provider: 'local' | 'deepseek';
      cloudConsentRequired: boolean;
      cloudProviderName: string | null;
    }>('/api/onboarding/merchant/ai-disclosure')
      .then(result => {
        if (active) {
          setAiDisclosure(result);
          setDisclosureError('');
        }
      })
      .catch(() => {
        if (active) setDisclosureError('暂时无法确认 AI 处理方式；为保护你的信息，文本识别已暂停。你仍可点选行业继续。');
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const pushAi = (text: string) => setMessages((m) => [...m, { id: nextId(), from: 'ai', text }]);
  const pushUser = (text: string) => setMessages((m) => [...m, { id: nextId(), from: 'user', text }]);

  const allSupported = selectedTypes.length > 0 && selectedTypes.every((t) => t.supported);
  const anySupported = selectedTypes.some((t) => t.supported);

  const continueToOnboarding = () => {
    setCurrentView('register_wholesale');
  };

  const handleBusinessTypeChoice = (types: BusinessType[]) => {
    if (types.length === 0) {
      pushAi('嗯…我没能识别出具体的生意类型，能换个说法再描述一下吗？比如"我们做服装批发"或"我开了一家皮具店"。');
      return;
    }
    setSelectedTypes(types);
    pushUser(types.map((t) => t.label).join('、'));
    const supportedNames = types.filter((t) => t.supported).map((t) => t.label);
    const unsupportedNames = types.filter((t) => !t.supported).map((t) => t.label);
    if (supportedNames.length) {
      pushAi(`收到！${supportedNames.join('、')}——这些行业已有真实入驻流程，我会为你展示团队配置预览。`);
    }
    if (unsupportedNames.length) {
      pushAi(`${unsupportedNames.join('、')} 这块我们还在开发中，暂时不能提交真实入驻申请，但可以先给你看看未来的 AI 团队会长什么样。`);
    }
    pushAi('接下来说说你的经营模式：');
    setStep('operating_mode');
  };

  const handleFreeTextSubmit = async () => {
    const text = inputValue.trim();
    if (!text || classifying) return;
    setInputValue('');
    if (step === 'business_type') {
      if (!aiDisclosure) return;
      if (hasSensitiveOnboardingInformation(text)) {
        pushAi('为保护你的隐私，这段描述包含看起来像邮箱、电话、税号、银行卡或凭证的信息，未发送给 AI。请删掉相关内容后再试；请勿输入姓名、地址、证件或任何个人及财务资料。');
        return;
      }
      if (aiDisclosure.cloudConsentRequired && !cloudConsent) {
        pushAi(`请先阅读并勾选下方说明，明确同意将这段行业描述发送给 ${aiDisclosure.cloudProviderName} 后，才能继续识别。`);
        return;
      }
      pushUser(text);
      setClassifying(true);
      try {
        const result = await apiPost<{ businessTypeIds: string[] }>(
          '/api/onboarding/merchant/classify-business',
          { message: text, cloudConsent },
          30_000
        );
        const matched = result.businessTypeIds
          .map(id => BUSINESS_TYPES.find(type => type.id === id))
          .filter((type): type is BusinessType => Boolean(type));
        handleBusinessTypeChoiceFromText(matched);
      } catch (error) {
        if (error instanceof Error && error.message === 'ONBOARDING_AI_CLOUD_CONSENT_REQUIRED') {
          setCloudConsent(false);
          try {
            setAiDisclosure(await apiGet('/api/onboarding/merchant/ai-disclosure'));
          } catch {
            setDisclosureError('AI 服务配置刚刚发生变化，无法确认新的处理方式。请稍后重试，或点选行业继续。');
          }
          pushAi('AI 服务配置已变化；为保护你的信息，本次识别没有提交。请重新阅读最新说明并选择是否同意。');
        } else if (error instanceof Error && error.message === 'ONBOARDING_AI_SENSITIVE_INFORMATION') {
          pushAi('检测到可能的个人或敏感信息，本次识别已阻止且未发送给 AI。请删除相关内容后重试；姓名、地址和证件等也请勿填写。');
        } else {
          pushAi('行业识别未能完成。请稍后重试；如只想继续流程，也可以点选下方行业。');
        }
      } finally {
        setClassifying(false);
        setCloudConsent(false);
      }
    } else if (step === 'city') {
      pushUser(text);
      setCity(text);
      pushAi(`好的，${text}——记下了。`);
      setStep('reveal');
    }
  };

  // Slight variant used for free-text path so we don't push the user's raw quick-reply label twice.
  const handleBusinessTypeChoiceFromText = (types: BusinessType[]) => {
    if (types.length === 0) {
      pushAi('嗯…我没能识别出具体的生意类型，能换个说法再描述一下吗？比如"我们做服装批发"或"我开了一家皮具店"。');
      return;
    }
    setSelectedTypes(types);
    const supportedNames = types.filter((t) => t.supported).map((t) => t.label);
    const unsupportedNames = types.filter((t) => !t.supported).map((t) => t.label);
    if (supportedNames.length) {
      pushAi(`收到！${supportedNames.join('、')}——这些行业已有真实入驻流程，我会为你展示团队配置预览。`);
    }
    if (unsupportedNames.length) {
      pushAi(`${unsupportedNames.join('、')} 这块我们还在开发中，暂时不能提交真实入驻申请，但可以先给你看看未来的 AI 团队会长什么样。`);
    }
    pushAi('接下来说说你的经营模式：');
    setStep('operating_mode');
  };

  const handleOperatingModeChoice = (id: string, label: string) => {
    setOperatingMode(id);
    pushUser(label);
    pushAi('明白。最后一个问题——你的店/生意主要在哪个城市？');
    setStep('city');
  };

  const roster = useMemo(() => buildRoster(selectedTypes), [selectedTypes]);
  const modules = useMemo(() => buildModules(selectedTypes), [selectedTypes]);

  useEffect(() => {
    if (step === 'reveal') {
      const timer = setTimeout(() => {
        pushAi('好了，让我为你组建 AI 团队 🎬');
      }, 300);
      return () => clearTimeout(timer);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 text-white flex flex-col">
      <header className="flex items-center gap-3 px-4 py-4 border-b border-white/10">
        <button
          onClick={() => setCurrentView('home')}
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
          aria-label="返回"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold">AI 店长 · 对话式入驻</div>
            <div className="text-[11px] text-white/50">AI 行业识别 · 团队与后台为预览</div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Chat column */}
        <div className="flex-1 flex flex-col min-h-0">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-4 max-w-2xl mx-auto w-full">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    m.from === 'user'
                      ? 'bg-amber-500 text-neutral-900 font-medium rounded-br-sm'
                      : 'bg-white/10 text-white rounded-bl-sm'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}

            {step === 'business_type' && (
              <div className="flex flex-wrap gap-2 pt-2">
                {BUSINESS_TYPES.map((bt) => (
                  <button
                    key={bt.id}
                    disabled={classifying}
                    onClick={() => handleBusinessTypeChoice([bt])}
                    className="px-3.5 py-2 rounded-full bg-white/10 hover:bg-white/20 text-sm transition-colors border border-white/10"
                  >
                    {bt.label}
                  </button>
                ))}
              </div>
            )}

            {step === 'operating_mode' && (
              <div className="flex flex-col gap-2 pt-2">
                {OPERATING_MODES.map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => handleOperatingModeChoice(mode.id, mode.label)}
                    className="text-left px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors border border-white/10"
                  >
                    <div className="text-sm font-semibold">{mode.label}</div>
                    <div className="text-xs text-white/50">{mode.desc}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {(step === 'business_type' || step === 'city') && (
            <div className="px-4 py-4 border-t border-white/10">
              <div className="max-w-2xl mx-auto flex items-center gap-2">
                {step === 'business_type' && (
                  <div className="max-w-2xl mx-auto mb-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[11px] leading-5 text-white/70">
                    <p>
                      仅用于识别经营行业并生成团队/后台配置预览。请勿输入姓名、联系方式、地址、证件、税号、银行资料、买家信息、密码或其他个人/敏感信息。RUDA 不会将此描述保存到入驻申请或应用日志；若使用云端模型，模型服务商对请求数据的处理与保留受其自身政策约束。
                      {aiDisclosure?.provider === 'local' ? ' 当前使用 RUDA 服务器上的本地模型。' : ''}
                      {aiDisclosure?.cloudConsentRequired ? ` 当前识别使用 ${aiDisclosure.cloudProviderName} 云端模型${aiDisclosure.provider === 'deepseek' ? '；只有你单独勾选同意后，本次描述才会发送给该服务商' : ''}。` : ''}
                    </p>
                    {aiDisclosure?.cloudConsentRequired && (
                      <label className="mt-2 flex cursor-pointer items-start gap-2 text-white">
                        <input
                          type="checkbox"
                          checked={cloudConsent}
                          disabled={classifying}
                          onChange={event => setCloudConsent(event.target.checked)}
                          className="mt-1 accent-amber-400"
                        />
                        <span>我已阅读说明，并同意将本次行业描述发送给 {aiDisclosure.cloudProviderName} 进行行业识别。此同意仅适用于下一次识别请求。</span>
                      </label>
                    )}
                    {disclosureError && <p role="alert" className="mt-2 text-amber-200">{disclosureError}</p>}
                  </div>
                )}
              </div>
              <div className="max-w-2xl mx-auto flex items-center gap-2">
                <input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void handleFreeTextSubmit()}
                  disabled={classifying || (step === 'business_type' && !aiDisclosure)}
                  maxLength={500}
                  placeholder={step === 'business_type' ? '比如：我们做服装批发，也卖一点皮具…' : '比如：米兰 / Milano'}
                  className="flex-1 bg-white/10 border border-white/10 rounded-full px-4 py-2.5 text-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
                />
                <button
                  onClick={() => void handleFreeTextSubmit()}
                  disabled={classifying || (step === 'business_type' && (!aiDisclosure || Boolean(disclosureError)))}
                  className="p-2.5 rounded-full bg-amber-500 hover:bg-amber-400 text-neutral-900 transition-colors"
                  aria-label="发送"
                >
                  {classifying ? <Sparkles className="w-4 h-4 animate-pulse" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Team/back-office preview column */}
        {selectedTypes.length > 0 && (
          <div className="w-full md:w-[380px] border-t md:border-t-0 md:border-l border-white/10 bg-black/20 px-5 py-6 overflow-y-auto">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold">AI 团队配置预览</h3>
            </div>
            <div className="space-y-2.5 mb-6">
              {roster.map((role) => {
                const Icon = role.icon;
                return (
                  <div key={role.name} className="flex items-start gap-3 bg-white/5 rounded-xl px-3 py-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-amber-300" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold">{role.name}</div>
                      <div className="text-[11px] text-white/50">{role.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {modules.length > 0 && (
              <>
                <h3 className="text-sm font-bold mb-3">后台模块预览</h3>
                <div className="flex flex-wrap gap-2 mb-6">
                  {modules.map((m) => (
                    <span key={m.key} className="text-[11px] px-2.5 py-1 rounded-full bg-white/10 border border-white/10">
                      {m.label}
                    </span>
                  ))}
                </div>
              </>
            )}

            {step === 'reveal' && (
              <div className="pt-2 border-t border-white/10 mt-2">
                {allSupported ? (
                  <>
                    <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold mb-3">
                      <CheckCircle2 className="w-4 h-4" />
                      这些行业已可真实入驻
                    </div>
                    <button
                      onClick={continueToOnboarding}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-neutral-900 font-bold text-sm hover:opacity-90 transition-opacity"
                    >
                      🚀 提交真实入驻申请
                    </button>
                  </>
                ) : anySupported ? (
                  <>
                    <p className="text-[11px] text-white/50 mb-3">
                      你选择的部分行业已支持真实入驻，其余仍在开发中——可以先用已支持的部分提交申请。
                    </p>
                    <button
                      onClick={continueToOnboarding}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-neutral-900 font-bold text-sm hover:opacity-90 transition-opacity"
                    >
                      🚀 用已支持的行业提交申请
                    </button>
                  </>
                ) : (
                  <p className="text-[11px] text-white/50">
                    这个行业方向还在开发中，暂时无法提交真实入驻申请——先记下你的需求，我们做好了第一时间通知你。
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AiTeamChatOnboarding;
