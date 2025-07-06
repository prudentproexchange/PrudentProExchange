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
const BACKEND_URL = 'http://localhost:3000'; // Update to your deployed backend URL

function updateCharCounter(input, counter, max) {
  if (counter) {
    counter.textContent = `${input.value.length}/${max}`;
  }
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
    } else {
      console.warn(`Skipped file: ${file.name} (unsupported type: ${file.type})`);
    }
  });
}

testimonialForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(testimonialForm);
  const mediaFiles = mediaInput.files;
  const uploadedMedia = [];

  try {
    // Validate form inputs
    const requiredFields = ['title', 'user_name', 'location', 'body', 'rating', 'email'];
    for (const field of requiredFields) {
      if (!formData.get(field)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate file types and sizes
    const allowedTypes = ['image/jpeg', 'image/png', 'video/mp4', 'audio/mpeg'];
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    for (const file of mediaFiles) {
      if (!allowedTypes.includes(file.type)) {
        throw new Error(`Unsupported file type: ${file.type}`);
      }
      if (file.size > maxFileSize) {
        throw new Error(`File ${file.name} exceeds 10MB limit`);
      }
    }

    // Upload media files to Supabase bucket with retry logic
    for (const file of mediaFiles) {
      if (file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/')) {
        const fileExt = file.name.split('.').pop().toLowerCase();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
        let retryCount = 0;
        const maxRetries = 3;

        const uploadFile = async () => {
          try {
            console.log(`Requesting signed URL for ${fileName}`);
            const response = await fetch(`${BACKEND_URL}/api/upload-to-supabase`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                fileName,
                fileType: file.type,
                bucket: 'celestial-testimonials',
              }),
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(`Failed to get signed URL for ${fileName}: ${errorData.error || response.statusText}`);
            }

            const { signedUrl, publicUrl } = await response.json();
            if (!signedUrl || !publicUrl) {
              throw new Error(`Invalid response from /api/upload-to-supabase: missing signedUrl or publicUrl`);
            }

            console.log(`Uploading ${fileName} to Supabase`);
            const uploadResponse = await fetch(signedUrl, {
              method: 'PUT',
              body: file,
              headers: {
                'Content-Type': file.type,
              },
            });

            if (!uploadResponse.ok) {
              throw new Error(`Failed to upload ${fileName} to Supabase: ${uploadResponse.statusText}`);
            }

            uploadedMedia.push({
              url: publicUrl,
              type: file.type,
            });
          } catch (error) {
            if (retryCount < maxRetries) {
              retryCount++;
              console.warn(`Retrying upload for ${fileName} (attempt ${retryCount}/${maxRetries})`);
              await new Promise(resolve => setTimeout(resolve, 1000));
              return uploadFile();
            } else {
              throw error;
            }
          }
        };

        await uploadFile();
      }
    }

    // Append uploaded media URLs to formData
    formData.append('media', JSON.stringify(uploadedMedia));

    // Submit testimonial data to backend
    console.log('Submitting testimonial to backend');
    const submitResponse = await fetch(`${BACKEND_URL}/api/testimonials`, {
      method: 'POST',
      body: formData,
    });

    if (!submitResponse.ok) {
      const errorData = await submitResponse.json().catch(() => ({}));
      throw new Error(`Failed to submit testimonial: ${errorData.error || submitResponse.statusText}`);
    }

    const { id } = await submitResponse.json();

    // Trigger Brevo email in a non-blocking way
    console.log('Triggering Brevo email');
    fetch(`${BACKEND_URL}/api/send-brevo-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: formData.get('email'),
        name: formData.get('user_name'),
        testimonialId: id,
      }),
    }).catch((error) => {
      console.error('Brevo email sending failed:', error);
    });

    alert('Testimonial submitted successfully! Please check your email to verify.');
    testimonialForm.reset();
    mediaPreview.innerHTML = '';
    document.querySelectorAll('.char-counter').forEach((counter) => {
      if (counter) {
        counter.textContent = '0/' + counter.textContent.split('/')[1];
      }
    });
    // Reload testimonials
    page = 1;
    loadTestimonials();
  } catch (error) {
    console.error('Submission error:', error);
    alert(`Error submitting testimonial: ${error.message}. Please try again or contact support.`);
  }
});

// Testimonials Gallery
let page = 1;
const limit = 9;

async function loadTestimonials() {
  const rating = document.getElementById('rating-filter')?.value || '';
  const location = document.getElementById('location-filter')?.value || '';
  const sort = document.getElementById('sort-filter')?.value || '';

  try {
    console.log('Fetching testimonials:', { page, limit, rating, location, sort });
    const response = await fetch(`${BACKEND_URL}/api/testimonials?page=${page}&limit=${limit}&rating=${rating}&location=${location}&sort=${sort}&verified=true`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to load testimonials: ${errorData.error || response.statusText}`);
    }
    const testimonials = await response.json();
    const galleryGrid = document.getElementById('testimonials-grid');

    if (!galleryGrid) {
      throw new Error('Testimonials grid element not found');
    }

    if (page === 1) {
      galleryGrid.innerHTML = '';
    }

    if (testimonials.length === 0 && page === 1) {
      galleryGrid.innerHTML = '<p>No testimonials found.</p>';
      document.getElementById('load-more').style.display = 'none';
      return;
    }

    testimonials.forEach((testimonial) => {
      const mediaElement = testimonial.media && testimonial.media[0]
        ? testimonial.media[0].type.startsWith('image/')
          ? `<img src="${testimonial.media[0].url}" alt="${testimonial.title || 'Testimonial'}" />`
          : testimonial.media[0].type.startsWith('video/')
          ? `<video src="${testimonial.media[0].url}" controls></video>`
          : `<audio src="${testimonial.media[0].url}" controls></audio>`
        : '<p>No media</p>';
      const stars = '★'.repeat(testimonial.rating) + '☆'.repeat(5 - testimonial.rating);
      const card = `
        <article class="testimonial-card" itemscope itemtype="https://schema.org/Review" data-id="${testimonial.id}">
          ${mediaElement}
          <h3 itemprop="name">${testimonial.title || 'Testimonial'}</h3>
          <p class="reviewer-meta">
            <span itemprop="author">${testimonial.user_name || 'Anonymous'}</span>, 
            <span itemprop="location">${testimonial.location || 'Unknown'}</span> •
            <meta itemprop="datePublished" content="${testimonial.created_at}">
            ${new Date(testimonial.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
          <div class="review-rating" itemprop="reviewRating" itemscope itemtype="https://schema.org/Rating">
            <meta itemprop="ratingValue" content="${testimonial.rating}" />
            <meta itemprop="bestRating" content="5" />
            <span class="stars">${stars}</span>
          </div>
          <p itemprop="reviewBody">${testimonial.body ? testimonial.body.substring(0, 100) : ''}...</p>
          <div class="review-actions">
            <button class="upvote-btn" data-id="${testimonial.id}" aria-label="Upvote this testimonial">
              <i class="fas fa-heart"></i> <span class="upvote-count">${testimonial.upvotes || 0}</span>
            </button>
            <div class="share-buttons">
              <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(testimonial.title || 'Testimonial')}%20with%20PrudentProExchange" target="_blank" aria-label="Share on Twitter"><i class="fab fa-twitter"></i></a>
              <a href="https://www.linkedin.com/sharing/share-offsite/?url=https://prudentproexchange.com/testimonials" target="_blank" aria-label="Share on LinkedIn"><i class="fab fa-linkedin"></i></a>
              <a href="https://www.facebook.com/sharer/sharer.php?u=https://prudentproexchange.com/testimonials" target="_blank" aria-label="Share on Facebook"><i class="fab fa-facebook"></i></a>
            </div>
            <button class="flag-btn" data-id="${testimonial.id}" aria-label="Flag this testimonial">Flag</button>
          </div>
        </article>
      `;
      galleryGrid.innerHTML += card;
    });

    const loadMoreBtn = document.getElementById('load-more');
    if (loadMoreBtn) {
      loadMoreBtn.style.display = testimonials.length < limit ? 'none' : 'block';
    }
  } catch (error) {
    console.error('Error loading testimonials:', error);
    const galleryGrid = document.getElementById('testimonials-grid');
    if (galleryGrid && page === 1) {
      galleryGrid.innerHTML = '<p>Error loading testimonials. Please try again later or contact support.</p>';
    }
    alert(`Error loading testimonials: ${error.message}. Please try again or contact support.`);
  }
}

