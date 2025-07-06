// Initialize Supabase client
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'YOUR_SUPABASE_URL'; // Replace with your Supabase project URL
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY'; // Replace with your Supabase anon key
const supabase = createClient(supabaseUrl, supabaseKey);

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
  const title = formData.get('title');
  const body = formData.get('body');
  const user_name = formData.get('user_name');
  const location = formData.get('location');
  const rating = formData.get('rating');
  const files = formData.get('media');

  try {
    // Upload files to Supabase bucket
    const mediaUrls = [];
    if (files && files.length > 0) {
      for (const file of Array.from(files)) {
        if (file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/')) {
          const fileName = `${Date.now()}_${file.name}`;
          const { data, error } = await supabase.storage
            .from('celestial-testimonials')
            .upload(fileName, file, {
              cacheControl: '3600',
              upsert: false,
            });

          if (error) {
            console.error('File upload error:', error);
            throw new Error('Failed to upload media');
          }

          // Get public URL for the uploaded file
          const { data: urlData } = supabase.storage
            .from('celestial-testimonials')
            .getPublicUrl(fileName);

          mediaUrls.push({
            url: urlData.publicUrl,
            type: file.type,
          });
        }
      }
    }

    // Save testimonial data to Supabase database (assuming a 'testimonials' table)
    const { data, error } = await supabase
      .from('testimonials')
      .insert([
        {
          title: title || 'Testimonial',
          body,
          user_name,
          location,
          rating: parseInt(rating),
          media: mediaUrls,
          created_at: new Date().toISOString(),
          verified: true, // Assuming testimonials are auto-verified since email verification is removed
          upvotes: 0,
        },
      ]);

    if (error) {
      console.error('Database insertion error:', error);
      throw new Error('Failed to save testimonial');
    }

    alert('Testimonial submitted successfully!');
    testimonialForm.reset();
    mediaPreview.innerHTML = '';
    document.querySelectorAll('.char-counter').forEach((counter) => (counter.textContent = '0/' + counter.textContent.split('/')[1]));
    loadTestimonials(); // Refresh the testimonials gallery
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
    const { data: testimonials, error } = await supabase
      .from('testimonials')
      .select('*')
      .eq('verified', true)
      .ilike('location', `%${location}%`)
      .eq('rating', rating || rating)
      .order(sort || 'created_at', { ascending: sort === 'date-asc' })
      .range((page - 1) * limit, page * limit - 1);

    if (error) {
      console.error('Error fetching testimonials:', error);
      return;
    }

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

document.addEventListener('click', async (e) => {
  if (e.target.closest('.testimonial-card')) {
    const id = e.target.closest('.testimonial-card').dataset.id;
    const { data: testimonial, error } = await supabase
      .from('testimonials')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching testimonial:', error);
      return;
    }

    openLightbox(testimonial);
  }
});

document.addEventListener('click', async (e) => {
  if (e.target.closest('.upvote-btn')) {
    const id = e.target.closest('.upvote-btn').dataset.id;
    try {
      const { data, error } = await supabase
        .from('testimonials')
        .update({ upvotes: supabase.raw('upvotes + 1') })
        .eq('id', id);

      if (error) {
        console.error('Error upvoting:', error);
        return;
      }

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
        const { error } = await supabase
          .from('flagged_testimonials')
          .insert([{ testimonial_id: id, reason, created_at: new Date().toISOString() }]);

        if (error) {
          console.error('Error flagging:', error);
          return;
        }

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
