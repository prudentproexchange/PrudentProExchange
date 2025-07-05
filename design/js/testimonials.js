// Initialize Supabase client
const supabase = Supabase.createClient('YOUR_SUPABASE_URL', 'YOUR_SUPABASE_ANON_KEY');

// DOM Elements
const testimonialsGrid = document.getElementById('testimonials-grid');
const loadMoreBtn = document.getElementById('load-more');
const testimonialForm = document.getElementById('testimonial-form');
const mediaInput = document.getElementById('media');
const mediaPreview = document.getElementById('media-preview');
const ratingFilter = document.getElementById('rating-filter');
const locationFilter = document.getElementById('location-filter');
const sortBy = document.getElementById('sort-by');
const verifiedFilter = document.getElementById('verified-filter');
const lightbox = document.getElementById('lightbox');
const lightboxClose = document.querySelector('.close-btn');
const lightboxMedia = document.getElementById('lightbox-media');
const lightboxTitle = document.getElementById('lightbox-title');
const lightboxBody = document.getElementById('lightbox-body');
const lightboxAuthor = document.getElementById('lightbox-author');
const lightboxLocation = document.getElementById('lightbox-location');
const lightboxDate = document.getElementById('lightbox-date');
const lightboxRating = document.getElementById('lightbox-rating');
const lightboxUpvote = document.getElementById('lightbox-upvote');
const lightboxUpvoteCount = document.getElementById('lightbox-upvote-count');
const lightboxTwitter = document.getElementById('lightbox-twitter');
const lightboxLinkedin = document.getElementById('lightbox-linkedin');
const lightboxFacebook = document.getElementById('lightbox-facebook');
const titleInput = document.getElementById('title');
const bodyInput = document.getElementById('body');
const challengeInput = document.getElementById('challenge');
const solutionInput = document.getElementById('solution');
const outcomeInput = document.getElementById('outcome');
const extraFields = document.getElementById('extra-fields');

// Pagination
let currentPage = 1;
const limit = 6;

// Initialize AOS
AOS.init({ duration: 800, once: true });

// Video Playback Optimization
document.addEventListener('DOMContentLoaded', () => {
  const video = document.querySelector('.bg-video');
  let retryCount = 0;
  const maxRetries = 3;
  const retryDelay = 1000;

  if (video) {
    const playVideo = () => {
      video.play()
        .then(() => console.log('Background video playing'))
        .catch(error => {
          console.error(`Video play failed (attempt ${retryCount + 1}):`, error);
          if (retryCount < maxRetries) {
            retryCount++;
            setTimeout(playVideo, retryDelay);
          }
        });
    };
    playVideo();

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        if (video.paused) playVideo();
      } else {
        video.pause();
      }
    });

    const forcePlay = () => {
      if (video.paused) playVideo();
    };
    window.addEventListener('scroll', forcePlay, { once: true });
    window.addEventListener('click', forcePlay, { once: true });
  }

  // Hamburger Menu
  const btn = document.getElementById('hamburgerBtn');
  const drawer = document.getElementById('navDrawer');
  btn.addEventListener('click', () => {
    drawer.classList.toggle('open');
    btn.classList.toggle('active');
  });

  // Theme Toggle
  document.getElementById('theme-toggle').addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const icon = document.getElementById('theme-toggle').querySelector('i');
    icon.classList.toggle('fa-moon');
    icon.classList.toggle('fa-sun');
  });

  // Back to Top
  document.getElementById('back-to-top').addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Time Updates
  function updateTime() {
    const now = new Date();
    document.getElementById('localTime').textContent = now.toLocaleTimeString();
    document.getElementById('localDate').textContent = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('utcTime').textContent = now.toUTCString();
  }
  setInterval(updateTime, 1000);
  updateTime();
});

// Fetch Testimonials
async function fetchTestimonials(page = 1, filters = {}) {
  let query = supabase
    .from('testimonials')
    .select('*')
    .range((page - 1) * limit, page * limit - 1);

  if (filters.rating) query = query.eq('rating', filters.rating);
  if (filters.location) query = query.ilike('location', `%${filters.location}%`);
  if (filters.verified) query = query.eq('verified', true);
  if (filters.sort === 'most-helpful') query = query.order('upvotes', { ascending: false });
  else query = query.order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching testimonials:', error);
    return [];
  }
  return data;
}

