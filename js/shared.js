/* ============================================================
   KHEDMA — Shared JS
   Config · Supabase client · i18n · Utilities
   ============================================================ */

/* ── App Config ── */
const CONFIG = {
  appName: 'KHEDMA',

  /* Add more districts here — UI updates automatically */
  DISTRICTS: [
    { id: 'centre-ville', ar: 'وسط المدينة', fr: 'Centre-ville', en: 'Centre-ville', es: 'Centre-ville', darija: 'وسط المدينة' },
    { id: 'iberia',       ar: 'أيبيريا',     fr: 'Iberia',       en: 'Iberia',       es: 'Iberia',       darija: 'إيبيريا'    },
    { id: 'branes',       ar: 'براني',       fr: 'Branes',       en: 'Branes',       es: 'Branes',       darija: 'براني'      },
    { id: 'malabata',     ar: 'مالاباطا',    fr: 'Malabata',     en: 'Malabata',     es: 'Malabata',     darija: 'مالاباطا'   },
  ],

  /* Add more categories here — UI updates automatically */
  CATEGORIES: [
    { id: 'cafe-waiter',      ar: 'نادل كافيه',  fr: 'Serveur café',     en: 'Café Waiter',      es: 'Camarero café',    darija: 'قاهواجي',      icon: '☕' },
    { id: 'cleaning',         ar: 'تنظيف',        fr: 'Nettoyage',        en: 'Cleaning',         es: 'Limpieza',         darija: 'نقاوة',        icon: '🧹' },
    { id: 'restaurant-staff', ar: 'طاقم مطعم',   fr: 'Personnel resto',  en: 'Restaurant Staff', es: 'Personal resto',   darija: 'خدامة ريستو',  icon: '🍽️' },
  ],

  LANGS: ['ar', 'en', 'fr', 'es', 'darija'],
  DEFAULT_LANG: 'ar',
  RTL_LANGS: ['ar', 'darija'],
};

/* ── Supabase Client ── */
// Set SUPABASE_URL and SUPABASE_ANON_KEY as Vercel environment variables
// In local dev, set them on window before loading this file:
//   window.SUPABASE_URL = 'https://xxx.supabase.co'
//   window.SUPABASE_ANON_KEY = 'eyJ...'
const _SB_URL  = (typeof SUPABASE_URL  !== 'undefined' ? SUPABASE_URL  : null) || window._SUPABASE_URL  || null;
const _SB_ANON = (typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : null) || window._SUPABASE_ANON || null;

let supabase = null;
if (_SB_URL && _SB_ANON && typeof window.supabase !== 'undefined') {
  try {
    supabase = window.supabase.createClient(_SB_URL, _SB_ANON);
  } catch(e) {
    console.warn('Supabase init failed:', e.message);
  }
}

