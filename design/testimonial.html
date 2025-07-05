// Form Submission
const testimonialForm = document.getElementById('testimonialForm');
testimonialForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(testimonialForm);
  try {
    const response = await fetch('/api/testimonials', {
      method: 'POST',
      body: formData,
    });
    if (response.ok) {
      alert('Testimonial submitted successfully! Please check your email to verify.');
      testimonialForm.reset();
      document.getElementById('mediaPreview').innerHTML = '';
      updateCharCounts();
    } else {
      alert('Failed to submit testimonial.');
    }
  } catch (error) {
    console.error('Error submitting testimonial:', error);
    alert('An error occurred while submitting the testimonial.');
  }
});

// Media Previews
const mediaInput = document.getElementById('media');
const mediaPreview = document.getElementById('mediaPreview');
mediaInput.addEventListener('change', () => {
  mediaPreview.innerHTML = '';
  const files = mediaInput.files;
  for (const file of files) {
    const previewItem = document.createElement('div');
    previewItem.classList.add('media-preview-item');
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement('img');
        img.src = e.target.result;
        img.alt = `Preview of ${file.name}`;
        previewItem.appendChild(img);
        mediaPreview.appendChild(previewItem);
      };
      reader.readAsDataURL(file);
    } else {
      previewItem.textContent = file.name;
      mediaPreview.appendChild(previewItem);
    }
  }
});

// Character Counters
const titleInput = document.getElementById('title');
const bodyInput = document.getElementById('body');
const titleCount = document.getElementById('titleCount');
const bodyCount = document.getElementById('bodyCount');

function updateCharCounts() {
  titleCount.textContent = `${titleInput.value.length}/100`;
  bodyCount.textContent = `${bodyInput.value.length}/1000`;
}

titleInput.addEventListener('input', updateCharCounts);
bodyInput.addEventListener('input', updateCharCounts);
updateCharCounts();

// Fetch Testimonials
const testimonialsContainer = document.querySelector('.testimonials-container');
let currentPage = 1;

async function fetchTestimonials(page = 1, limit = 10, filters = {}) {
  const queryParams = new URLSearchParams({
    page,
    limit,
    verified: true,
    ...filters,
  });
  const response = await fetch(`/api/testimonials?${queryParams}`);
  return await response.json();
}

function renderTestimonials(testimonials) {
  testimonials.forEach((testimonial) => {
    const card = document.createElement('article');
    card.classList.add('testimonial-card');
    card.setAttribute('itemscope', '');
    card.setAttribute('itemtype', 'https://schema.org/Review');
    card.setAttribute('role', 'listitem');
    card.innerHTML = `
      ${testimonial.media.length > 0 ? `<img src="${testimonial.media[0].url}" alt="Testimonial media" itemprop="image" loading="lazy">` : ''}
      <h3 itemprop="name">${testimonial.title || 'Testimonial'}</h3>
      <p itemprop="reviewBody">${testimonial.body.substring(0, 100)}...</p>
      <div class="rating" itemprop="reviewRating" itemscope itemtype="https://schema.org/Rating">
        <span itemprop="ratingValue">${testimonial.rating}</span> stars
      </div>
      <p>By <span itemprop="author">${testimonial.user_name}</span> from <span itemprop="location">${testimonial.location || 'Unknown'}</span></p>
      <button class="upvote-btn" data-id="${testimonial.id}" aria-label="Upvote (${testimonial.upvotes})">Upvote (<span class="upvote-count">${testimonial.upvotes}</span>)</button>
    `;
    testimonialsContainer.appendChild(card);
  });
}

// Load Initial Testimonials
fetchTestimonials().then(renderTestimonials);

// Load More
const loadMoreBtn = document.getElementById('loadMore');
loadMoreBtn.addEventListener('click', async () => {
  currentPage++;
  const testimonials = await fetchTestimonials(currentPage, 10, getFilters());
  renderTestimonials(testimonials);
});

// Filters
const ratingFilter = document.getElementById('ratingFilter');
const locationFilter = document.getElementById('locationFilter');
const sortBy = document.getElementById('sortBy');

function getFilters() {
  return {
    rating: ratingFilter.value,
    location: locationFilter.value,
    sort: sortBy.value,
  };
}

async function applyFilters() {
  currentPage = 1;
  testimonialsContainer.innerHTML = '';
  const testimonials = await fetchTestimonials(1, 10, getFilters());
  renderTestimonials(testimonials);
}

ratingFilter.addEventListener('change', applyFilters);
locationFilter.addEventListener('change', applyFilters);
sortBy.addEventListener('change', applyFilters);

// Populate Locations
async function fetchLocations() {
  // Placeholder: Replace with actual API call if available
  const response = await fetch('/api/testimonials');
  const testimonials = await response.json();
  const locations = [...new Set(testimonials.map((t) => t.location).filter(Boolean))];
  return locations;
}

async function populateLocationFilter() {
  const locations = await fetchLocations();
  locations.forEach((location) => {
    const option = document.createElement('option');
    option.value = location;
    option.textContent = location;
    locationFilter.appendChild(option);
  });
}

