document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('current-language');
  const list = document.getElementById('lang-list');
  let translations = {};

  // Fetch translations
  fetch('translations.json')
    .then(response => response.json())
    .then(data => {
      translations = data;
      applySavedLanguage();
    })
    .catch(error => console.error('Error loading translations:', error));

  // Toggle dropdown
  btn.addEventListener('click', () => {
    const open = list.style.display === 'block';
    list.style.display = open ? 'none' : 'block';
    btn.setAttribute('aria-expanded', String(!open));
  });

  // Close on outside click
  document.addEventListener('click', e => {
    if (!btn.contains(e.target) && !list.contains(e.target)) {
      list.style.display = 'none';
      btn.setAttribute('aria-expanded', 'false');
    }
  });

  // Language selection
  list.querySelectorAll('li').forEach(item => {
    item.setAttribute('tabindex', '0'); // Keyboard accessibility
    item.addEventListener('click', () => selectLanguage(item));
    item.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectLanguage(item);
      }
    });
  });

  function selectLanguage(item) {
    const lang = item.dataset.lang;
    const flag = item.dataset.flag;

    // Update button
    btn.querySelector('img').src = `flags/${flag}`;
    btn.querySelector('img').alt = item.textContent.trim();
    btn.querySelector('span').textContent = lang.toUpperCase();

    // Apply translations
    document.querySelectorAll('[data-translate]').forEach(element => {
      const key = element.dataset.translate;
      if (translations[lang] && translations[lang][key]) {
        element.textContent = translations[lang][key];
      }
    });

    // Update HTML lang and direction
    document.documentElement.lang = lang;
    document.documentElement.dir = (
      lang === 'ar' || lang === 'he' || lang === 'fa' ||
      lang === 'ur' || lang === 'ku' || lang === 'ps' ||
      lang === 'sd' || lang === 'ug' || lang === 'yi'
    ) ? 'rtl' : 'ltr';

    // Save language preference
    localStorage.setItem('selectedLang', lang);

    list.style.display = 'none';
    btn.setAttribute('aria-expanded', 'false');
  }

  // Apply saved language
  function applySavedLanguage() {
    const savedLang = localStorage.getItem('selectedLang') || 'en';
    const initialItem = list.querySelector(`[data-lang="${savedLang}"]`);
    if (initialItem) {
      btn.querySelector('img').src = `flags/${initialItem.dataset.flag}`;
      btn.querySelector('img').alt = initialItem.textContent.trim();
      btn.querySelector('span').textContent = savedLang.toUpperCase();
      document.documentElement.lang = savedLang;
      document.documentElement.dir = (
        savedLang === 'ar' || savedLang === 'he' || savedLang === 'fa' ||
        savedLang === 'ur' || savedLang === 'ku' || savedLang === 'ps' ||
        savedLang === 'sd' || savedLang === 'ug' || savedLang === 'yi'
      ) ? 'rtl' : 'ltr';
      document.querySelectorAll('[data-translate]').forEach(element => {
        const key = element.dataset.translate;
        if (translations[savedLang] && translations[savedLang][key]) {
          element.textContent = translations[savedLang][key];
        }
      });
    }
  }

  // Lazy load flag images
  document.querySelectorAll('.lang-list img').forEach(img => {
    img.setAttribute('loading', 'lazy');
  });
});