/* ── i18n Strings ── */
const T = {
  ar: {
    tagline:          'خدمة قريبة منك في طنجة',
    browseJobs:       'الوظائف',
    postJob:          'نشر وظيفة',
    workers:          'العمال',
    allCategories:    'الكل',
    search:           'ابحث عن وظيفة...',
    searchWorkers:    'ابحث عن عامل...',
    apply:            'تواصل عبر واتساب',
    contactWorker:    'تواصل مع العامل',
    noJobs:           'لا توجد وظائف متاحة',
    noJobsHint:       'كن أول من ينشر وظيفة في طنجة',
    noWorkers:        'لا يوجد عمال متاحون',
    jobTitle:         'العنوان',
    category:         'الفئة',
    district:         'المنطقة',
    date:             'التاريخ',
    startTime:        'وقت البدء',
    duration:         'المدة (ساعات)',
    pay:              'الأجر (درهم)',
    description:      'الوصف',
    yourPhone:        'رقم واتساب الخاص بك',
    referralCode:     'كود الإحالة',
    submit:           'نشر الإعلان',
    back:             'رجوع',
    jobsActive:       'وظيفة نشطة',
    workersActive:    'عامل متاح',
    selectRole:       'كيف ستستخدم KHEDMA؟',
    roleWorker:       'أبحث عن عمل',
    roleEmployer:     'أبحث عن عمال',
    skip:             'تخطي',
    continue:         'متابعة',
    perHour:          'درهم',
    hours:            'ساعة',
    postedAt:         'نُشر',
    optional:         'اختياري',
    loading:          'جار التحميل...',
    phoneHint:        'مثال: +212 6XX XXX XXX',
    titlePlaceholder: 'مثال: نادل لكافيه نهاية الأسبوع',
    descPlaceholder:  'اشرح المهمة والمتطلبات...',
    jobsIn:           'وظائف في طنجة',
    newJobLive:       '🔔 وظيفة جديدة أُضيفت!',
    jobNotFound:      'الوظيفة غير موجودة',
    workerNotFound:   'الملف الشخصي غير موجود',
    postSuccess:      '✅ تم نشر الوظيفة!',
    postError:        '❌ فشل النشر، حاول مجدداً',
    chooseDistrict:   'اختر المنطقة',
    chooseCategory:   'اختر الفئة',
    whatsappMsg:      (title) => `السلام عليكم، رأيت إعلانكم على KHEDMA حول ${title}. هل ما زال متاحاً؟`,
    workerMsg:        (name)  => `مرحبا ${name}! رأيت ملفك على KHEDMA وأريد التواصل معك.`,
  },
  en: {
    tagline:          'Jobs near you in Tangier',
    browseJobs:       'Jobs',
    postJob:          'Post a Job',
    workers:          'Workers',
    allCategories:    'All',
    search:           'Search jobs...',
    searchWorkers:    'Search workers...',
    apply:            'Contact via WhatsApp',
    contactWorker:    'Contact Worker',
    noJobs:           'No jobs available',
    noJobsHint:       'Be the first to post a job in Tangier',
    noWorkers:        'No workers available',
    jobTitle:         'Title',
    category:         'Category',
    district:         'District',
    date:             'Date',
    startTime:        'Start time',
    duration:         'Duration (hours)',
    pay:              'Pay (MAD)',
    description:      'Description',
    yourPhone:        'Your WhatsApp number',
    referralCode:     'Referral code',
    submit:           'Post Job',
    back:             'Back',
    jobsActive:       'active jobs',
    workersActive:    'available workers',
    selectRole:       'How will you use KHEDMA?',
    roleWorker:       'Looking for work',
    roleEmployer:     'Hiring workers',
    skip:             'Skip',
    continue:         'Continue',
    perHour:          'MAD',
    hours:            'hrs',
    postedAt:         'Posted',
    optional:         'optional',
    loading:          'Loading...',
    phoneHint:        'E.g. +212 6XX XXX XXX',
    titlePlaceholder: 'E.g. Weekend café waiter',
    descPlaceholder:  'Describe the task and requirements...',
    jobsIn:           'Jobs in Tangier',
    newJobLive:       '🔔 New job posted!',
    jobNotFound:      'Job not found',
    workerNotFound:   'Profile not found',
    postSuccess:      '✅ Job posted!',
    postError:        '❌ Post failed, try again',
    chooseDistrict:   'Choose district',
    chooseCategory:   'Choose category',
    whatsappMsg:      (title) => `Hi, I saw your post on KHEDMA about ${title}. Is it still available?`,
    workerMsg:        (name)  => `Hi ${name}! I saw your profile on KHEDMA and would like to get in touch.`,
  },
  fr: {
    tagline:          'Des services près de vous à Tanger',
    browseJobs:       'Offres',
    postJob:          'Publier une offre',
    workers:          'Travailleurs',
    allCategories:    'Tout',
    search:           'Rechercher un emploi...',
    searchWorkers:    'Rechercher un travailleur...',
    apply:            'Contacter via WhatsApp',
    contactWorker:    'Contacter',
    noJobs:           'Aucune offre disponible',
    noJobsHint:       'Soyez le premier à publier à Tanger',
    noWorkers:        'Aucun travailleur disponible',
    jobTitle:         'Titre',
    category:         'Catégorie',
    district:         'Quartier',
    date:             'Date',
    startTime:        'Heure de début',
    duration:         'Durée (heures)',
    pay:              'Salaire (MAD)',
    description:      'Description',
    yourPhone:        'Votre numéro WhatsApp',
    referralCode:     'Code de parrainage',
    submit:           'Publier',
    back:             'Retour',
    jobsActive:       'offres actives',
    workersActive:    'travailleurs disponibles',
    selectRole:       'Comment utilisez-vous KHEDMA ?',
    roleWorker:       'Je cherche du travail',
    roleEmployer:     'Je cherche des travailleurs',
    skip:             'Passer',
    continue:         'Continuer',
    perHour:          'MAD',
    hours:            'h',
    postedAt:         'Publié',
    optional:         'optionnel',
    loading:          'Chargement...',
    phoneHint:        'Ex. : +212 6XX XXX XXX',
    titlePlaceholder: 'Ex. : Serveur café weekend',
    descPlaceholder:  'Décrivez le poste et les exigences...',
    jobsIn:           'Offres à Tanger',
    newJobLive:       '🔔 Nouvelle offre publiée !',
    jobNotFound:      'Offre introuvable',
    workerNotFound:   'Profil introuvable',
    postSuccess:      '✅ Offre publiée !',
    postError:        '❌ Échec, réessayez',
    chooseDistrict:   'Choisir le quartier',
    chooseCategory:   'Choisir la catégorie',
    whatsappMsg:      (title) => `Bonjour, j'ai vu votre annonce sur KHEDMA concernant ${title}. Est-ce toujours disponible ?`,
    workerMsg:        (name)  => `Bonjour ${name} ! J'ai vu votre profil sur KHEDMA et je voudrais vous contacter.`,
  },
  es: {
    tagline:          'Servicios cerca de ti en Tánger',
    browseJobs:       'Ofertas',
    postJob:          'Publicar oferta',
    workers:          'Trabajadores',
    allCategories:    'Todo',
    search:           'Buscar trabajo...',
    searchWorkers:    'Buscar trabajador...',
    apply:            'Contactar por WhatsApp',
    contactWorker:    'Contactar',
    noJobs:           'No hay ofertas disponibles',
    noJobsHint:       'Sé el primero en publicar en Tánger',
    noWorkers:        'No hay trabajadores disponibles',
    jobTitle:         'Título',
    category:         'Categoría',
    district:         'Barrio',
    date:             'Fecha',
    startTime:        'Hora de inicio',
    duration:         'Duración (horas)',
    pay:              'Pago (MAD)',
    description:      'Descripción',
    yourPhone:        'Tu número de WhatsApp',
    referralCode:     'Código de referido',
    submit:           'Publicar',
    back:             'Volver',
    jobsActive:       'ofertas activas',
    workersActive:    'trabajadores disponibles',
    selectRole:       '¿Cómo usarás KHEDMA?',
    roleWorker:       'Busco trabajo',
    roleEmployer:     'Busco trabajadores',
    skip:             'Omitir',
    continue:         'Continuar',
    perHour:          'MAD',
    hours:            'h',
    postedAt:         'Publicado',
    optional:         'opcional',
    loading:          'Cargando...',
    phoneHint:        'Ej. +212 6XX XXX XXX',
    titlePlaceholder: 'Ej. Camarero café fin de semana',
    descPlaceholder:  'Describe el trabajo y los requisitos...',
    jobsIn:           'Ofertas en Tánger',
    newJobLive:       '🔔 ¡Nueva oferta publicada!',
    jobNotFound:      'Oferta no encontrada',
    workerNotFound:   'Perfil no encontrado',
    postSuccess:      '✅ ¡Oferta publicada!',
    postError:        '❌ Error al publicar, inténtalo de nuevo',
    chooseDistrict:   'Elegir barrio',
    chooseCategory:   'Elegir categoría',
    whatsappMsg:      (title) => `Hola, vi tu anuncio en KHEDMA sobre ${title}. ¿Sigue disponible?`,
    workerMsg:        (name)  => `¡Hola ${name}! Vi tu perfil en KHEDMA y me gustaría contactarte.`,
  },
  darija: {
    tagline:          'خدمة قريبة منك فطنجة',
    browseJobs:       'الخدمات',
    postJob:          'ضع إعلان',
    workers:          'الخدامة',
    allCategories:    'الكل',
    search:           'قلب على خدمة...',
    searchWorkers:    'قلب على خادم...',
    apply:            'تواصل بواتساب',
    contactWorker:    'تواصل مع الخادم',
    noJobs:           'ما كاينش خدمات',
    noJobsHint:       'كون أول واحد يضع إعلان فطنجة',
    noWorkers:        'ما كاينش خدامة',
    jobTitle:         'العنوان',
    category:         'النوع',
    district:         'الحي',
    date:             'التاريخ',
    startTime:        'وقت البداية',
    duration:         'المدة (ساعات)',
    pay:              'الأجر (درهم)',
    description:      'الوصف',
    yourPhone:        'رقم واتساب ديالك',
    referralCode:     'كود الإحالة',
    submit:           'نشر الإعلان',
    back:             'ارجع',
    jobsActive:       'خدمة نشيطة',
    workersActive:    'خادم متاح',
    selectRole:       'كيفاش غادي تستعمل KHEDMA؟',
    roleWorker:       'كنقلب على خدمة',
    roleEmployer:     'كنقلب على خدامة',
    skip:             'تخطي',
    continue:         'زيد',
    perHour:          'درهم',
    hours:            'ساعة',
    postedAt:         'تنشر',
    optional:         'اختياري',
    loading:          'كيحمّل...',
    phoneHint:        'مثال: +212 6XX XXX XXX',
    titlePlaceholder: 'مثال: قاهواجي لكافيه فالويكاند',
    descPlaceholder:  'شرح الخدمة والمتطلبات...',
    jobsIn:           'خدمات فطنجة',
    newJobLive:       '🔔 خدمة جديدة تنشرت!',
    jobNotFound:      'الخدمة ما لقيناهاش',
    workerNotFound:   'الملف ما لقيناهوش',
    postSuccess:      '✅ تنشر الإعلان!',
    postError:        '❌ ما نشرتش، عاود حاول',
    chooseDistrict:   'اختار الحي',
    chooseCategory:   'اختار النوع',
    whatsappMsg:      (title) => `السلام، شفت إعلانكم على KHEDMA على ${title}. واش مازال متاح؟`,
    workerMsg:        (name)  => `السلام ${name}! شفت ملفك على KHEDMA وبغيت نتواصل معاك.`,
  },
};

