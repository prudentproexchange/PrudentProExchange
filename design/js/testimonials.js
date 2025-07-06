// ---------------------------------------------
// testimony.js
// Full edited version with Supabase uploads
// and non-blocking Brevo email integration
// ---------------------------------------------

// If you’re using modules/bundler, ensure you have:
//   npm install @supabase/supabase-js
import { createClient } from '@supabase/supabase-js';

// 1) Supabase configuration
const SUPABASE_URL    = 'https://iwkdznjqfbsfkscnbrkc.supabase.co';
const SUPABASE_ANON   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3a2R6bmpxZmJzZmtzY25icmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2Mjk2ODgsImV4cCI6MjA2NjIwNTY4OH0.eRiXpUKP0zAMI9brPHFMxdSwZITGHxu8BPRQprkAbiU';
const supabase        = createClient(SUPABASE_URL, SUPABASE_ANON);
const BUCKET_NAME     = 'celestial-testimonials';

// ---------------------------------------------
// Initialize AOS (Animate On Scroll)
// ---------------------------------------------
AOS.init({ duration: 800, once: true });

// ---------------------------------------------
// Hamburger Menu
// ---------------------------------------------
const hamburgerBtn = document.getElementById('hamburgerBtn');
const navDrawer    = document.getElementById('navDrawer');

hamburgerBtn.addEventListener('click', () => {
  navDrawer.classList.toggle('open');
  hamburgerBtn.classList.toggle('active');
});

// ---------------------------------------------
// Theme Toggle (Light / Dark)
// ---------------------------------------------
const themeToggle = document.getElementById('theme-toggle');
themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('light-theme');
  const icon = themeToggle.querySelector('i');
  icon.classList.toggle('fa-moon');
  icon.classList.toggle('fa-sun');
});

// ---------------------------------------------
// Back to Top Button
// ---------------------------------------------
document.getElementById('back-to-top').addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ---------------------------------------------
// Local Time & Date Display
// ---------------------------------------------
function updateLocalTime() {
  const now = new Date();
  document.getElementById('localTime').textContent = now.toLocaleTimeString();
  document.getElementById('localDate').textContent = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}
setInterval(updateLocalTime, 1000);
updateLocalTime();

function updateUTCTime() {
  document.getElementById('utcTime').textContent = new Date().toUTCString();
}
setInterval(updateUTCTime, 1000);
updateUTCTime();

// ---------------------------------------------
// Background Video Playback Optimization
// ---------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  const video      = document.querySelector('.bg-video');
  let retryCount   = 0;
  const maxRetries = 3;
  const retryDelay = 1000;

  if (!video) {
    console.error('Background video element not found');
    return;
  }

  const playVideo = () => {
    video.play()
      .then(() => {
        console.log('Background video is playing successfully');
        retryCount = 0;
      })
      .catch((error) => {
        console.error(`Background video play failed (attempt ${retryCount + 1}):`, error);
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(playVideo, retryDelay);
        } else {
          console.error('Max retries reached. Video playback failed.');
        }
      });
  };

  playVideo();

  // Logging events
  ['canplay', 'playing', 'error', 'stalled', 'loadeddata'].forEach(evt => {
    video.addEventListener(evt, () => console.log(`Background video event: ${evt}`));
  });

  // Pause when tab inactive
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (video.paused) playVideo();
    } else {
      video.pause();
      console.log('Background video paused due to tab inactivity');
    }
  });

  // Force play on first interaction
  const forcePlay = () => {
    if (video.paused) {
      playVideo();
      console.log('Attempting to play background video on user interaction');
    }
  };
  window.addEventListener('scroll', forcePlay, { once: true });
  window.addEventListener('click',  forcePlay, { once: true });
});

// ---------------------------------------------
// Char Counters for maxlength inputs
// ---------------------------------------------
function updateCharCounter(input, counter, max) {
  counter.textContent = `${input.value.length}/${max}`;
}

document.querySelectorAll('input[maxlength], textarea[maxlength]').forEach(input => {
  const counter = input.nextElementSibling;
  const max     = input.getAttribute('maxlength');
  input.addEventListener('input', () => updateCharCounter(input, counter, max));
  updateCharCounter(input, counter, max);
});

// ---------------------------------------------
// Drag & Drop Media Preview
// ---------------------------------------------
const dragDropArea  = document.getElementById('drag-drop-area');
const mediaInput    = document.getElementById('media');
const mediaPreview  = document.getElementById('media-preview');