// Render Testimonials
function renderTestimonials(testimonials) {
  testimonials.forEach(testimonial => {
    const card = document.createElement('article');
    card.classList.add('testimonial-card');
    card.setAttribute('itemscope', '');
    card.setAttribute('itemtype', 'https://schema.org/Review');
    card.dataset.id = testimonial.id;

    const mediaHtml = testimonial.media && testimonial.media.length > 0
      ? `<div class="testimonial-media">
           <img src="${testimonial.media[0].url}" alt="Testimonial media" itemprop="image" />
         </div>`
      : '';

    const stars = '★'.repeat(testimonial.rating) + '☆'.repeat(5 - testimonial.rating);

    card.innerHTML = `
      ${mediaHtml}
      <div class="testimonial-content">
        <h3 class="testimonial-title" itemprop="name">${testimonial.title || 'Testimonial'}</h3>
        <p class="testimonial-body" itemprop="reviewBody">${testimonial.body.substring(0, 100)}...</p>
        <div class="testimonial-meta">
          <span class="testimonial-author" itemprop="author">${testimonial.user_name}</span>
          <span class="testimonial-location">${testimonial.location}</span>
          <time datetime="${testimonial.created_at}" itemprop="datePublished">${new Date(testimonial.created_at).toLocaleDateString()}</time>
          <div class="testimonial-rating" itemprop="reviewRating" itemscope itemtype="https://schema.org/Rating">
            <span class="stars" aria-label="${testimonial.rating} stars">${stars}</span>
            <meta itemprop="ratingValue" content="${testimonial.rating}" />
            <meta itemprop="bestRating" content="5" />
            <meta itemprop="worstRating" content="1" />
          </div>
        </div>
        <div class="testimonial-actions">
          <button class="upvote-btn" data-id="${testimonial.id}" aria-label="Upvote this testimonial">
            <i class="fas fa-thumbs-up"></i> <span class="upvote-count">${testimonial.upvotes}</span>
          </button>
          <div class="share-buttons">
            <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(testimonial.title || 'Testimonial')}&url=https://prudentproexchange.com/testimonials" target="_blank" aria-label="Share on Twitter"><i class="fab fa-twitter"></i></a>
            <a href="https://www.linkedin.com/shareArticle?url=https://prudentproexchange.com/testimonials" target="_blank" aria-label="Share on LinkedIn"><i class="fab fa-linkedin"></i></a>
            <a href="https://www.facebook.com/sharer/sharer.php?u=https://prudentproexchange.com/testimonials" target="_blank" aria-label="Share on Facebook"><i class="fab fa-facebook"></i></a>
          </div>
        </div>
      </div>
    `;
    card.addEventListener('click', () => openLightbox(testimonial));
    testimonialsGrid.appendChild(card);
  });
  AOS.refresh();
}

// Load More Testimonials
loadMoreBtn.addEventListener('click', async () => {
  currentPage++;
  const filters = {
    rating: ratingFilter.value,
    location: locationFilter.value,
    verified: verifiedFilter.checked,
    sort: sortBy.value
  };
  const testimonials = await fetchTestimonials(currentPage, filters);
  if (testimonials.length < limit) loadMoreBtn.style.display = 'none';
  renderTestimonials(testimonials);
});

// Filter Testimonials
async function applyFilters() {
  currentPage = 1;
  testimonialsGrid.innerHTML = '';
  loadMoreBtn.style.display = 'block';
  const filters = {
    rating: ratingFilter.value,
    location: locationFilter.value,
    verified: verifiedFilter.checked,
    sort: sortBy.value
  };
  const testimonials = await fetchTestimonials(currentPage, filters);
  renderTestimonials(testimonials);
}

ratingFilter.addEventListener('change', applyFilters);
locationFilter.addEventListener('input', debounce(applyFilters, 500));
sortBy.addEventListener('change', applyFilters);
verifiedFilter.addEventListener('change', applyFilters);

// Open Lightbox
function openLightbox(testimonial) {
  lightboxMedia.innerHTML = testimonial.media && testimonial.media.length > 0
    ? `<img src="${testimonial.media[0].url}" alt="Testimonial media" />`
    : '';
  lightboxTitle.textContent = testimonial.title || 'Testimonial';
  lightboxBody.textContent = testimonial.body;
  lightboxAuthor.textContent = testimonial.user_name;
  lightboxLocation.textContent = testimonial.location;
  lightboxDate.textContent = new Date(testimonial.created_at).toLocaleDateString();
  lightboxDate.setAttribute('datetime', testimonial.created_at);
  lightboxRating.innerHTML = `<span class="stars" aria-label="${testimonial.rating} stars">${'★'.repeat(testimonial.rating) + '☆'.repeat(5 - testimonial.rating)}</span>`;
  lightboxUpvote.dataset.id = testimonial.id;
  lightboxUpvoteCount.textContent = testimonial.upvotes;
  lightboxTwitter.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(testimonial.title || 'Testimonial')}&url=https://prudentproexchange.com/testimonials`;
  lightboxLinkedin.href = 'https://www.linkedin.com/shareArticle?url=https://prudentproexchange.com/testimonials';
  lightboxFacebook.href = 'https://www.facebook.com/sharer/sharer.php?u=https://prudentproexchange.com/testimonials';
  lightbox.style.display = 'flex';
  lightbox.setAttribute('aria-hidden', 'false');
}