/* ── Language State ── */
let currentLang = localStorage.getItem('khedma_lang') || CONFIG.DEFAULT_LANG;

function getLang()  { return currentLang; }
function isRTL()    { return CONFIG.RTL_LANGS.includes(currentLang); }
function t(key, ...args) {
  const dict = T[currentLang] || T.ar;
  const val  = dict[key] !== undefined ? dict[key] : (T.ar[key] || key);
  return typeof val === 'function' ? val(...args) : val;
}

function applyLang(lang) {
  if (!CONFIG.LANGS.includes(lang)) lang = CONFIG.DEFAULT_LANG;
  currentLang = lang;
  localStorage.setItem('khedma_lang', lang);

  const rtl = isRTL();
  document.documentElement.lang = rtl ? 'ar' : lang;
  document.documentElement.dir  = rtl ? 'rtl' : 'ltr';

  /* text content */
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const val = t(el.dataset.i18n);
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.placeholder = val;
    } else {
      el.textContent = val;
    }
  });

  /* placeholders on non-input elements */
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPh);
  });

  /* category chips */
  document.querySelectorAll('.cat-chip[data-cat]').forEach(chip => {
    if (chip.dataset.cat === 'all') {
      chip.textContent = t('allCategories');
    } else {
      const cat = CONFIG.CATEGORIES.find(c => c.id === chip.dataset.cat);
      if (cat) chip.textContent = `${cat.icon} ${cat[lang] || cat.ar}`;
    }
  });

  /* district options */
  document.querySelectorAll('select[data-district-select]').forEach(sel => {
    const cur = sel.value;
    sel.innerHTML = buildDistrictOptions(cur);
  });

  /* category options */
  document.querySelectorAll('select[data-category-select]').forEach(sel => {
    const cur = sel.value;
    sel.innerHTML = buildCategoryOptions(cur);
  });

  /* lang toggle active state */
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
}

