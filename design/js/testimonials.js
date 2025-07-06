// Initialize AOS
AOS.init({ duration: 800, once: true });

// Hamburger Menu
const hamburgerBtn = document.getElementById('hamburgerBtn');
const navDrawer = document.getElementById('navDrawer');
hamburgerBtn.addEventListener('click', () => {
  navDrawer.classList.toggle('open');
  hamburgerBtn.classList.toggle('active');
});

// Theme Toggle
const themeToggle = document.getElementById('theme-toggle');
themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('light-theme');
  const icon = themeToggle.querySelector('i');
  icon.classList.toggle('fa-moon');
  icon.classList.toggle('fa-sun');
});

// Back to Top
document.getElementById('back-to-top').addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Time and Date
function updateLocalTime() {
  const now = new Date();
  document.getElementById('localTime').textContent = now.toLocaleTimeString();
  document.getElementById('localDate').textContent = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
setInterval(updateLocalTime, 1000);
updateLocalTime();

function updateUTCTime() {
  document.getElementById('utcTime').textContent = new Date().toUTCString();
}
setInterval(updateUTCTime, 1000);
updateUTCTime();

// Video Playback Optimization
document.addEventListener('DOMContentLoaded', () => {
  const video = document.querySelector('.bg-video');
  let retryCount = 0;
  const maxRetries = 3;
  const retryDelay = 1000;

  if (video) {
    const playVideo = () => {
      video
        .play()
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

    video.addEventListener('canplay', () => console.log('Background video can play'));
    video.addEventListener('playing', () => console.log('Background video is actively playing'));
    video.addEventListener('error', (e) => console.error('Background video error:', e));
    video.addEventListener('stalled', () => console.warn('Background video stalled'));
    video.addEventListener('loadeddata', () => console.log('Background video data loaded'));

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        if (video.paused) {
          playVideo();
        }
      } else {
        video.pause();
        console.log('Background video paused due to tab inactivity');
      }
    });

    const forcePlayOnInteraction = () => {
      if (video.paused) {
        playVideo();
        console.log('Attempting to play background video on user interaction');
      }
    };

    window.addEventListener('scroll', forcePlayOnInteraction, { once: true });
    window.addEventListener('click', forcePlayOnInteraction, { once: true });
  } else {
    console.error('Background video element not found');
  }
});

// Testimonial Submission Form
const testimonialForm = document.getElementById('submit-testimonial');
const dragDropArea = document.getElementById('drag-drop-area');
const mediaInput = document.getElementById('media');
const mediaPreview = document.getElementById('media-preview');

function updateCharCounter(input, counter, max) {
  counter.textContent = `${input.value.length}/${max}`;
}

document.querySelectorAll('input[maxlength], textarea[maxlength]').forEach((input) => {
  const counter = input.nextElementSibling;
  const max = input.getAttribute('maxlength');
  input.addEventListener('input', () => updateCharCounter(input, counter, max));
  updateCharCounter(input, counter, max);
});

dragDropArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  dragDropArea.classList.add('drag-over');
});

dragDropArea.addEventListener('dragleave', () => {
  dragDropArea.classList.remove('drag-over');
});

dragDropArea.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDropArea.classList.remove('drag-over');
  const files = e.dataTransfer.files;
  handleFiles(files);
});

mediaInput.addEventListener('change', () => {
  handleFiles(mediaInput.files);
});

function handleFiles(files) {
  mediaPreview.innerHTML = '';
  Array.from(files).forEach((file) => {
    if (file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/')) {
      const url = URL.createObjectURL(file);
      const mediaElement = file.type.startsWith('image/')
        ? `<img src="${url}" alt="Preview" />`
        : file.type.startsWith('video/')
        ? `<video src="${url}" controls></video>`
        : `<audio src="${url}" controls></audio>`;
      mediaPreview.innerHTML += `<div class="media-item">${mediaElement}</div>`;
    }
  });
}

testimonialForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(testimonialForm);

  try {
    const response = await fetch('/api/testimonials', {
      method: 'POST',
      body: formData,
    });
    if (response.ok) {
      alert('Testimonial submitted! Please check your email to verify.');
      testimonialForm.reset();
      mediaPreview.innerHTML = '';
      document.querySelectorAll('.char-counter').forEach((counter) => (counter.textContent = '0/' + counter.textContent.split('/')[1]));
    } else {
      alert('Error submitting testimonial. Please try again.');
    }
  } catch (error) {
    console.error('Submission error:', error);
    alert('Error submitting testimonial. Please try again.');
  }
});

// Testimonials Gallery
let page = 1;
const limit = 9;

async function loadTestimonials() {
  const rating = document.getElementById('rating-filter').value;
  const location = document.getElementById('location-filter').value;
  const sort = document.getElementById('sort-filter').value;

  try {
    const response = await fetch(`/api/testimonials?page=${page}&limit=${limit}&rating=${rating}&location=${location}&sort=${sort}&verified=true`);
    const testimonials = await response.json();
    const galleryGrid = document.getElementById('testimonials-grid');

    if (page === 1) {
      galleryGrid.innerHTML = '';
    }

    testimonials.forEach((testimonial) => {
      const mediaElement = testimonial.media[0]
        ? testimonial.media[0].type.startsWith('image/')
          ? `<img src="${testimonial.media[0].url}" alt="${testimonial.title}" />`
          : testimonial.media[0].type.startsWith('video/')
          ? `<video src="${testimonial.media[0].url}" controls></video>`
          : `<audio src="${testimonial.media[0].url}" controls></audio>`
        : '';
      const stars = '★'.repeat(testimonial.rating) + '☆'.repeat(5 - testimonial.rating);
      const card = `
        <article class="testimonial-card" itemscope itemtype="https://schema.org/Review" data-id="${testimonial.id}">
          ${mediaElement}
          <h3 itemprop="name">${testimonial.title || 'Testimonial'}</h3>
          <p class="reviewer-meta">
            <span itemprop="author">${testimonial.user_name}</span>, 
            <span itemprop="location">${testimonial.location}</span> •
            <meta itemprop="datePublished" content="${testimonial.created_at}">
            ${new Date(testimonial.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
          <div class="review-rating" itemprop="reviewRating" itemscope itemtype="https://schema.org/Rating">
            <meta itemprop="ratingValue" content="${testimonial.rating}" />
            <meta itemprop="bestRating" content="5" />
            <span class="stars">${stars}</span>
          </div>
          <p itemprop="reviewBody">${testimonial.body.substring(0, 100)}...</p>
          <div class="review-actions">
            <button class="upvote-btn" data-id="${testimonial.id}" aria-label="Upvote this testimonial">
              <i class="fas fa-heart"></i> <span class="upvote-count">${testimonial.upvotes}</span>
            </button>
            <div class="share-buttons">
              <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(testimonial.title)}%20with%20PrudentProExchange" target="_blank" aria-label="Share on Twitter"><i class="fab fa-twitter"></i></a>
              <a href="https://www.linkedin.com/sharing/share-offsite/?url=https://prudentproexchange.com/testimonials" target="_blank" aria-label="Share on LinkedIn"><i class="fab fa-linkedin"></i></a>
              <a href="https://www.facebook.com/sharer/sharer.php?u=https://prudentproexchange.com/testimonials" target="_blank" aria-label="Share on Facebook"><i class="fab fa-facebook"></i></a>
            </div>
            <button class="flag-btn" data-id="${testimonial.id}" aria-label="Flag this testimonial">Flag</button>
          </div>
        </article>
      `;
      galleryGrid.innerHTML += card;
    });

    document.getElementById('load-more').style.display = testimonials.length < limit ? 'none' : 'block';
  } catch (error) {
    console.error('Error loading testimonials:', error);
  }
}