['dragover','dragleave','drop'].forEach(evt => {
  dragDropArea.addEventListener(evt, e => {
    e.preventDefault();
    dragDropArea.classList.toggle('drag-over', evt === 'dragover');
  });
});

dragDropArea.addEventListener('drop', e => {
  handleFiles(e.dataTransfer.files);
});
mediaInput.addEventListener('change', () => handleFiles(mediaInput.files));

function handleFiles(files) {
  mediaPreview.innerHTML = '';
  Array.from(files).forEach(file => {
    let mediaElement;
    const url = URL.createObjectURL(file);
    if (file.type.startsWith('image/')) {
      mediaElement = `<img src="${url}" alt="Preview" />`;
    } else if (file.type.startsWith('video/')) {
      mediaElement = `<video src="${url}" controls></video>`;
    } else if (file.type.startsWith('audio/')) {
      mediaElement = `<audio src="${url}" controls></audio>`;
    }
    mediaPreview.innerHTML += `<div class="media-item">${mediaElement}</div>`;
  });
}

// ---------------------------------------------
// Testimonial Submission Handler
// (with Supabase uploads & non-blocking Brevo mail)
// ---------------------------------------------
const testimonialForm = document.getElementById('submit-testimonial');

testimonialForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Gather form values
  const formData   = new FormData(testimonialForm);
  const title      = formData.get('title');
  const body       = formData.get('body');
  const rating     = formData.get('rating');
  const user_name  = formData.get('user_name');
  const location   = formData.get('location');
  const files      = mediaInput.files;

  // Upload media to Supabase Storage
  const media = [];
  for (let file of files) {
    const path = `${Date.now()}_${file.name}`;
    const { data, error: uploadError } = await supabase
      .storage
      .from(BUCKET_NAME)
      .upload(path, file, { cacheControl: '3600', upsert: false });
    if (uploadError) {
      console.error('Upload error:', uploadError);
      alert('Failed to upload media. Please try again.');
      return;
    }

    const { publicURL, error: urlError } = supabase
      .storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path);
    if (urlError) {
      console.error('Public URL error:', urlError);
    } else {
      media.push({ url: publicURL, type: file.type });
    }
  }

  // Fire & forget Brevo email
  fetch('/api/send-testimonial-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, body, user_name, location, rating, media }),
  }).catch(err => console.warn('Brevo mail failed:', err));

  // Submit testimonial record
  try {
    const res = await fetch('/api/testimonials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, user_name, location, rating, media }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error('Submission error:', text);
      throw new Error(text);
    }
    alert('Testimonial submitted! Please check your email to verify.');
    testimonialForm.reset();
    mediaPreview.innerHTML = '';
    document.querySelectorAll('.char-counter')
      .forEach(c => c.textContent = `0/${c.textContent.split('/')[1]}`);
  } catch (err) {
    console.error('Submission exception:', err);
    alert('Error submitting testimonial. Please try again.');
  }
});

// ---------------------------------------------
// Testimonials Gallery & Filtering
// ---------------------------------------------
let page  = 1;
const limit = 9;

async function loadTestimonials() {
  const rating   = document.getElementById('rating-filter').value;
  const location = document.getElementById('location-filter').value;
  const sort     = document.getElementById('sort-filter').value;

  try {
    const res = await fetch(
      `/api/testimonials?page=${page}&limit=${limit}` +
      `&rating=${rating}&location=${location}&sort=${sort}&verified=true`
    );
    const testimonials = await res.json();
    const grid = document.getElementById('testimonials-grid');

    if (page === 1) grid.innerHTML = '';

    testimonials.forEach(t => {
      const mediaEl = t.media[0]
        ? t.media[0].type.startsWith('image/') ? `<img src="${t.media[0].url}" alt="${t.title}" />`
        : t.media[0].type.startsWith('video/') ? `<video src="${t.media[0].url}" controls></video>`
        : `<audio src="${t.media[0].url}" controls></audio>`
        : '';
      const stars = '★'.repeat(t.rating) + '☆'.repeat(5 - t.rating);
      const card = `
        <article class="testimonial-card" data-id="${t.id}" itemscope itemtype="https://schema.org/Review">
          ${mediaEl}
          <h3 itemprop="name">${t.title || 'Testimonial'}</h3>
          <p class="reviewer-meta">
            <span itemprop="author">${t.user_name}</span>,
            <span itemprop="location">${t.location}</span> •
            <meta itemprop="datePublished" content="${t.created_at}">
            ${new Date(t.created_at).toLocaleDateString('en-US',{ month:'long', year:'numeric'})}
          </p>
          <div class="review-rating" itemprop="reviewRating" itemscope itemtype="https://schema.org/Rating">
            <meta itemprop="ratingValue" content="${t.rating}" />
            <meta itemprop="bestRating" content="5" />
            <span class="stars">${stars}</span>
          </div>
          <p itemprop="reviewBody">${t.body.substring(0,100)}...</p>
          <div class="review-actions">
            <button class="upvote-btn" data-id="${t.id}" aria-label="Upvote">
              <i class="fas fa-heart"></i> <span class="upvote-count">${t.upvotes}</span>
            </button>
            <div class="share-buttons">
              <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(t.title)}" target="_blank"><i class="fab fa-twitter"></i></a>
              <a href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}" target="_blank"><i class="fab fa-linkedin"></i></a>
              <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}" target="_blank"><i class="fab fa-facebook"></i></a>
            </div>
            <button class="flag-btn" data-id="${t.id}" aria-label="Flag">Flag</button>
          </div>
        </article>
      `;
      grid.insertAdjacentHTML('beforeend', card);
    });

    document.getElementById('load-more').style.display =
      testimonials.length < limit ? 'none' : 'block';

  } catch (err) {
    console.error('Error loading testimonials:', err);
  }
}

