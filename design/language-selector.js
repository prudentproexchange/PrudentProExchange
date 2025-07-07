// language-selector.js
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('current-language');
  const list = document.getElementById('lang-list');

  // Load translations from a centralized source (e.g., JSON file)
  // For simplicity, using inline translations here; ideally, fetch from translations.json
  const translations = {
    en: {
      title: "Welcome to our test page",
      paragraph: "This is a sample paragraph you can use to verify that your language selector is working."
    },
    es: {
      title: "Bienvenido a nuestra página de prueba",
      paragraph: "Este es un párrafo de ejemplo que puedes usar para verificar que tu selector de idioma funciona."
    },
    // ... Include all 110 translations from the previous code ...
    yo: {
      title: "Kaabọ si oju-iwe idanwo wa",
      paragraph: "Eyi jẹ apakan ayẹwo ti o le lo lati rii daju pe aṣayan ede rẹ n ṣiṣẹ."
    },
    zu: {
      title: "Siyakwamukela ekhasini lethu lokuhlola",
      paragraph: "Lesi yisampula yesiqephu ongayisebenzisa ukuze uqinisekise ukuthi isikhethi solimi lwakho siyasebenza."
    }
  };

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

  // Language selection with dynamic translation
  list.querySelectorAll('li').forEach(item => {
    item.addEventListener('click', () => {
      const lang = item.dataset.lang;
      const flag = item.dataset.flag;

      // Update button
      btn.querySelector('img').src = `flags/${flag}`;
      btn.querySelector('img').alt = item.textContent.trim();
      btn.querySelector('span').textContent = lang.toUpperCase();

      // Apply translations to elements with data-translate attribute
      document.querySelectorAll('[data-translate]').forEach(element => {
        const key = element.dataset.translate;
        if (translations[lang] && translations[lang][key]) {
          element.textContent = translations[lang][key];
        }
      });

      // Update HTML lang and direction
      document.documentElement.lang = lang;
      document.documentElement.dir = (
        lang === 'ar' || 
        lang === 'he' || 
        lang === 'fa' || 
        lang === 'ur' || 
        lang === 'ku' || 
        lang === 'ps' || 
        lang === 'sd' || 
        lang === 'ug' || 
        lang === 'yi'
      ) ? 'rtl' : 'ltr';

      // Close dropdown
      list.style.display = 'none';
      btn.setAttribute('aria-expanded', 'false');
    });
  });

  // Lazy load flag images
  document.querySelectorAll('.lang-list img').forEach(img => {
    img.setAttribute('loading', 'lazy');
  });
});