function initLangToggle() {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => applyLang(btn.dataset.lang));
  });
  applyLang(currentLang);
}

/* ── Option Builders ── */
function buildDistrictOptions(selected = '') {
  const ph = `<option value="" disabled ${!selected ? 'selected' : ''}>${t('chooseDistrict')}</option>`;
  return ph + CONFIG.DISTRICTS.map(d =>
    `<option value="${d.id}" ${selected === d.id ? 'selected' : ''}>${d[currentLang] || d.ar}</option>`
  ).join('');
}

function buildCategoryOptions(selected = '') {
  const ph = `<option value="" disabled ${!selected ? 'selected' : ''}>${t('chooseCategory')}</option>`;
  return ph + CONFIG.CATEGORIES.map(c =>
    `<option value="${c.id}" ${selected === c.id ? 'selected' : ''}>${c.icon} ${c[currentLang] || c.ar}</option>`
  ).join('');
}

/* ── Utilities ── */
function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function districtLabel(id) {
  const d = CONFIG.DISTRICTS.find(x => x.id === id || x.ar === id);
  return d ? (d[currentLang] || d.ar) : (id || '');
}

function categoryLabel(id) {
  const c = CONFIG.CATEGORIES.find(x => x.id === id || x.ar === id);
  return c ? (c[currentLang] || c.ar) : (id || '');
}