document.getElementById('load-more').addEventListener('click', () => {
  page++;
  loadTestimonials();
});
document.querySelectorAll('.filter-controls select').forEach(sel => {
  sel.addEventListener('change', () => {
    page = 1;
    loadTestimonials();
  });
});

// ---------------------------------------------
// Lightbox for Expanded View
// ---------------------------------------------
function openLightbox(t) {
  const mediaCarousel = t.media.map(m =>
    m.type.startsWith('image/') ? `<img src="${m.url}" alt="${t.title}"/>`
  : m.type.startsWith('video/') ? `<video src="${m.url}" controls></video>`
  : `<audio src="${m.url}" controls></audio>`
  ).join('');
  const stars = '★'.repeat(t.rating)+'☆'.repeat(5-t.rating);

  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.innerHTML = `
    <div class="lightbox-content">
      <button class="lightbox-close">✕</button>
      <div class="media-carousel">${mediaCarousel}</div>
      <h3>${t.title || 'Testimonial'}</h3>
      <p class="reviewer-meta">${t.user_name}, ${t.location} • ${
        new Date(t.created_at).toLocaleDateString('en-US',{month:'long',year:'numeric'})
      }</p>
      <div class="review-rating">${stars}</div>
      <p>${t.body}</p>
      <div class="review-actions">
        <button class="upvote-btn" data-id="${t.id}"><i class="fas fa-heart"></i> <span class="upvote-count">${t.upvotes}</span></button>
        <div class="share-buttons">
          <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(t.title)}" target="_blank"><i class="fab fa-twitter"></i></a>
          <a href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}" target="_blank"><i class="fab fa-linkedin"></i></a>
          <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}" target="_blank"><i class="fab fa-facebook"></i></a>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(lb);
  lb.querySelector('.lightbox-close').addEventListener('click', () => lb.remove());
}

// ---------------------------------------------
// Delegated Click Handlers
// ---------------------------------------------
document.addEventListener('click', async e => {
  // Open lightbox
  const card = e.target.closest('.testimonial-card');
  if (card && !e.target.closest('.upvote-btn') && !e.target.closest('.flag-btn')) {
    const id = card.dataset.id;
    const res = await fetch(`/api/testimonials/${id}`);
    if (res.ok) {
      const t = await res.json();
      openLightbox(t);
    }
    return;
  }

  // Upvote
  if (e.target.closest('.upvote-btn')) {
    const btn = e.target.closest('.upvote-btn');
    const countEl = btn.querySelector('.upvote-count');
    await fetch(`/api/testimonials/${btn.dataset.id}/upvote`, { method: 'POST' });
    countEl.textContent = parseInt(countEl.textContent) + 1;
    return;
  }

  // Flag
  if (e.target.closest('.flag-btn')) {
    const id = e.target.closest('.flag-btn').dataset.id;
    const reason = prompt('Please provide a reason for flagging this testimonial:');
    if (!reason) return;
    await fetch(`/api/testimonials/${id}/flag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    alert('Testimonial flagged for moderation.');
  }
});

// ---------------------------------------------
// Initial Load & Scroll-to-Form
// ---------------------------------------------
loadTestimonials();

function scrollToForm() {
  document.getElementById('testimonial-form')
    .scrollIntoView({ behavior: 'smooth' });
}
