// testimonials.js

// Initialize Supabase client
const supabase = Supabase.createClient('YOUR_SUPABASE_URL', 'YOUR_ANON_KEY');

// DOM Elements
const form = document.getElementById('testimonialForm');
const titleInput = form.querySelector('input[name="title"]');
const bodyInput = form.querySelector('textarea[name="body"]');
const titleCount = document.getElementById('titleCount');
const bodyCount = document.getElementById('bodyCount');
const mediaInput = document.getElementById('media');
const mediaPreview = document.getElementById('mediaPreview');
const testimonialsContainer = document.getElementById('testimonialsContainer');
const loadMoreBtn = document.getElementById('loadMore');
const ratingFilter = document.getElementById('ratingFilter');
const sortBy = document.getElementById('sortBy');
const modal = document.getElementById('detailModal');
const modalContent = document.getElementById('modalContent');
const closeModal = document.querySelector('.close');
const reviewerOfMonth = document.getElementById('reviewerOfMonth');

let page = 1;
const limit = 9;

// Character Counters
titleInput.addEventListener('input', () => {
  titleCount.textContent = `${titleInput.value.length}/100`;
});
bodyInput.addEventListener('input', () => {
  bodyCount.textContent = `${bodyInput.value.length}/1000`;
});

// Media Preview
mediaInput.addEventListener('change', () => {
  mediaPreview.innerHTML = '';
  Array.from(mediaInput.files).forEach(file => {
    const url = URL.createObjectURL(file);
    const type = file.type.split('/')[0];
    let element;
    if (type === 'image') {
      element = `<img src="${url}" alt="Preview"/>`;
    } else if (type === 'video') {
      element = `<video src="${url}" controls></video>`;
    } else if (type === 'audio') {
      element = `<audio src="${url}" controls></audio>`;
    }
    mediaPreview.innerHTML += element;
  });
});

// Form Submission
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(form);
  const data = {
    user_name: formData.get('name'),
    user_email: formData.get('email'),
    location: formData.get('location'),
    title: formData.get('title'),
    body: formData.get('body'),
    rating: parseInt(formData.get('rating')),
    media: [],
    verified: false,
    upvotes: 0,
  };

  const mediaFiles = formData.getAll('media');
  for (const file of mediaFiles) {
    const { data: uploadData, error } = await supabase.storage
      .from('testimonials-media')
      .upload(`public/${Date.now()}_${file.name}`, file);
    if (error) {
      console.error('Media upload error:', error);
      return;
    }
    data.media.push({ url: uploadData.path, type: file.type });
  }

  const { error } = await supabase.from('testimonials').insert([data]);
  if (error) {
    console.error('Submission error:', error);
  } else {
    alert('Testimonial submitted! Please check your email to verify.');
    form.reset();
    mediaPreview.innerHTML = '';
    titleCount.textContent = '0/100';
    bodyCount.textContent = '0/1000';
    // Trigger email via Brevo (placeholder for later implementation)
  }
});

// Fetch Testimonials
async function fetchTestimonials(reset = false) {
  if (reset) page = 1;
  let query = supabase.from('testimonials').select('*').eq('verified', true);

  if (ratingFilter.value) query = query.eq('rating', ratingFilter.value);
  if (sortBy.value === 'mostHelpful') query = query.order('upvotes', { ascending: false });
  else query = query.order('created_at', { ascending: false });

  const { data, error } = await query.range((page - 1) * limit, page * limit - 1);
  if (error) {
    console.error('Fetch error:', error);
    return;
  }

  if (reset) testimonialsContainer.innerHTML = '';
  data.forEach(testimonial => {
    const card = document.createElement('article');
    card.className = 'testimonial-card';
    card.setAttribute('itemscope', '');
    card.setAttribute('itemtype', 'https://schema.org/Review');
    card.innerHTML = `
      ${testimonial.media[0] ? `<img src="${supabase.storage.from('testimonials-media').getPublicUrl(testimonial.media[0].url).data.publicUrl}" alt="${testimonial.title}" itemprop="image"/>` : ''}
      <h3 itemprop="name">${testimonial.title}</h3>
      <p itemprop="reviewBody">${testimonial.body.substring(0, 100)}...</p>
      <div class="rating" itemprop="reviewRating" itemscope itemtype="https://schema.org/Rating">
        <span itemprop="ratingValue">${testimonial.rating}</span> ★
      </div>
      <div class="upvote" data-id="${testimonial.id}">
        <i class="fas fa-thumbs-up"></i> <span>${testimonial.upvotes}</span>
      </div>
      <div class="share">
        <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(testimonial.body.substring(0, 100))}" target="_blank" aria-label="Share on Twitter"><i class="fab fa-twitter"></i></a>
        <a href="https://linkedin.com/shareArticle?mini=true&url=${window.location.href}" target="_blank" aria-label="Share on LinkedIn"><i class="fab fa-linkedin"></i></a>
        <a href="https://facebook.com/sharer/sharer.php?u=${window.location.href}" target="_blank" aria-label="Share on Facebook"><i class="fab fa-facebook"></i></a>
      </div>
    `;
    card.addEventListener('click', () => showDetailView(testimonial));
    testimonialsContainer.appendChild(card);
  });

  loadMoreBtn.style.display = data.length < limit ? 'none' : 'block';
}