document.getElementById('load-more')?.addEventListener('click', () => {
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
  const mediaCarousel = testimonial.media && testimonial.media.length
    ? testimonial.media
        .map((media) =>
          media.type.startsWith('image/')
            ? `<img src="${media.url}" alt="${testimonial.title || 'Testimonial'}" />`
            : media.type.startsWith('video/')
            ? `<video src="${media.url}" controls></video>`
            : `<audio src="${media.url}" controls></audio>`
        )
        .join('')
    : '<p>No media available</p>';
  const stars = '★'.repeat(testimonial.rating) + '☆'.repeat(5 - testimonial.rating);
  const lightbox = document.createElement('div');
  lightbox.className = 'lightbox';
  lightbox.innerHTML = `
    <div class="lightbox-content">
      <button class="lightbox-close">✕</button>
      <div class="media-carousel">${mediaCarousel}</div>
      <h3>${testimonial.title || 'Testimonial'}</h3>
      <p class="reviewer-meta">${testimonial.user_name || 'Anonymous'}, ${testimonial.location || 'Unknown'} • ${new Date(testimonial.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
      <div class="review-rating">${stars}</div>
      <p>${testimonial.body || ''}</p>
      <div class="review-actions">
        <button class="upvote-btn" data-id="${testimonial.id}"><i class="fas fa-heart"></i> <span class="upvote-count">${testimonial.upvotes || 0}</span></button>
        <div class="share-buttons">
          <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(testimonial.title || 'Testimonial')}%20with%20PrudentProExchange" target="_blank"><i class="fab fa-twitter"></i></a>
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

document.addEventListener('click', async (e) => {
  if (e.target.closest('.testimonial-card')) {
    const id = e.target.closest('.testimonial-card').dataset.id;
    try {
      const response = await fetch(`${BACKEND_URL}/api/testimonials/${id}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to fetch testimonial: ${errorData.error || response.statusText}`);
      }
      const testimonial = await response.json();
      openLightbox(testimonial);
    } catch (error) {
      console.error('Error fetching testimonial:', error);
      alert(`Error loading testimonial details: ${error.message}. Please try again or contact support.`);
    }
  }
});

document.addEventListener('click', async (e) => {
  if (e.target.closest('.upvote-btn')) {
    const id = e.target.closest('.upvote-btn').dataset.id;
    try {
      const response = await fetch(`${BACKEND_URL}/api/testimonials/${id}/upvote`, { method: 'POST' });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to upvote: ${errorData.error || response.statusText}`);
      }
      const countElement = e.target.closest('.upvote-btn').querySelector('.upvote-count');
      countElement.textContent = parseInt(countElement.textContent) + 1;
    } catch (error) {
      console.error('Error upvoting:', error);
      alert(`Error upvoting testimonial: ${error.message}. Please try again or contact support.`);
    }
  }
});

document.addEventListener('click', async (e) => {
  if (e.target.closest('.flag-btn')) {
    const id = e.target.closest('.flag-btn').dataset.id;
    const reason = prompt('Please provide a reason for flagging this testimonial:');
    if (reason) {
      try {
        const response = await fetch(`${BACKEND_URL}/api/testimonials/${id}/flag`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason }),
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`Failed to flag: ${errorData.error || response.statusText}`);
        }
        alert('Testimonial flagged for moderation.');
      } catch (error) {
        console.error('Error flagging:', error);
        alert(`Error flagging testimonial: ${error.message}. Please try again or contact support.`);
      }
    }
  }
});

// Initial Load
loadTestimonials();

// Scroll to Form
function scrollToForm() {
  const form = document.getElementById('testimonial-form');
  if (form) {
    form.scrollIntoView({ behavior: 'smooth' });
  }
}
