import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowUpRight, CheckCircle2, Globe2, ShieldCheck, Truck } from 'lucide-react';
import { useB2B } from '../../../../context/B2BContext';

type LegalTab = 'privacy' | 'cookies' | 'terms' | 'shipping' | 'returns' | 'contact';

export const AboutView: React.FC = () => {
  const { setCurrentView } = useB2B();
  const [legalTab, setLegalTab] = useState<LegalTab>('privacy');

  useEffect(() => {
    const hash = window.location.hash.replace('#', '').toLowerCase();
    if (['privacy', 'cookies', 'terms', 'shipping', 'returns', 'contact'].includes(hash)) {
      setLegalTab(hash as LegalTab);
    } else if (hash === 'requirements') {
      setLegalTab('terms');
    }
  }, []);

  const legalTabs: Array<{ key: LegalTab; label: string }> = [
    { key: 'privacy', label: 'Informativa sulla privacy' },
    { key: 'cookies', label: 'Cookie policy' },
    { key: 'terms', label: 'Termini e condizioni' },
    { key: 'shipping', label: 'Spedizioni' },
    { key: 'returns', label: 'Resi e rimborsi' },
    { key: 'contact', label: 'Contatti' },
  ];

  return (
    <div className="min-h-screen bg-[#faf9f7] text-neutral-950">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-14">
        <button type="button" onClick={() => setCurrentView('home')} className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-neutral-500 transition-colors hover:text-black">
          <ArrowLeft className="h-4 w-4" /> Torna alla home
        </button>

        <header className="mt-10 border-b border-black pb-10 sm:mt-16">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-neutral-500">RUDA ITALIA S.R.L. / PIATTAFORMA B2B</p>
          <h1 className="mt-4 max-w-3xl font-serif text-5xl font-bold leading-[0.92] tracking-[-0.05em] sm:text-7xl">Moda all’ingrosso, conformità e fiducia.</h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-neutral-600 sm:text-lg">Una piattaforma B2B italiana dedicata a moda pronta, accessori e fornitori verificati, con processi di acquisto trasparenti, gestione conforme e logistica europea.</p>
        </header>

        <section className="grid gap-8 border-b border-black py-10 sm:grid-cols-3 sm:py-14">
          <div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-neutral-500" /><div><h2 className="text-sm font-bold uppercase tracking-[0.1em]">Fornitori verificati</h2><p className="mt-2 text-xs leading-6 text-neutral-600">Partner commerciali, showroom e brand sono sottoposti a verifiche aziendali per una collaborazione più trasparente.</p></div></div>
          <div className="flex gap-3"><Truck className="mt-0.5 h-5 w-5 shrink-0 text-neutral-500" /><div><h2 className="text-sm font-bold uppercase tracking-[0.1em]">Logistica europea</h2><p className="mt-2 text-xs leading-6 text-neutral-600">Servizi di consegna in Italia e nei principali mercati europei, con gestione degli ordini e tracciamento delle spedizioni.</p></div></div>
          <div className="flex gap-3"><Globe2 className="mt-0.5 h-5 w-5 shrink-0 text-neutral-500" /><div><h2 className="text-sm font-bold uppercase tracking-[0.1em]">Acquisto digitale</h2><p className="mt-2 text-xs leading-6 text-neutral-600">Cataloghi, ordini e assistenza sono disponibili online per rendere più efficiente ogni attività di sourcing.</p></div></div>
        </section>

        <main className="space-y-8 py-10 text-sm leading-8 text-neutral-700 sm:py-14">
          <p>RUDA Fashion è una piattaforma professionale per <strong className="font-semibold text-neutral-950">rivenditori, boutique, brand e distributori europei</strong> alla ricerca di moda pronta, abbigliamento e accessori. Il nostro obiettivo è semplificare l’incontro tra domanda retail e fornitori qualificati.</p>
          <p>Gli operatori possono scegliere tra test di assortimento, riassortimenti regolari e acquisti in quantità, con informazioni chiare su disponibilità, condizioni commerciali, consegna e assistenza post-vendita.</p>
          <p>La piattaforma supporta la gestione degli account aziendali, la verifica dei dati societari, i pagamenti tramite provider autorizzati, la gestione degli ordini e il coordinamento con i partner logistici.</p>
          <p>Le informazioni su prodotti, prezzi, disponibilità, spedizioni e resi sono soggette a conferma nell’ordine e nei sistemi ufficiali RUDA.</p>
          <div className="border-y border-neutral-300 py-8"><div className="flex items-start gap-3"><CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-neutral-700" /><div><h2 className="font-serif text-2xl font-bold text-neutral-950">Sourcing professionale per il fashion retail</h2><p className="mt-3">RUDA offre supporto commerciale e operativo per aiutare i clienti a selezionare fornitori, gestire il ritmo degli acquisti e sviluppare collaborazioni B2B in modo conforme e continuativo.</p></div></div></div>
        </main>

        <section id="privacy" className="mt-8 rounded-2xl border border-neutral-300 bg-white p-6 sm:p-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-neutral-500">Legal · GDPR · Corporate Compliance</p>
          <h2 className="mt-4 font-serif text-3xl font-bold text-neutral-950">Informazioni legali e privacy RUDA Fashion</h2>
          <div className="mt-6 flex flex-wrap gap-2">{legalTabs.map(tab => <button key={tab.key} type="button" onClick={() => setLegalTab(tab.key)} className={`cursor-pointer rounded-full px-4 py-2 text-xs font-bold transition-colors ${legalTab === tab.key ? 'bg-black text-white' : 'border border-neutral-300 bg-neutral-50 text-neutral-700 hover:bg-neutral-100'}`}>{tab.label}</button>)}</div>

          <div className="mt-8 space-y-6 text-sm leading-7 text-neutral-700">
            {legalTab === 'privacy' && <>
              <LegalSection title="Impegno per la protezione dei dati">RUDA protegge la privacy e la sicurezza dei dati personali di clienti, fornitori e utenti professionali. I dati vengono raccolti e trattati solo quando necessario, in modo lecito e trasparente, applicando adeguate misure di riservatezza e sicurezza.</LegalSection>
              <LegalSection title="1. Titolare del trattamento">RUDA Fashion opera tramite RUDA ITALIA S.R.L., titolare del trattamento dei dati raccolti attraverso ruda.fashion e la relativa piattaforma B2B. Sede legale: Via Piemonte 24, 59100 Prato, Italia. Partita IVA / numero di registrazione: IT 09482710293. Il trattamento avviene nel rispetto del GDPR, della normativa italiana in materia di privacy e delle altre disposizioni applicabili.</LegalSection>
              <LegalSection title="2. Dati raccolti e modalità di raccolta">Possiamo raccogliere nome, cognome, azienda, ruolo, email, telefono, indirizzi di fatturazione e consegna, partita IVA, dati di fatturazione, storico degli ordini, informazioni sull’account, dati tecnici del dispositivo, indirizzo IP e log di accesso. Per l’accesso tramite Google possiamo ricevere nome, email, immagine del profilo e identificativo univoco necessari all’autenticazione. I dati sono forniti tramite registrazione, moduli, ordini, pagamenti, assistenza, email, telefono e interazioni con la piattaforma.</LegalSection>
              <LegalSection title="3. Finalità e basi giuridiche">Trattiamo i dati per creare e gestire account aziendali, verificare le imprese, eseguire contratti e ordini, organizzare consegne e pagamenti, fornire assistenza, prevenire frodi, gestire contestazioni, adempiere obblighi fiscali e legali, migliorare il servizio e inviare comunicazioni commerciali quando consentito o autorizzato. Le basi giuridiche comprendono esecuzione del contratto, obbligo legale, legittimo interesse e consenso.</LegalSection>
              <LegalSection title="4. Conservazione">Conserviamo i dati solo per il periodo necessario alle finalità indicate e agli obblighi di legge. I dati dei potenziali clienti possono essere conservati fino a 36 mesi; i dati relativi a rapporti contrattuali e fiscali fino a 60 mesi dalla conclusione del rapporto, salvo termini più lunghi richiesti da legge, audit o contenzioso. I dati utilizzati per statistiche vengono anonimizzati quando possibile.</LegalSection>
              <LegalSection title="5. Condivisione e trasferimenti">I dati possono essere condivisi, nei limiti necessari, con team interni, fornitori tecnologici, corrieri, provider di pagamento, consulenti legali e fiscali, servizi di assistenza e autorità competenti. Non vendiamo né cediamo i dati per finalità di marketing non autorizzate. Per trasferimenti fuori dallo Spazio Economico Europeo adottiamo le garanzie previste dalla normativa applicabile.</LegalSection>
              <LegalSection title="6. Pagamenti e sicurezza">I dati completi delle carte vengono trasmessi direttamente a provider di pagamento autorizzati e non sono conservati da RUDA. Applichiamo controllo degli accessi, principio del minimo privilegio, cifratura delle comunicazioni, registrazione degli eventi e verifiche periodiche. Nessun sistema digitale può tuttavia garantire un rischio zero.</LegalSection>
              <LegalSection title="7. Diritti dell’interessato">Puoi richiedere accesso, rettifica, cancellazione, limitazione, opposizione e portabilità dei dati, quando applicabile. Per esercitare i tuoi diritti scrivi a rdmodasrl@gmail.com o a RUDA ITALIA S.R.L., Via Piemonte 24, 59100 Prato, Italia. Potremo richiedere una verifica dell’identità e risponderemo nei termini previsti dalla legge.</LegalSection>
              <LegalSection title="8. Marketing e comunicazioni">Le comunicazioni promozionali vengono inviate solo con consenso o nei casi consentiti dalla legge. È possibile revocare il consenso o opporsi in qualsiasi momento usando il link di disiscrizione, contattando l’assistenza o scrivendo a rdmodasrl@gmail.com.</LegalSection>
              <LegalSection title="9. Modifiche e legge applicabile">Questa informativa può essere aggiornata per riflettere modifiche normative o operative. La versione pubblicata su ruda.fashion è quella vigente. L’informativa è regolata dalla legge italiana e dalla normativa europea applicabile, fatto salvo ogni diritto inderogabile dell’interessato.</LegalSection>
              <LegalNotice>RUDA ITALIA S.R.L. · Via Piemonte 24, 59100 Prato, Italia · E-mail: rdmodasrl@gmail.com · Telefono: +39 333 252 8756 · Aggiornata il 24 settembre 2026</LegalNotice>
            </>}
            {legalTab === 'cookies' && <><LegalSection title="1. Utilizzo dei cookie">Utilizziamo cookie e tecnologie simili per mantenere la sessione, ricordare le preferenze, proteggere l’account, supportare il processo d’ordine e comprendere l’utilizzo della piattaforma.</LegalSection><LegalSection title="2. Categorie">I cookie possono essere necessari, funzionali, analitici o di marketing. I cookie non necessari vengono utilizzati solo quando previsto dalla legge e, ove richiesto, previo consenso.</LegalSection><LegalSection title="3. Gestione">Puoi accettare, rifiutare o cancellare i cookie dalle impostazioni del browser o dagli strumenti di preferenza disponibili sul sito. La disattivazione dei cookie necessari può limitare login, carrello e funzioni dell’account.</LegalSection><LegalSection title="4. Servizi terzi">Provider di analisi, hosting, sicurezza e pagamento possono utilizzare tecnologie proprie secondo le rispettive informative.</LegalSection></>}
            {legalTab === 'terms' && <><LegalSection title="1. Servizio">RUDA offre presentazione di prodotti B2B, verifica aziendale, gestione ordini, coordinamento logistico e assistenza. Prezzi, disponibilità e tempi sono confermati nell’ordine.</LegalSection><LegalSection title="2. Obblighi dell’utente">L’utente deve fornire dati veritieri e avere il potere di rappresentare l’impresa. Sono vietati registrazioni false, frodi, ordini abusivi, violazioni di proprietà intellettuale e utilizzi illeciti.</LegalSection><LegalSection title="3. Ordini e pagamenti">L’ordine diventa efficace dopo la conferma. RUDA può verificare gli ordini, aggiornare la disponibilità o rifiutare transazioni ad alto rischio. I pagamenti sono gestiti tramite canali autorizzati.</LegalSection><LegalSection title="4. Responsabilità">Tempi e disponibilità possono dipendere da fornitori, corrieri, eventi di forza maggiore o servizi terzi. Restano applicabili le responsabilità inderogabili previste dalla legge.</LegalSection></>}
            {legalTab === 'shipping' && <><LegalSection title="1. Destinazioni">Spediamo in Italia e nei principali mercati europei. Destinazioni, costi e tempi sono indicati nella conferma d’ordine.</LegalSection><LegalSection title="2. Tempi di consegna">Dopo la conferma del pagamento e della disponibilità, la preparazione viene normalmente organizzata entro 2-7 giorni lavorativi. Festività, dogana e condizioni del corriere possono incidere sui tempi.</LegalSection><LegalSection title="3. Verifica alla consegna">Il cliente deve controllare imballaggio, quantità e stato della merce e segnalare tempestivamente danni, mancanze o errori, conservando foto e documentazione.</LegalSection></>}
            {legalTab === 'returns' && <><LegalSection title="1. Condizioni">Per difetti, errori di spedizione, mancanze o non conformità, la richiesta deve essere inviata tempestivamente con numero d’ordine, articoli e prove.</LegalSection><LegalSection title="2. Esclusioni">Salvo diritti inderogabili, non sono normalmente accettati resi per preferenze personali, ordine errato, taglia non idonea o merce utilizzata.</LegalSection><LegalSection title="3. Rimborso">Dopo la verifica, il rimborso o la sostituzione viene gestito secondo la legge applicabile e, quando possibile, tramite il metodo di pagamento originario.</LegalSection></>}
            {legalTab === 'contact' && <><LegalSection title="1. Contatti">RUDA ITALIA S.R.L.<br />Via Piemonte 24, 59100 Prato, Italia<br />E-mail: rdmodasrl@gmail.com<br />Telefono: +39 333 252 8756<br />Partita IVA: IT 09482710293</LegalSection><LegalSection title="2. Assistenza">L’assistenza supporta clienti aziendali per ordini, spedizioni, resi, account e richieste relative alla privacy. Indica sempre numero d’ordine e dettagli della richiesta.</LegalSection></>}
            {legalTab !== 'privacy' && <LegalNotice>RUDA ITALIA S.R.L. · Via Piemonte 24, 59100 Prato, Italia · rdmodasrl@gmail.com · +39 333 252 8756</LegalNotice>}
          </div>
        </section>

        <div className="flex flex-wrap gap-3 border-t border-black pt-8"><button type="button" onClick={() => setCurrentView('catalog')} className="inline-flex cursor-pointer items-center gap-2 bg-black px-5 py-3 text-xs font-bold text-white transition-colors hover:bg-neutral-800">Sfoglia il catalogo <ArrowUpRight className="h-4 w-4" /></button><button type="button" onClick={() => setCurrentView('register_wholesale')} className="inline-flex cursor-pointer items-center gap-2 border border-black px-5 py-3 text-xs font-bold text-black transition-colors hover:bg-black hover:text-white">Richiedi l’accesso B2B <ArrowUpRight className="h-4 w-4" /></button></div>
      </div>
    </div>
  );
};

const LegalSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => <div><h3 className="text-base font-bold text-neutral-900">{title}</h3><p>{children}</p></div>;
const LegalNotice: React.FC<{ children: React.ReactNode }> = ({ children }) => <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-xs text-neutral-600"><strong className="text-neutral-900">Informazioni societarie:</strong> {children}</div>;