populateLocationFilter();

// Detail View Modal
const modal = document.getElementById('testimonialModal');
const closeModal = document.querySelector('.modal .close');

testimonialsContainer.addEventListener('click', async (e) => {
  const card = e.target.closest('.testimonial-card');
  if (card && !e.target.classList.contains('upvote-btn')) {
    const id = card.querySelector('.upvote-btn').dataset.id;
    const response = await fetch(`https://api.example.com/testimonials/${id}`); // Replace with your API
    const testimonial = await response.json();
    document.getElementById('modalTitle').textContent = testimonial.title || 'Testimonial';
    document.getElementById('modalBody').textContent = testimonial.body;
    document.getElementById('modalRating').textContent = `${testimonial.rating} stars`;
    document.getElementById('modalAuthor').textContent = testimonial.user_name;
    document.getElementById('modalLocation').textContent = testimonial.location || 'Unknown';
    document.getElementById('modalDate').textContent = new Date(testimonial.created_at).toLocaleDateString();
    document.getElementById('modalUpvoteCount').textContent = testimonial.upvotes;
    document.getElementById('modalUpvoteBtn').dataset.id = id;

    const carousel = document.querySelector('.media-carousel');
    carousel.innerHTML = '';
    testimonial.media.forEach((media) => {
      if (media.type.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = media.url;
        img.alt = 'Testimonial media';
        img.loading = 'lazy';
        carousel.appendChild(img);
      } else if (media.type.startsWith('video/')) {
        const video = document.createElement('video');
        video.src = media.url;
        video.controls = true;
        carousel.appendChild(video);
      } else if (media.type.startsWith('audio/')) {
        const audio = document.createElement('audio');
        audio.src = media.url;
        audio.controls = true;
        carousel.appendChild(audio);
      }
    });

    const url = `${window.location.origin}/testimonials?id=${id}`;
    document.getElementById('shareTwitter').href = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(testimonial.title || 'Testimonial')}`;
    document.getElementById('shareLinkedIn').href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
    document.getElementById('shareFacebook').href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;

    modal.style.display = 'block';
    modal.setAttribute('aria-hidden', 'false');
    closeModal.focus();
  }
});

closeModal.addEventListener('click', () => {
  modal.style.display = 'none';
  modal.setAttribute('aria-hidden', 'true');
});

window.addEventListener('click', (e) => {
  if (e.target === modal) {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
  }
});

modal.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
  }
});

// Upvote Functionality
async function handleUpvote(id, countElement) {
  try {
    const response = await fetch(`/api/testimonials/${id}/upvote`, { method: 'POST' });
    if (response.ok) {
      const data = await response.json();
      countElement.textContent = data.upvotes;
    } else {
      alert('Failed to upvote.');
    }
  } catch (error) {
    console.error('Error upvoting:', error);
  }
}

testimonialsContainer.addEventListener('click', (e) => {
  if (e.target.classList.contains('upvote-btn')) {
    const id = e.target.dataset.id;
    const countElement = e.target.querySelector('.upvote-count');
    handleUpvote(id, countElement);
  }
});

document.getElementById('modalUpvoteBtn').addEventListener('click', () => {
  const id = document.getElementById('modalUpvoteBtn').dataset.id;
  const countElement = document.getElementById('modalUpvoteCount');
  handleUpvote(id, countElement);
});

// Hamburger Menu
const hamburgerBtn = document.getElementById('hamburgerBtn');
const navDrawer = document.getElementById('navDrawer');
hamburgerBtn.addEventListener('click', () => {
  navDrawer.classList.toggle('open');
  hamburgerBtn.classList.toggle('active');
});

// Time and Date
function updateLocalTime() {
  const now = new Date();
  document.getElementById('localTime').textContent = now.toLocaleTimeString();
  document.getElementById('localDate').textContent = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
setInterval(updateLocalTime, 1000);
updateLocalTime();

function updateUTCTime() {
  document.getElementById('utcTime').textContent = new Date().toUTCString();
}
setInterval(updateUTCTime, 1000);
updateUTCTime();

// Theme Toggle
const themeToggle = document.getElementById('theme-toggle');
themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('light-theme');
  const icon = themeToggle.querySelector('i');
  icon.classList.toggle('fa-moon');
  icon.classList.toggle('fa-sun');
});

// Video Playback Optimization
document.addEventListener('DOMContentLoaded', () => {
  const video = document.querySelector('.bg-video');
  let retryCount = 0;
  const maxRetries = 3;
  const retryDelay = 1000;

  if (video) {
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
          }
        });
    };

    playVideo();

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && video.paused) {
        playVideo();
      } else {
        video.pause();
      }
    });

    const forcePlayOnInteraction = () => {
      if (video.paused) {
        playVideo();
      }
    };

    window.addEventListener('scroll', forcePlayOnInteraction, { once: true });
    window.addEventListener('click', forcePlayOnInteraction, { once: true });
  }

  AOS.init({ duration: 800, once: true });
});
