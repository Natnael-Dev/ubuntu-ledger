// Pure Domain Content & Localization Catalog
// Authoritative sources: docs/specs/06-voice-and-ussd.md §4, §5, §11 (CH-01, CH-02, CH-06, CH-08),
// docs/specs/16-i18n-and-content.md §1, §2, §4, §5

export type Locale = 'en' | 'am' | 'om' | 'sw';

export type SlotValues = Record<string, string | number | boolean | null | undefined>;

export interface ProvenanceParams {
  count: number;
  weekday: string;
  yesCount: number;
  noCount: number;
  ago: string;
}

// Banned lexicon list per 07 §6.5 & 16 §7 (CH-08)
export const BANNED_TERMS = [
  'corrupt',
  'bribe',
  'theft',
  'stole',
  'fraud',
  'criminal',
  'illegal',
] as const;

/**
 * Validates that text does not contain any terms from the banned lexicon (CH-08).
 */
export function assertNoBannedWords(text: string): void {
  const lower = text.toLowerCase();
  for (const term of BANNED_TERMS) {
    if (lower.includes(term)) {
      throw new Error(`Content integrity violation: text contains banned term '${term}'`);
    }
  }

  // Collapsed Latin projection check (catches delimiter insertions like c.o.r.r.u.p.t, b_r_i_b_e)
  // SAFETY: Ethiopic fidel characters (U+1200-U+137F) do NOT match [a-z] and become empty string,
  // preventing false positives on legitimate Ethiopian text.
  const collapsedLatin = lower.replace(/[^a-z]/g, '');
  const projectedWithL = collapsedLatin.replace(/i/g, 'l');
  for (const term of BANNED_TERMS) {
    if (collapsedLatin.includes(term) || projectedWithL.includes(term)) {
      throw new Error(`Content integrity violation: text contains obfuscated banned term '${term}'`);
    }
  }
}

/**
 * Message catalog defining all canonical strings across en, am, om.
 * Every key present in 'en' must exist in 'am' and 'om' (CH-01).
 * Every string is authored to ensure final renders are <= 182 characters (CH-02).
 * No hardcoded amounts, dates or dynamic figures (CH-06).
 */