lightboxClose.addEventListener('click', () => {
  lightbox.style.display = 'none';
  lightbox.setAttribute('aria-hidden', 'true');
});

// Media Preview
mediaInput.addEventListener('change', () => {
  mediaPreview.innerHTML = '';
  Array.from(mediaInput.files).forEach(file => {
    const url = URL.createObjectURL(file);
    const type = file.type.split('/')[0];
    let element;
    if (type === 'image') {
      element = document.createElement('img');
      element.src = url;
    } else if (type === 'video') {
      element = document.createElement('video');
      element.src = url;
      element.controls = true;
    } else if (type === 'audio') {
      element = document.createElement('audio');
      element.src = url;
      element.controls = true;
    }
    mediaPreview.appendChild(element);
  });
});

// Progressive Disclosure
bodyInput.addEventListener('input', () => {
  if (bodyInput.value.length > 50) {
    extraFields.style.display = 'block';
    AOS.refresh();
  }
});

// Character Counters
function updateCharCount(input, countElement, max) {
  countElement.textContent = `${input.value.length}/${max}`;
}

titleInput.addEventListener('input', () => updateCharCount(titleInput, document.getElementById('title-count'), 100));
bodyInput.addEventListener('input', () => updateCharCount(bodyInput, document.getElementById('body-count'), 1000));
challengeInput.addEventListener('input', () => updateCharCount(challengeInput, document.getElementById('challenge-count'), 500));
solutionInput.addEventListener('input', () => updateCharCount(solutionInput, document.getElementById('solution-count'), 500));
outcomeInput.addEventListener('input', () => updateCharCount(outcomeInput, document.getElementById('outcome-count'), 500));

// Form Submission
testimonialForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(testimonialForm);
  const mediaFiles = mediaInput.files;
  const media = [];

  // Upload media to Supabase Storage
  for (const file of mediaFiles) {
    const { data, error } = await supabase.storage
      .from('testimonial-media')
      .upload(`public/${Date.now()}_${file.name}`, file);
    if (error) {
      console.error('Media upload error:', error);
      alert('Failed to upload media.');
      return;
    }
    media.push({ url: data.path, mime: file.type });
  }

  // Submit testimonial
  const { data, error } = await supabase
    .from('testimonials')
    .insert({
      user_name: formData.get('user_name'),
      user_email: formData.get('user_email'),
      location: formData.get('location'),
      title: formData.get('title'),
      body: formData.get('body'),
      rating: parseInt(formData.get('rating')),
      media,
      verified: false,
      upvotes: 0
    });

  if (error) {
    console.error('Submission error:', error);
    alert('Failed to submit testimonial.');
    return;
  }

  // Send verification email (Brevo integration placeholder)
  alert('Testimonial submitted! Please check your email for verification.');
  testimonialForm.reset();
  mediaPreview.innerHTML = '';
  extraFields.style.display = 'none';
});

// Upvote Handler
document.addEventListener('click', async (e) => {
  if (e.target.closest('.upvote-btn')) {
    const btn = e.target.closest('.upvote-btn');
    const id = btn.dataset.id;
    const { data, error } = await supabase
      .from('testimonials')
      .update({ upvotes: supabase.raw('upvotes + 1') })
      .eq('id', id);
    if (error) {
      console.error('Upvote error:', error);
      return;
    }
    const countElement = btn.querySelector('.upvote-count');
    countElement.textContent = parseInt(countElement.textContent) + 1;
  }
});

// Flag for Moderation
async function flagTestimonial(id, reason) {
  const { error } = await supabase
    .from('testimonial_flags')
    .insert({ testimonial_id: id, reason });
  if (error) {
    console.error('Flag error:', error);
    alert('Failed to flag testimonial.');
  } else {
    alert('Testimonial flagged for moderation.');
  }
}

// Debounce Utility
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Initial Load
applyFilters();