// Up-vote Functionality
testimonialsContainer.addEventListener('click', async (e) => {
  if (e.target.classList.contains('fa-thumbs-up')) {
    const id = e.target.parentElement.dataset.id;
    const { data, error } = await supabase.rpc('increment_upvote', { row_id: id });
    if (!error) {
      const span = e.target.nextElementSibling;
      span.textContent = parseInt(span.textContent) + 1;
    }
  }
});

// Detail View
function showDetailView(testimonial) {
  modalContent.innerHTML = `
    ${testimonial.media.map(m => `<${m.type.startsWith('image') ? 'img' : m.type.startsWith('video') ? 'video controls' : 'audio controls'} src="${supabase.storage.from('testimonials-media').getPublicUrl(m.url).data.publicUrl}" alt="${testimonial.title}"/>`).join('')}
    <h3 itemprop="name">${testimonial.title}</h3>
    <p itemprop="reviewBody">${testimonial.body}</p>
    <div class="rating" itemprop="reviewRating" itemscope itemtype="https://schema.org/Rating">
      <span itemprop="ratingValue">${testimonial.rating}</span> ★
    </div>
    <p>By: <span itemprop="author">${testimonial.user_name}</span>, ${testimonial.location}</p>
    <div class="upvote" data-id="${testimonial.id}">
      <i class="fas fa-thumbs-up"></i> <span>${testimonial.upvotes}</span>
    </div>
  `;
  modal.style.display = 'block';
}

closeModal.addEventListener('click', () => modal.style.display = 'none');
window.addEventListener('click', (e) => {
  if (e.target === modal) modal.style.display = 'none';
});

// Reviewer of the Month
async function fetchReviewerOfMonth() {
  const { data } = await supabase.from('testimonials')
    .select('*')
    .eq('verified', true)
    .order('upvotes', { ascending: false })
    .limit(1);
  if (data && data[0]) {
    reviewerOfMonth.innerHTML = `
      <h3>${data[0].title}</h3>
      <p>${data[0].body.substring(0, 100)}...</p>
      <p>By: ${data[0].user_name} - ${data[0].upvotes} Upvotes</p>
    `;
  }
}

// Event Listeners
loadMoreBtn.addEventListener('click', () => {
  page++;
  fetchTestimonials();
});

ratingFilter.addEventListener('change', () => fetchTestimonials(true));
sortBy.addEventListener('change', () => fetchTestimonials(true));

// Initial Load
fetchTestimonials();
fetchReviewerOfMonth();

// Page Functionality (from About page)
const btn = document.getElementById('hamburgerBtn');
const drawer = document.getElementById('navDrawer');
btn.addEventListener('click', () => {
  drawer.classList.toggle('open');
  btn.classList.toggle('active');
});

function updateTimes() {
  const now = new Date();
  document.getElementById('localTime').textContent = now.toLocaleTimeString();
  document.getElementById('localDate').textContent = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  document.getElementById('utcTime').textContent = now.toUTCString();
}
setInterval(updateTimes, 1000);
updateTimes();

document.getElementById('theme-toggle').addEventListener('click', () => {
  document.body.classList.toggle('light-theme');
  const icon = document.querySelector('#theme-toggle i');
  icon.classList.toggle('fa-moon');
  icon.classList.toggle('fa-sun');
});

document.getElementById('back-to-top').addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

AOS.init({ duration: 800, once: true });