export const MESSAGES: Record<Locale, Record<string, string>> = {
  en: {
    // Root Menu
    'menu.root': '1 Check a project\n2 Service fees\n3 Report a fault\n4 Language',
    'prompt.enter_project_code': 'Enter the 4-digit project code from the board:',

    // Receipt Summary & Submenu
    'receipt.summary': '{title}. {currency} {amount}. Contractor {contractor}. Due {due}.',
    'receipt.unofficial': '{title}. {currency} {amount}. NO SOURCE DOCUMENT — this figure is an estimate.',
    'receipt.menu': '1 Answer check task\n2 Hear this again\n3 Who checked this?\n0 Back',

    // Asset Question Templates
    'q.borehole.head_fitted': 'Is a handpump head fitted to the borehole?\n1 Yes 2 No',
    'q.borehole.water_flows': 'Pump the handle for 30 seconds — does water come out?\n1 Yes 2 No',
    'q.borehole.board_posted': 'Is a project board with a contract number posted?\n1 Yes 2 No',

    'q.generator.runs_on_outage': 'When mains power stops, does the generator run?\n1 Yes 2 No',
    'q.generator.fridge_green': 'Does the vaccine fridge show a green light?\n1 Yes 2 No',
    'q.generator.board_posted': 'Is a project board with a contract number posted?\n1 Yes 2 No',

    'q.latrine.doors_fitted': 'Are all doors fitted and closing?\n1 Yes 2 No',
    'q.latrine.water_present': 'Is there water at the handwashing point?\n1 Yes 2 No',
    'q.latrine.board_posted': 'Is a project board with a contract number posted?\n1 Yes 2 No',

    // Observation Confirmations
    'observation.counted': 'Thank you. {count} of {target} neighbours have checked.',
    'observation.duplicate': 'Thank you. This area has already been counted, so the total stays at {count}.',

    // Narrative States
    'narrative.under_probation_n_days': 'Repair claimed. Under 7-day check. {days} days left before it can be closed.',
    'narrative.reports_disagree': 'Reports disagree. A moderator is reviewing. Do not treat this as settled.',
    'narrative.repair_failed_durability': 'Repair did not last 7 days. Contract {code}. Ask at the ward meeting.',
    'narrative.awaiting_reports_n_of_3': '{count} of {target} neighbours have checked so far.',
    'narrative.no_source_document': 'No source document found for this figure.',

    // Provenance Sentence (Trust UI)
    'provenance.sentence': '{count} neighbours checked this on {weekday}. {yes} said yes, {no} said no. Last checked {ago}.',

    // Service Fees Branch
    'services.menu': '1 ID replacement\n2 Clinic intake\n0 Back',
    'statutory.card': 'Official fee {currency} {fee}. Bring: {documents}. Expected visits: {visits}.',
    'statutory.menu': '1 What do I say if asked for more?\n2 What do others report?\n3 I have already visited\n0 Back',
    'script.request_official_receipt': '{source} states the fee is {currency} {fee}. May I have an official receipt for any additional amount?',

    // Divergence Summaries
    'divergence.summary': 'In the last 30 days, {pct}% of {n} reports said more than the official fee was requested. Median extra: {currency} {median}.',
    'divergence.not_enough_reports': 'Not enough reports yet to show a pattern. Your report was recorded.',

    // Report Fault Branch
    'prompt.enter_asset_code': 'Enter the asset code from the board:',
    'fault.menu': '1 It is not working\n2 It is working now\n0 Back',
    'fault.recorded': 'Fault report recorded. Thank you.',

    // Language Selection Branch
    'language.menu': '1 English\n2 አማርኛ\n3 Afaan Oromoo\n0 Back',
    'language.selected': 'Language updated.',

    // Outcome Menu
    'outcome.menu': '1 Paid official fee\n2 Asked for more\n3 No receipt given\n4 Extra document asked\n5 Office closed\n0 Back',
    'outcome.recorded': 'Recorded. Thank you.',

    // Errors & Inline Hints
    'error.code_not_found': 'Code not recognised. Codes are printed on the project board.',
    'error.task_closed': 'This check has closed. Dial 1 for another project.',
    'hint.invalid_input': 'Invalid entry. ',
  },

  am: {
    // Root Menu
    'menu.root': '1 ፕሮጀክት ይፈትሹ\n2 የአገልግሎት ክፍያዎች\n3 ብልሽት ያሳውቁ\n4 ቋንቋ',
    'prompt.enter_project_code': 'ከቦርዱ ላይ የ4-አሃዝ የፕሮጀክት ኮድ ያስገቡ:',

    // Receipt Summary & Submenu
    'receipt.summary': '{title}። {currency} {amount}። ተቋራጭ {contractor}። ማጠናቀቂያ {due}።',
    'receipt.unofficial': '{title}። {currency} {amount}። ሰነድ አልተገኘም — ግምት ነው።',
    'receipt.menu': '1 የፍተሻ ጥያቄዎችን ይመልሱ\n2 በድጋሚ ያዳምጡ\n3 ማን ፈተሸው?\n0 ተመለስ',

    // Asset Question Templates
    'q.borehole.head_fitted': 'የእጅ ፓምፕ በቦረቦሩ ላይ ተገጥሟል?\n1 አዎ 2 አይደለም',
    'q.borehole.water_flows': 'እጀታውን ለ30 ሰከንድ ይጫኑ — ውሃ ይወጣል?\n1 አዎ 2 አይደለም',
    'q.borehole.board_posted': 'የኮንትራት ቁጥር የያዘ የፕሮጀክት ሰሌዳ ተለጥፏል?\n1 አዎ 2 አይደለም',

    'q.generator.runs_on_outage': 'የዋናው መስመር ኃይል ሲቋረጥ ጄነሬተሩ ይሰራል?\n1 አዎ 2 አይደለም',
    'q.generator.fridge_green': 'የክትባት ማቀዝቀዣው አረንጓዴ መብራት ያሳያል?\n1 አዎ 2 አይደለም',
    'q.generator.board_posted': 'የኮንትራት ቁጥር የያዘ የፕሮጀክት ሰሌዳ ተለጥፏል?\n1 አዎ 2 አይደለም',

    'q.latrine.doors_fitted': 'ሁሉም በሮች ተገጥመው ይዘጋሉ?\n1 አዎ 2 አይደለም',
    'q.latrine.water_present': 'በእጅ መታጠቢያ ቦታ ላይ ውሃ አለ?\n1 አዎ 2 አይደለም',
    'q.latrine.board_posted': 'የኮንትራት ቁጥር የያዘ የፕሮጀክት ሰሌዳ ተለጥፏል?\n1 አዎ 2 አይደለም',

    // Observation Confirmations
    'observation.counted': 'እናመሰግናለን። ከ{target} ጎረቤቶች {count} ፈትሸዋል።',
    'observation.duplicate': 'እናመሰግናለን። ይህ አካባቢ አስቀድሞ ተቆጥሯል፣ ጠቅላላው በ{count} ይቆያል።',

    // Narrative States
    'narrative.under_probation_n_days': 'ጥገና ተጠናቋል ተብሏል። በ7-ቀን ፍተሻ ላይ። ሊዘጋ {days} ቀናት ቀርተዋል።',
    'narrative.reports_disagree': 'ሪፖርቶች አይስማሙም። አወያይ እየገመገመው ነው።',
    'narrative.repair_failed_durability': 'ጥገናው ለ7 ቀናት አልዘለቀም። ውል {code}። በወረዳ ስብሰባ ይጠይቁ።',
    'narrative.awaiting_reports_n_of_3': 'እስካሁን ከ{target} ጎረቤቶች {count} ፈትሸዋል።',
    'narrative.no_source_document': 'ለዚህ አሃዝ ምንም ይፋዊ ሰነድ አልተገኘም።',

    // Provenance Sentence
    'provenance.sentence': '{count} ጎረቤቶች በ{weekday} ፈትሸውታል። {yes} አዎ አሉ፣ {no} አይደለም አሉ። የመጨረሻው ፍተሻ ከ{ago} በፊት።',

    // Service Fees Branch
    'services.menu': '1 የታደሰ መታወቂያ\n2 ክሊኒክ ምዝገባ\n0 ተመለስ',
    'statutory.card': 'ይፋዊ ክፍያ {currency} {fee}። የሚያስፈልጉ፡ {documents}። የሚጠበቁ ጉብኝቶች፡ {visits}።',
    'statutory.menu': '1 ተጨማሪ ከተጠየቅኩ ምን ልበል?\n2 ሌሎች ምን ሪፖርት አደረጉ?\n3 አስቀድሜ ጎብኝቻለሁ\n0 ተመለስ',
    'script.request_official_receipt': '{source} ክፍያው {currency} {fee} መሆኑን ይገልጻል። ለተጨማሪ ክፍያ ህጋዊ ደረሰኝ ማግኘት እችላለሁ?',

    // Divergence Summaries
    'divergence.summary': 'ባለፉት 30 ቀናት ውስጥ ከ{n} ሪፖርቶች {pct}% ከይፋዊው ክፍያ በላይ እንደተጠየቁ ገልጸዋል። አማካይ ጭማሪ፡ {currency} {median}።',
    'divergence.not_enough_reports': 'አዝማሚያ ለማሳየት እስካሁን በቂ ሪፖርቶች የሉም። ሪፖርትዎ ተመዝግቧል።',

    // Report Fault Branch
    'prompt.enter_asset_code': 'ከቦርዱ ላይ የንብረት ኮዱን ያስገቡ:',
    'fault.menu': '1 አይሰራም\n2 አሁን እየሰራ ነው\n0 ተመለስ',
    'fault.recorded': 'የብልሽት ሪፖርት ተመዝግቧል። እናመሰግናለን።',

    // Language Selection Branch
    'language.menu': '1 English\n2 አማርኛ\n3 Afaan Oromoo\n0 ተመለስ',
    'language.selected': 'ቋንቋ ተቀይሯል።',

    // Outcome Menu
    'outcome.menu': '1 ይፋዊ ክፍያ ከፍያለሁ\n2 ተጨማሪ ተጠይቄያለሁ\n3 ደረሰኝ አልተሰጠም\n4 ተጨማሪ ሰነድ ተጠይቄያለሁ\n5 ቢሮው ተዘግቷል\n0 ተመለስ',
    'outcome.recorded': 'ተመዝግቧል። እናመሰግናለን።',

    // Errors & Inline Hints
    'error.code_not_found': 'ኮዱ አልታወቀም። ኮዶች በፕሮጀክት ሰሌዳው ላይ ታትመዋል።',
    'error.task_closed': 'ይህ ፍተሻ ተዘግቷል። ለሌላ ፕሮጀክት 1 ይጫኑ።',
    'hint.invalid_input': 'ልክ ያልሆነ ግቤት። ',
  },

  om: {
    // Root Menu
    'menu.root': "1 Pirojektii sakatta'aa\n2 Kaffaltii tajaajilaa\n3 Hanqina gabaasaa\n4 Afaan",
    'prompt.enter_project_code': 'Gabatee irraa koodii pirojektii dijitii 4 galchaa:',

    // Receipt Summary & Submenu
    'receipt.summary': '{title}. {currency} {amount}. Kontraaktara {contractor}. Xumura {due}.',
    'receipt.unofficial': '{title}. {currency} {amount}. Sanadni hin jiru — tilmaama qofa.',
    'receipt.menu': "1 Gaaffii deebisaa\n2 Ammas dhaga'aa\n3 Eenyutu sakatta'e?\n0 Duubatti",

    // Asset Question Templates
    'q.borehole.head_fitted': "Mataani paampii boolla irratti hidhameeraa?\n1 Eeyyee 2 Lakki",
    'q.borehole.water_flows': "Harka sekondii 30 dhiibaa — bishaan ni bahaa?\n1 Eeyyee 2 Lakki",
    'q.borehole.board_posted': "Gabateen lakkoofsa waliigaltee qabu maxxanfameeraa?\n1 Eeyyee 2 Lakki",

    'q.generator.runs_on_outage': "Humni yoo cite jeneretarri ni hojjetaa?\n1 Eeyyee 2 Lakki",
    'q.generator.fridge_green': "Firiijiin ifaa magariisa ni agarsiisaa?\n1 Eeyyee 2 Lakki",
    'q.generator.board_posted': "Gabateen lakkoofsa waliigaltee qabu maxxanfameeraa?\n1 Eeyyee 2 Lakki",

    'q.latrine.doors_fitted': "Balbaloonni hundi ni cufamuu?\n1 Eeyyee 2 Lakki",
    'q.latrine.water_present': "Bakka dhiqannaa harkaatti bishaan jiraa?\n1 Eeyyee 2 Lakki",
    'q.latrine.board_posted': "Gabateen lakkoofsa waliigaltee qabu maxxanfameeraa?\n1 Eeyyee 2 Lakki",

    // Observation Confirmations
    'observation.counted': "Galatoomaa. Ollaa {target} keessaa {count} sakatta'aniiru.",
    'observation.duplicate': "Galatoomaa. Naannoon kun duraan lakkaa'ameera, dimshaashni {count} ta'ee tura.",

    // Narrative States
    'narrative.under_probation_n_days': 'Suphaan dhiyaateera. Sakatta\'iinsa guyyaa 7 keessa. Guyyoota {days} hafe.',
    'narrative.reports_disagree': 'Gabaasonni wal-hin simne. Ilaalamaa jira.',
    'narrative.repair_failed_durability': 'Suphaan guyyaa 7 hin turre. Waliigaltee {code}. Yaa\'ii aanaatti gaafadhaa.',
    'narrative.awaiting_reports_n_of_3': "Hamma ammaatti ollaa {target} keessaa {count} sakatta'aniiru.",
    'narrative.no_source_document': 'Lakkoofsa kanaaf sanadni seeraa hin argamne.',

    // Provenance Sentence
    'provenance.sentence': "{count} ollaan {weekday} sakatta'an. {yes} eeyyee jedhan, {no} lakki jedhan. Sakatta'iinsi dhihoo dura {ago}.",

    // Service Fees Branch
    'services.menu': '1 Bakka bu\'iinsa waraqaa\n2 Yaala kiliniikaa\n0 Duubatti',
    'statutory.card': 'Kaffaltii seeraa {currency} {fee}. Sanadoota: {documents}. Daawwannaa: {visits}.',
    'statutory.menu': "1 Kaffaltii dabalataa yoo gaafatame?\n2 Warri kaan maal gabaasan?\n3 Duraan daawwadheera\n0 Duubatti",
    'script.request_official_receipt': '{source} kaffaltiin {currency} {fee} ta\'uu ibsa. Kaffaltii dabalataaf nagahee seeraa argachuu danda\'aa?',

    // Divergence Summaries
    'divergence.summary': 'Guyyoota 30 keessatti gabaasa {n} keessaa %{pct} kaffaltii seeraa ol gaafatamu gabaasan. Garaagarummaa: {currency} {median}.',
    'divergence.not_enough_reports': 'Gabaasni gahaan hin jiru. Gabaasni keessan galmaa\'eera.',

    // Report Fault Branch
    'prompt.enter_asset_code': 'Koodii qabeenyaa gabatee irraa galchaa:',
    'fault.menu': '1 Hin hojjetu\n2 Amma hojjetaa jira\n0 Duubatti',
    'fault.recorded': 'Gabaasni hanqinaa galmaa\'eera. Galatoomaa.',

    // Language Selection Branch
    'language.menu': '1 English\n2 አማርኛ\n3 Afaan Oromoo\n0 Duubatti',
    'language.selected': 'Afaan jijjiirameera.',

    // Outcome Menu
    'outcome.menu': "1 Kaffaltii seeraa kaffale\n2 Dabalata gaafatame\n3 Nagaheen hin kennamne\n4 Sanadni dabalataa gaafatame\n5 Waajjirri cufameera\n0 Duubatti",
    'outcome.recorded': 'Galmaa\'eera. Galatoomaa.',

    // Errors & Inline Hints
    'error.code_not_found': 'Koodiin hin beekamne. Koodiin gabatee pirojektii irra jira.',
    'error.task_closed': 'Sakatta\'iinsi kun cufameera. Pirojektii biraaf 1 bilbilaa.',
    'hint.invalid_input': 'Galtee sirrii hin taane. ',
  },

  sw: {
    // Root Menu
    'menu.root': '1 Kagua mradi\n2 Ada za huduma\n3 Ripoti hitilafu\n4 Lugha',
    'prompt.enter_project_code': 'Weka nambari ya mradi ya tarakimu 4 kutoka ubaoni:',

    // Receipt Summary & Submenu
    'receipt.summary': '{title}. {currency} {amount}. Mkandarasi {contractor}. Tarehe {due}.',
    'receipt.unofficial': '{title}. {currency} {amount}. HAKUNA HATI RASMI — kiwango hiki ni makadirio.',
    'receipt.menu': '1 Jibu ukaguzi\n2 Sikiliza tena\n3 Nani alikagua?\n0 Rudi',

    // Asset Question Templates
    'q.borehole.head_fitted': 'Je, pampu ya mkono imewekwa kwenye kisima?\n1 Ndiyo 2 La',
    'q.borehole.water_flows': 'Pampu kwa sekunde 30 — je, maji yanatoka?\n1 Ndiyo 2 La',
    'q.borehole.board_posted': 'Je, kibao cha mradi chenye nambari ya mkataba kimewekwa?\n1 Ndiyo 2 La',

    'q.generator.runs_on_outage': 'Umeme unapokatika, je, jenereta inafanya kazi?\n1 Ndiyo 2 La',
    'q.generator.fridge_green': 'Je, taa ya friji ya chanjo inaonyesha rangi ya kijani?\n1 Ndiyo 2 La',
    'q.generator.board_posted': 'Je, kibao cha mradi chenye nambari ya mkataba kimewekwa?\n1 Ndiyo 2 La',

    'q.latrine.doors_fitted': 'Je, milango yote imewekwa na inafungika?\n1 Ndiyo 2 La',
    'q.latrine.water_present': 'Je, kuna maji mahali pa kunawa mikono?\n1 Ndiyo 2 La',
    'q.latrine.board_posted': 'Je, kibao cha mradi chenye nambari ya mkataba kimewekwa?\n1 Ndiyo 2 La',

    // Observation Confirmations
    'observation.counted': 'Asante. Majirani {count} kati ya {target} wamekagua.',
    'observation.duplicate': 'Asante. Eneo hili tayari limehesabiwa, hivyo jumla inabaki {count}.',

    // Narrative States
    'narrative.under_probation_n_days': 'Ukarabati umedaiwa. Ukaguzi wa siku 7 unaendelea. Zimesalia siku {days} kabla ya kufungwa.',
    'narrative.reports_disagree': 'Ripoti zinatofautiana. Msimamizi anakagua. Usichukulie kama imekamilika.',
    'narrative.repair_failed_durability': 'Ukarabati haukudumu siku 7. Mkataba {code}. Uliza kwenye mkutano wa wadi.',
    'narrative.awaiting_reports_n_of_3': 'Majirani {count} kati ya {target} wamekagua hadi sasa.',
    'narrative.no_source_document': 'Hakuna hati rasmi iliyopatikana kwa kiwango hiki.',

    // Provenance Sentence (Trust UI)
    'provenance.sentence': 'Majirani {count} walikagua hii siku ya {weekday}. {yes} walisema ndiyo, {no} walisema la. Ukaguzi wa mwisho {ago}.',

    // Service Fees Branch
    'services.menu': '1 Kubadilisha kitambulisho\n2 Usajili wa kliniki\n0 Rudi',
    'statutory.card': 'Ada rasmi {currency} {fee}. Leta: {documents}. Ziara zinazotarajiwa: {visits}.',
    'statutory.menu': '1 Nitasema nini nikiombwa zaidi?\n2 Wengine wanaripoti nini?\n3 Nimeshatembelea tayari\n0 Rudi',
    'script.request_official_receipt': '{source} inasema ada ni {currency} {fee}. Je, ninaweza kupata risiti rasmi ya kiasi chochote cha ziada?',

    // Divergence Summaries
    'divergence.summary': 'Katika siku 30 zilizopita, {pct}% ya ripoti {n} zilisema kiasi zaidi kiliombwa. Wastani wa ziada: {currency} {median}.',
    'divergence.not_enough_reports': 'Bado hakuna ripoti za kutosha kuonyesha mwenendo. Ripoti yako imerekodiwa.',

    // Report Fault Branch
    'prompt.enter_asset_code': 'Weka nambari ya kifaa kutoka ubaoni:',
    'fault.menu': '1 Hakifanyi kazi\n2 Kinafanya kazi sasa\n0 Rudi',
    'fault.recorded': 'Ripoti ya hitilafu imerekodiwa. Asante.',

    // Language Selection Branch
    'language.menu': '1 English\n2 አማርኛ\n3 Afaan Oromoo\n4 Kiswahili\n0 Rudi',
    'language.selected': 'Lugha imesasishwa.',

    // Outcome Menu
    'outcome.menu': '1 Nililipa ada rasmi\n2 Niliombwa zaidi\n3 Sikupata risiti\n4 Niliombwa hati ya ziada\n5 Ofisi ilifungwa\n0 Rudi',
    'outcome.recorded': 'Imerekodiwa. Asante.',

    // Errors & Inline Hints
    'error.code_not_found': 'Nambari haitambuliwi. Nambari zimechapishwa kwenye kibao cha mradi.',
    'error.task_closed': 'Ukaguzi huu umefungwa. Piga 1 kwa mradi mwingine.',
    'hint.invalid_input': 'Ingizo si sahihi. ',
  },
};

/**
 * Pure template slot interpolator.
 * Replaces `{slotName}` with values from `slots`.
 */
export function interpolate(template: string, slots?: SlotValues): string {
  if (!slots) {
    return template;
  }
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, slotKey) => {
    const val = slots[slotKey];
    if (val === undefined || val === null) {
      return match;
    }
    return String(val);
  });
}

/**
 * Formats a localized message by key with slot interpolation.
 * Falls back to 'en' if key is missing in target locale.
 */
export function formatMessage(key: string, locale: Locale = 'en', slots?: SlotValues): string {
  const dict = MESSAGES[locale] || MESSAGES.en;
  const template = dict[key] || MESSAGES.en[key] || key;
  return interpolate(template, slots);
}

/**
 * Composes the canonical Provenance Sentence (06 §5, 16 §4) from structured facts only.
 */
export function composeProvenanceSentence(params: ProvenanceParams, locale: Locale = 'en'): string {
  return formatMessage('provenance.sentence', locale, {
    count: params.count,
    weekday: params.weekday,
    yes: params.yesCount,
    no: params.noCount,
    ago: params.ago,
  });
}
