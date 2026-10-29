import React, { useState } from 'react';
import { 
  FileText, 
  Copy, 
  Check, 
  Download, 
  ArrowLeft
} from 'lucide-react';
import { useB2B } from '../../../../context/B2BContext';

export const RequirementDocView: React.FC = () => {
  const { setCurrentView, lang, localizeCopy } = useB2B();
  const isIt = lang === 'it';
  const [copied, setCopied] = useState(false);

  const docMarkdownZh = `
# RUDA 欧洲服装 B2B 全渠道智能供应链业务规范与标准手册

### 一、 项目概述与业务定位
- **项目名称**: RUDA 欧洲现货批发与多仓协同服务
- **业务定位**: 
  打造欧洲领先的意大利服装现货批发 B2B 商城 + 线下自营门店/展厅 + 普拉托立体仓库库存 + 线上线下一体化平台。
  构建以 “快速看款 — 批量矩阵下单 — 展厅实地看样/提货 — 仓库智能配发 — 一键快速补货” 为核心的全自动化快反供应链平台。
- **服务入口**:
  1.   电脑与手机采购商城（零售商端）
  2. 门店与展厅工作台（店员与业务端）
  3. 中央仓储与经营管理中心

### 二、 核心业务流程
1. 看款寻源: 首页按款号快速搜索 -> 分类页多维库存与起订量筛选 -> 商品详情页。
2. 企业准入与分级: 访客查看零售建议价 -> 提交企业税号与资料 -> 后台资质核验 -> 解锁专属批发阶梯价。
3. 矩阵式批量配货: 按颜色与尺码填写数量 -> 自动检查起订量 -> 批量加入采购清单。
4. 线上线下双轨履约: 中央仓库快递出库直发 或 展厅现场验货即提。
5. 全渠道同步库存: 门店销售或线上下单后自动扣减库存，避免超卖。
6. 零售商采购闭环: 一键复购快速复制往期配码，持续补货。
`;

  const docMarkdownIt = `
# Termini e Condizioni Generali di Uso e Vendita

**Ultimo aggiornamento: 21.09.2026**

## Premessa

RUDA ITALIA S.R.L. (di seguito anche "RUDA" o "Piattaforma"), tramite il sito ruda.fashion, fornisce funzionalita del sito, servizi di vendita all'ingrosso, servizi marketplace, logistica e ulteriori servizi connessi.

Utilizzando la Piattaforma, l'utente dichiara di conoscere e accettare i presenti Termini e Condizioni Generali di Uso e Vendita, la Privacy Policy e la Cookie Policy pubblicate sul sito. Qualora non li accetti, e invitato a non utilizzare i servizi.

## 1. Dati del prestatore e destinatari

I servizi sono destinati esclusivamente a operatori economici e persone giuridiche che agiscono per scopi inerenti alla propria attivita imprenditoriale, commerciale, artigianale o professionale.

**Titolare della Piattaforma:** RUDA ITALIA S.R.L.

**Sede operativa:** Via Piemonte 24, 59100 Prato (PO), Italia

**Telefono:** +39 333 252 8756

**E-mail:** rdmodasrl@gmail.com

**Instagram:** rd.ruda

L'utente situato al di fuori dell'Italia deve disporre, ove richiesto, di una partita IVA/VAT valida e attiva nel proprio Paese, ovvero di documenti idonei ad attestare la qualifica di impresa o persona giuridica. L'utente e responsabile della correttezza e dell'aggiornamento dei dati forniti.

## 2. Definizioni

**Utente o Cliente:** la persona giuridica o l'operatore economico registrato che acquista per finalita professionali.

**Servizi:** l'offerta e la vendita dei prodotti, i servizi marketplace, i servizi logistici e di spedizione, il supporto amministrativo e ogni ulteriore servizio disponibile sulla Piattaforma.

**Marketplace:** la sezione attraverso la quale fornitori terzi pubblicano e commercializzano direttamente i propri prodotti nei confronti dei Clienti.

**Fornitore:** il soggetto terzo, persona fisica o giuridica, che vende i propri prodotti tramite il Marketplace.

**Prodotti Marketplace:** i prodotti venduti direttamente dai Fornitori, per i quali RUDA opera come gestore della Piattaforma, prestatore di servizi logistici e soggetto incaricato dell'incasso, senza assumere la qualita di venditore.

**Ordine di Acquisto:** la proposta di acquisto trasmessa telematicamente dal Cliente.

**Conferma d'Ordine:** la comunicazione con cui RUDA informa il Cliente di aver ricevuto l'ordine, senza che cio costituisca ancora accettazione.

**Conferma di Accettazione:** la comunicazione con cui vengono confermati prodotti, quantita, prezzi, spese di spedizione e modalita di pagamento applicabili.

**Giorni lavorativi:** i giorni dal lunedi al venerdi, esclusi i festivi italiani.

Le definizioni, le premesse e le eventuali policy richiamate costituiscono parte integrante dei presenti Termini.

## 3. Condizioni generali d'uso

### 3.1 Accesso e registrazione

Gli utenti non registrati possono consultare esclusivamente le aree pubbliche. Gli utenti registrati possono consultare i cataloghi, visualizzare i prezzi, effettuare acquisti e utilizzare i servizi disponibili, previa verifica dei dati aziendali.

La registrazione richiede dati completi, corretti e veritieri, inclusi denominazione sociale, partita IVA/VAT, referente, indirizzo di fatturazione, indirizzo di consegna ed e-mail. RUDA puo richiedere documenti o chiarimenti supplementari e puo rifiutare o sospendere una registrazione non completa o non verificabile.

### 3.2 Account personale

Le credenziali sono personali e non cedibili. Il Cliente e responsabile della loro custodia e di ogni attivita svolta tramite il proprio account. In caso di perdita, furto o uso non autorizzato, il Cliente deve informare tempestivamente RUDA all'indirizzo rdmodasrl@gmail.com o al numero +39 333 252 8756 e modificare le credenziali.

### 3.3 Uso corretto della Piattaforma

Il Cliente si impegna a utilizzare i Servizi in buona fede, per consultazioni e ordini leciti, senza effettuare ordini falsi o fraudolenti e senza causare interruzioni, danni o malfunzionamenti. RUDA puo sospendere o chiudere l'account in caso di violazione dei presenti Termini o della normativa applicabile.

### 3.4 Proprieta intellettuale

I diritti sui nomi a dominio, marchi, design, testi, immagini, layout, software e contenuti della Piattaforma appartengono a RUDA o ai rispettivi titolari. Non e consentito copiare, estrarre, riutilizzare sistematicamente o impiegare per finalita commerciali i contenuti senza autorizzazione scritta.

## 4. Marketplace e responsabilita dei Fornitori

La Piattaforma puo offrire prodotti venduti direttamente da RUDA e prodotti venduti da Fornitori terzi. Il venditore sara indicato nella scheda di ciascun prodotto.

Per i Prodotti Marketplace, il contratto di vendita si conclude direttamente tra Cliente e Fornitore indicato nella scheda. Il Fornitore resta responsabile della conformita, qualita, sicurezza, composizione, etichettatura, descrizione e legittima commercializzazione dei propri prodotti.

RUDA coordina la piattaforma, la logistica e, ove previsto, l'incasso per conto del Fornitore. Eventuali contestazioni relative al prodotto saranno trasmesse al Fornitore, mentre RUDA prestera assistenza amministrativa e logistica nei limiti dei servizi direttamente prestati.

## 5. Ordini, disponibilita e contratto

La presentazione dei prodotti costituisce un invito a formulare una proposta di acquisto. Il Cliente seleziona gli articoli, le quantita, la consegna e il metodo di pagamento, quindi invia l'ordine tramite il comando previsto dalla Piattaforma.

La Conferma d'Ordine attesta la ricezione e avvia la verifica dei dati e della disponibilita. Il contratto si considera concluso esclusivamente con la Conferma di Accettazione.

Per la natura del pronto moda, la disponibilita puo variare fino al momento dell'accettazione. Se la merce disponibile e inferiore al 75% dei quantitativi ordinati, RUDA puo inviare una comunicazione di disponibilita limitata. Il Cliente potra integrare l'ordine con prodotti alternativi o accettare le quantita disponibili entro il termine indicato nella comunicazione.

Salvo diversa comunicazione, l'annullamento dell'ordine e possibile esclusivamente entro le 2 ore successive all'invio. Decorso tale termine, possono applicarsi costi o penali comunicati nella conferma dell'ordine e consentiti dalla legge.

## 6. Prezzi e pagamenti

I prezzi sono espressi in Euro e si intendono al netto di IVA, imposte, spese di spedizione e altri oneri applicabili, salvo diversa indicazione. Le spese di spedizione sono calcolate in base a colli, peso, destinazione e valore dell'ordine e sono comunicate nella Conferma di Accettazione.

I metodi di pagamento disponibili possono comprendere carta di credito o debito, PayPal, bonifico bancario e wallet. RUDA puo limitare o modificare i metodi disponibili per esigenze operative, di sicurezza o per specifici Clienti.

Per i Prodotti Marketplace, il pagamento effettuato a RUDA quale soggetto incaricato dell'incasso ha effetto liberatorio nei confronti del Fornitore per l'importo corrisposto. La fattura dei prodotti marketplace viene emessa dal Fornitore secondo la normativa applicabile.

## 7. Spedizioni e consegne

RUDA organizza le spedizioni in Europa nei Paesi e territori serviti dalla Piattaforma. Per i prodotti provenienti da piu Fornitori, RUDA puo coordinare il raggruppamento presso il centro logistico e la successiva spedizione al Cliente.

La spedizione viene normalmente effettuata entro 3 giorni lavorativi dalla Conferma di Accettazione per i pagamenti elettronici o dalla ricezione del bonifico. I tempi sono subordinati alla disponibilita dei prodotti e alla consegna tempestiva da parte dei Fornitori.

Le consegne avvengono tramite corriere espresso. Il Cliente deve verificare quantita, integrita e condizioni della merce al momento della consegna e segnalare immediatamente al vettore eventuali anomalie, manomissioni o colli mancanti.

RUDA non risponde dei ritardi dovuti a forza maggiore, scioperi, provvedimenti delle autorita, incendi, alluvioni, calamita naturali, guerre, pandemie o atti di terrorismo, fatto salvo quanto inderogabilmente previsto dalla legge.

## 8. Reclami, resi e rimborsi

Eventuali reclami per non conformita devono essere comunicati entro 8 giorni dal ricevimento della merce, indicando l'ordine e allegando fotografie o altra documentazione utile.

Per i Prodotti Marketplace, la valutazione della non conformita, l'accettazione del reso, l'emissione della nota di credito e ogni responsabilita relativa al prodotto competono al Fornitore venditore. RUDA puo coordinare le comunicazioni e le operazioni logistiche e procedere al rimborso dopo la conferma del Fornitore e l'emissione della documentazione necessaria.

Nei limiti consentiti dalla legge, il Cliente riconosce di agire come operatore economico e non come consumatore. Non si applicano pertanto le disposizioni riservate ai consumatori, salvo i diritti inderogabili previsti dalla normativa applicabile.

## 9. Limitazioni di responsabilita

RUDA risponde esclusivamente dei servizi direttamente prestati dalla Piattaforma, dalla logistica e dall'incasso, nei limiti previsti dalla legge. Per i prodotti marketplace, il Fornitore e l'unico responsabile delle informazioni e degli obblighi connessi alla vendita del prodotto.

Salvo dolo o colpa grave e nei limiti consentiti dalla legge, la responsabilita di RUDA e limitata al danno diretto e prevedibile e comunque al prezzo di acquisto del prodotto o del servizio cui il danno si riferisce. Non sono riconosciuti danni indiretti, perdita di profitto o danni non prevedibili alla conclusione del contratto, nei limiti consentiti dalla legge.

## 10. Privacy, modifiche e legge applicabile

Il trattamento dei dati personali avviene secondo la Privacy Policy e la Cookie Policy pubblicate sulla Piattaforma. RUDA puo modificare i presenti Termini per aggiornare i servizi o conformarsi alla legge; la versione applicabile e quella vigente al momento dell'ordine, salvo disposizioni inderogabili.

I presenti Termini sono regolati dalla legge italiana. La lingua contrattuale e l'italiano. Per le controversie relative ai servizi direttamente prestati da RUDA e competente in via esclusiva il Foro di Prato, salvo diversa competenza inderogabile prevista dalla legge.

## 11. Contatti

Per comunicazioni relative ai presenti Termini, agli ordini o ai servizi:

- RUDA ITALIA S.R.L., Via Piemonte 24, 59100 Prato (PO), Italia
- E-mail: rdmodasrl@gmail.com
- Telefono: +39 333 252 8756
- Instagram: rd.ruda

Utilizzando ruda.fashion o inviando un ordine, il Cliente dichiara di aver letto e accettato i presenti Termini e Condizioni Generali di Uso e Vendita.
`;

  const currentDoc = isIt ? docMarkdownIt : docMarkdownZh;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentDoc);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([currentDoc], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', isIt ? 'RUDA_B2B_Specifiche.md' : 'RUDA_B2B_业务规范手册.md');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-neutral-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCurrentView('catalog')}
            className="p-2 text-neutral-600 hover:text-black hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-black text-white rounded-lg">
              <FileText className="w-4 h-4" />
            </span>
            <div>
              <h1 className="text-sm sm:text-base font-bold text-neutral-900 font-serif">
                {localizeCopy('RUDA 欧洲现货批发与仓储服务指南', 'Termini e Condizioni RUDA')}
              </h1>
              <p className="text-[11px] text-neutral-500">
                {localizeCopy('批发采购与多仓协同说明', 'Condizioni generali di uso e vendita')}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-2 text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-black" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? (localizeCopy('已复制', 'Copiato')) : (localizeCopy('复制文档', 'Copia Documento'))}</span>
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="px-3 py-2 text-xs font-semibold bg-black hover:bg-neutral-800 text-white rounded-xl transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{localizeCopy('下载 Markdown', 'Scarica Markdown')}</span>
          </button>
        </div>
      </div>

      {/* Main Document Content */}
      {isIt ? (
        <article className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-10 shadow-2xs">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-neutral-700">{currentDoc}</pre>
        </article>
      ) : (
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-10 space-y-8 shadow-2xs">
        <div className="border-b border-neutral-200 pb-6">
          <span className="text-[10px] font-mono tracking-widest text-neutral-400 uppercase">
            {localizeCopy('RUDA 运营服务指南 · V3.2', 'GUIDA OPERATIVA · V3.2')}
          </span>
          <h2 className="text-xl sm:text-2xl font-bold font-serif text-neutral-900 mt-2">
            {localizeCopy('欧洲服装现货批发商城 + 自营展厅 + 多仓协同服务', 'Piattaforma Pronto Moda e Magazzini Distribuiti')}
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            {localizeCopy('普拉托中央仓与米兰、威尼斯自营展厅实时同频', 'Sincronizzazione logistica tra Prato, Milano e Mestre')}
          </p>
        </div>

        <div className="space-y-6 text-neutral-800">
          <div className="bg-neutral-50 p-5 rounded-2xl border border-neutral-200">
            <h3 className="text-sm font-bold text-neutral-900 mb-2">
              {localizeCopy('一、项目概述与定位', '1. Posizionamento e Obiettivi')}
            </h3>
            <p className="text-xs leading-relaxed text-neutral-600">
              {localizeCopy('RUDA 提供意大利时尚批发、展厅选款、仓储发货与补货服务。', 'Moda italiana B2B: showroom, ordini, logistica e riassortimento.')}
            </p>
          </div>

          <div className="bg-neutral-50 p-5 rounded-2xl border border-neutral-200">
            <h3 className="text-sm font-bold text-neutral-900 mb-2">
              {localizeCopy('二、多仓协同与库存管理', '2. Gestione dei Magazzini')}
            </h3>
            <ul className="text-xs list-disc pl-5 space-y-1.5 text-neutral-600">
              <li><strong>{localizeCopy('中央立体仓库 (普拉托):', 'Magazzino Centrale (Prato):')}</strong> {localizeCopy('承载大批量全欧物流快递发货。', 'Base di stoccaggio principale per le spedizioni verso tutta Europa.')}</li>
              <li><strong>{localizeCopy('威尼斯展厅 (Mestre):', 'Showroom Mestre (Venezia):')}</strong> {localizeCopy('兼具看样选版与零售商现场自提。', 'Spazio espositivo con formula Click & Collect per il ritiro diretto.')}</li>
              <li><strong>{localizeCopy('米兰展厅 (Milano):', 'Showroom Milano:')}</strong> {localizeCopy('当季高定款式陈列与零售商预约接待。', 'Esposizione campionari e accoglienza rivenditori su appuntamento.')}</li>
              <li><strong>{localizeCopy('库存同步', 'Scorte sincronizzate')}</strong>：{localizeCopy('在线订单与 POS 销售同步更新可用库存。', 'Ordini online e POS aggiornano la disponibilità.')}</li>
            </ul>
          </div>

          <div className="bg-neutral-50 p-5 rounded-2xl border border-neutral-200">
            <h3 className="text-sm font-bold text-neutral-900 mb-3">
              {localizeCopy('三、零售商前台关键模块', '3. Moduli Chiave per i Rivenditori')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-4 bg-white rounded-xl border border-neutral-200">
                <span className="font-bold text-neutral-900 block mb-1">
                  {localizeCopy('按款号快速找货', 'Ricerca Diretta per Codice Modello')}
                </span>
                <span className="text-neutral-500 text-[11px]">
                  {localizeCopy('搜索框置顶，支持款号、SKU、品牌、品类秒查。', 'Ricerca istantanea per Style No, colore e categoria merceologica.')}
                </span>
              </div>
              <div className="p-4 bg-white rounded-xl border border-neutral-200">
                <span className="font-bold text-neutral-900 block mb-1">
                  {localizeCopy('B2B 现货分类大厅', 'Catalogo B2B con Filtri di Giacenza')}
                </span>
                <span className="text-neutral-500 text-[11px]">
                  {localizeCopy('具备库存状态、MOQ 区间与商品状态等专业筛选。', 'Filtri avanzati per disponibilità immediata, MOQ e stato del campionario.')}
                </span>
              </div>
              <div className="p-4 bg-white rounded-xl border border-neutral-200">
                <span className="font-bold text-neutral-900 block mb-1">
                  {localizeCopy('SKU 批量订购矩阵', 'Matrice di Ordine Colore × Taglia')}
                </span>
                <span className="text-neutral-500 text-[11px]">
                  {localizeCopy('Color × Size 二维矩阵表，展示分仓存量并一键配码。', 'Tabella per l\'inserimento rapido delle taglie con verifica MOQ automatica.')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};