document.getElementById('load-more').addEventListener('click', () => {
  page++;
  loadTestimonials();
});

document.querySelectorAll('.filter-controls select').forEach((select) => {
  select.addEventListener('change', () => {
    page = 1;
    loadTestimonials();
  });
});

// Lightbox
function openLightbox(testimonial) {
  const mediaCarousel = testimonial.media
    .map((media) =>
      media.type.startsWith('image/')
        ? `<img src="${media.url}" alt="${testimonial.title}" />`
        : media.type.startsWith('video/')
        ? `<video src="${media.url}" controls></video>`
        : `<audio src="${media.url}" controls></audio>`
    )
    .join('');
  const stars = '★'.repeat(testimonial.rating) + '☆'.repeat(5 - testimonial.rating);
  const lightbox = document.createElement('div');
  lightbox.className = 'lightbox';
  lightbox.innerHTML = `
    <div class="lightbox-content">
      <button class="lightbox-close">✕</button>
      <div class="media-carousel">${mediaCarousel}</div>
      <h3>${testimonial.title || 'Testimonial'}</h3>
      <p class="reviewer-meta">${testimonial.user_name}, ${testimonial.location} • ${new Date(testimonial.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
      <div class="review-rating">${stars}</div>
      <p>${testimonial.body}</p>
      <div class="review-actions">
        <button class="upvote-btn" data-id="${testimonial.id}"><i class="fas fa-heart"></i> <span class="upvote-count">${testimonial.upvotes}</span></button>
        <div class="share-buttons">
          <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(testimonial.title)}%20with%20PrudentProExchange" target="_blank"><i class="fab fa-twitter"></i></a>
          <a href="https://www.linkedin.com/sharing/share-offsite/?url=https://prudentproexchange.com/testimonials" target="_blank"><i class="fab fa-linkedin"></i></a>
          <a href="https://www.facebook.com/sharer/sharer.php?u=https://prudentproexchange.com/testimonials" target="_blank"><i class="fab fa-facebook"></i></a>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(lightbox);
  lightbox.querySelector('.lightbox-close').addEventListener('click', () => {
    lightbox.remove();
  });
}

document.addEventListener('click', (e) => {
  if (e.target.closest('.testimonial-card')) {
    const id = e.target.closest('.testimonial-card').dataset.id;
    // Fetch testimonial details (mocked here)
    const testimonial = {
      id,
      title: 'Sample Testimonial',
      user_name: 'John Doe',
      location: 'New York, USA',
      created_at: new Date().toISOString(),
      rating: 4,
      body: 'This is a sample testimonial body that describes the experience with PrudentProExchange.',
      media: [{ url: 'assets/images/sample.jpg', type: 'image/jpeg' }],
      upvotes: 10,
    };
    openLightbox(testimonial);
  }
});

document.addEventListener('click', async (e) => {
  if (e.target.closest('.upvote-btn')) {
    const id = e.target.closest('.upvote-btn').dataset.id;
    try {
      await fetch(`/api/testimonials/${id}/upvote`, { method: 'POST' });
      const countElement = e.target.closest('.upvote-btn').querySelector('.upvote-count');
      countElement.textContent = parseInt(countElement.textContent) + 1;
    } catch (error) {
      console.error('Error upvoting:', error);
    }
  }
});

document.addEventListener('click', async (e) => {
  if (e.target.closest('.flag-btn')) {
    const id = e.target.closest('.flag-btn').dataset.id;
    const reason = prompt('Please provide a reason for flagging this testimonial:');
    if (reason) {
      try {
        await fetch(`/api/testimonials/${id}/flag`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason }),
        });
        alert('Testimonial flagged for moderation.');
      } catch (error) {
        console.error('Error flagging:', error);
      }
    }
  }
});

// Initial Load
loadTestimonials();

// Scroll to Form
function scrollToForm() {
  document.getElementById('testimonial-form').scrollIntoView({ behavior: 'smooth' });
}
