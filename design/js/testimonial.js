// Simulated database for testimonials
let testimonials = [];

// Form submission
document.getElementById('testimonialForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('name').value;
    const text = document.getElementById('text').value;
    const image = document.getElementById('image').files[0];
    const video = document.getElementById('video').value;
    const tags = document.getElementById('tags').value.split(',').map(tag => tag.trim());
    const rating = document.getElementById('rating').value;

    // Form validation
    if (!name || !text || !rating) {
        document.getElementById('feedback').innerHTML = '<p style="color: red;">Please fill all required fields.</p>';
        return;
    }

    // Simulate image upload
    let imageUrl = '';
    if (image) {
        imageUrl = URL.createObjectURL(image); // In production, upload to a server
    }

    const testimonial = {
        name,
        text,
        imageUrl,
        video,
        tags,
        rating,
        approved: false // Pending admin approval
    };

    // Simulate sending to admin (in reality, send to a backend)
    testimonials.push(testimonial);
    document.getElementById('feedback').innerHTML = '<p style="color: green;">Testimonial submitted! Awaiting approval.</p>';
    e.target.reset();

    // Simulate admin approval after 2 seconds (replace with real backend logic)
    setTimeout(() => approveTestimonial(testimonial), 2000);
});

// Function to approve testimonial (admin action)
function approveTestimonial(testimonial) {
    testimonial.approved = true;
    displayTestimonials();
}

// Display approved testimonials
function displayTestimonials() {
    const container = document.getElementById('testimonialsContainer');
    container.innerHTML = '';

    const approved = testimonials.filter(t => t.approved);
    approved.forEach(t => {
        const card = document.createElement('div');
        card.className = 'testimonial-card';

        card.innerHTML = `
            <h3>${t.name}</h3>
            <p>${t.text}</p>
            ${t.imageUrl ? `<img src="${t.imageUrl}" alt="Testimonial Image">` : ''}
            ${t.video ? `<video controls src="${t.video}"></video>` : ''}
            <p>Rating: ${'★'.repeat(t.rating)}${'☆'.repeat(5 - t.rating)}</p>
            <div class="tags">${t.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div>
            <button class="share-btn" onclick="shareTestimonial('${t.name}', '${t.text}')">Share</button>
        `;
        container.appendChild(card);
    });
}

// Unique Feature: Share on Social Media
function shareTestimonial(name, text) {
    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out ${name}'s testimonial: ${text}`)}`;
    window.open(shareUrl, '_blank');
}

// Unique Feature: Live Updates (Simulated with polling)
setInterval(() => {
    if (testimonials.some(t => t.approved)) {
        displayTestimonials();
    }
}, 5000);

// Initial display
displayTestimonials();