function categoryIcon(id) {
  const c = CONFIG.CATEGORIES.find(x => x.id === id || x.ar === id);
  return c ? c.icon : '💼';
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    const locale = isRTL() ? 'ar-MA' : currentLang === 'fr' ? 'fr-MA' : 'en-GB';
    return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  } catch { return iso; }
}

function timeAgo(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return isRTL() ? 'الآن'         : 'just now';
  if (m < 60)  return isRTL() ? `منذ ${m} د`   : `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return isRTL() ? `منذ ${h} س`   : `${h}h ago`;
  const d = Math.floor(h / 24);
  return isRTL() ? `منذ ${d} يوم` : `${d}d ago`;
}

function whatsappJobLink(phone, jobTitle) {
  const clean = String(phone).replace(/\D/g, '');
  return `https://wa.me/${clean}?text=${encodeURIComponent(t('whatsappMsg', jobTitle))}`;
}

function whatsappWorkerLink(phone, workerName) {
  const clean = String(phone).replace(/\D/g, '');
  return `https://wa.me/${clean}?text=${encodeURIComponent(t('workerMsg', workerName))}`;
}

/* ── Toast ── */
let _toastTimer = null;
function showToast(msg) {
  let el = document.getElementById('khedma-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'khedma-toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('visible');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('visible'), 2800);
}

/* ── localStorage helpers ── */
const LS = {
  get:    (key, fb = null)  => { try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fb; } catch { return fb; } },
  set:    (key, val)        => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
  remove: (key)             => { try { localStorage.removeItem(key); } catch {} },
};

/* ── Bootstrap ── */
document.addEventListener('DOMContentLoaded', initLangToggle);
