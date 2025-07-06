// ---------------------------
// Supabase Initialization
// ---------------------------
const { createClient } = supabase;
const supabaseUrl   = 'https://YOUR_PROJECT_ID.supabase.co';
const supabaseKey   = 'YOUR_ANON_OR_SERVICE_ROLE_KEY';
const supabaseClient = createClient(supabaseUrl, supabaseKey);

// ---------------------------
// Initialize AOS
// ---------------------------
AOS.init({ duration: 800, once: true });

// ---------------------------
// Hamburger Menu
// ---------------------------
const hamburgerBtn = document.getElementById('hamburgerBtn');
const navDrawer    = document.getElementById('navDrawer');
hamburgerBtn.addEventListener('click', () => {
  navDrawer.classList.toggle('open');
  hamburgerBtn.classList.toggle('active');
});

// ---------------------------
// Theme Toggle
// ---------------------------
const themeToggle = document.getElementById('theme-toggle');
themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('light-theme');
  const icon = themeToggle.querySelector('i');
  icon.classList.toggle('fa-moon');
  icon.classList.toggle('fa-sun');
});

// ---------------------------
// Back to Top
// ---------------------------
document.getElementById('back-to-top').addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ---------------------------
// Local & UTC Time Display
// ---------------------------
function updateLocalTime() {
  const now = new Date();
  document.getElementById('localTime').textContent = now.toLocaleTimeString();
  document.getElementById('localDate').textContent = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}
function updateUTCTime() {
  document.getElementById('utcTime').textContent = new Date().toUTCString();
}
setInterval(updateLocalTime, 1000);
setInterval(updateUTCTime, 1000);
updateLocalTime();
updateUTCTime();

// ---------------------------
// Video Playback Optimization
// ---------------------------
document.addEventListener('DOMContentLoaded', () => {
  const video       = document.querySelector('.bg-video');
  let retryCount    = 0;
  const maxRetries  = 3;
  const retryDelay  = 1000;

  if (!video) return console.error('Background video element not found');

  const playVideo = () => {
    video.play()
      .then(() => { console.log('Background video playing'); retryCount = 0; })
      .catch((err) => {
        console.error(`Play attempt ${retryCount+1} failed:`, err);
        if (retryCount++ < maxRetries) setTimeout(playVideo, retryDelay);
      });
  };

  playVideo();
  ['canplay','playing','error','stalled','loadeddata'].forEach(evt =>
    video.addEventListener(evt, () => console.log(`Video event: ${evt}`))
  );

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && video.paused) playVideo();
    else if (document.visibilityState !== 'visible') video.pause();
  });

  const forcePlay = () => { if (video.paused) playVideo(); };
  window.addEventListener('scroll', forcePlay, { once: true });
  window.addEventListener('click',  forcePlay, { once: true });
});

// ---------------------------
// Testimonial Form Handling
// ---------------------------
const testimonialForm = document.getElementById('submit-testimonial');
const mediaPreview    = document.getElementById('media-preview');

// Character counters for inputs
function updateCharCounter(input, counter, max) {
  counter.textContent = `${input.value.length}/${max}`;
}
document.querySelectorAll('input[maxlength], textarea[maxlength]').forEach(input => {
  const counter = input.nextElementSibling;
  const max     = input.getAttribute('maxlength');
  input.addEventListener('input', () => updateCharCounter(input, counter, max));
  updateCharCounter(input, counter, max);
});

// Drag & Drop + File select preview
const dragDropArea = document.getElementById('drag-drop-area');
const mediaInput   = document.getElementById('media');

['dragover','dragleave','drop'].forEach(evt => {
  dragDropArea.addEventListener(evt, e => {
    e.preventDefault();
    dragDropArea.classList.toggle('drag-over', evt === 'dragover');
    if (evt === 'drop') handleFiles(e.dataTransfer.files);
  });
});
mediaInput.addEventListener('change', () => handleFiles(mediaInput.files));

function handleFiles(files) {
  mediaPreview.innerHTML = '';
  Array.from(files).forEach(file => {
    const url = URL.createObjectURL(file);
    let el;
    if (file.type.startsWith('image/'))      el = `<img src="${url}"     alt="Preview" />`;
    else if (file.type.startsWith('video/')) el = `<video src="${url}"   controls></video>`;
    else if (file.type.startsWith('audio/')) el = `<audio src="${url}"   controls></audio>`;
    mediaPreview.innerHTML += `<div class="media-item">${el}</div>`;
  });
}

// Submit: upload media → insert testimonial record
testimonialForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  // 1) Gather text fields
  const title    = testimonialForm.title.value;
  const body     = testimonialForm.body.value;
  const rating   = parseInt(testimonialForm.rating.value, 10);
  const location = testimonialForm.location.value;

  // 2) Upload each file to Supabase Storage & collect public URLs
  const files = Array.from(mediaInput.files);
  const mediaUrls = [];
  for (const file of files) {
    const filePath = `${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabaseClient
      .storage
      .from('celestial-testimonials')
      .upload(filePath, file, { cacheControl: '3600', upsert: false });
    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      alert('Failed to upload one of your files. Please try again.');
      return;
    }
    const { publicURL, error: urlError } = supabaseClient
      .storage
      .from('celestial-testimonials')
      .getPublicUrl(filePath);
    if (urlError) {
      console.error('Public URL error:', urlError);
      alert('Failed to retrieve file URL. Please try again.');
      return;
    }
    mediaUrls.push({ url: publicURL, type: file.type });
  }

  // 3) Insert testimonial into your Supabase table
  const { data, error: insertError } = await supabaseClient
    .from('testimonials')
    .insert([{
      title,
      body,
      rating,
      location,
      media: mediaUrls,      // assuming you have a JSONB column named `media`
      verified: true         // or whatever default you prefer
    }]);

  if (insertError) {
    console.error('Insert error:', insertError);
    alert('Failed to save your testimonial. Please try again.');
    return;
  }

  // 4) Success!
  alert('Thank you! Your testimonial has been submitted.');

  // Reset form & preview
  testimonialForm.reset();
  mediaPreview.innerHTML = '';
  document.querySelectorAll('.char-counter')
    .forEach(c => { const max = c.textContent.split('/')[1]; c.textContent = `0/${max}`; });

  // Reset page state if you want:
  page = 1;
  loadTestimonials();
});
