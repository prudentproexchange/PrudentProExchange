const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.raw({ type: 'multipart/form-data', limit: '10mb' }));

const supabase = createClient(
  'YOUR_SUPABASE_URL',
  'YOUR_SUPABASE_ANON_KEY'
);

// POST /api/testimonials
app.post('/api/testimonials', async (req, res) => {
  const { name, email, location, title, body, rating } = req.body;
  const mediaFiles = req.files || [];

  try {
    // Upload media to Supabase storage
    const mediaUrls = await Promise.all(
      mediaFiles.map(async (file, index) => {
        const path = `${file.mimetype.startsWith('image') ? 'photos' : file.mimetype.startsWith('video') ? 'videos' : 'audio'}/${Date.now()}-${index}.${file.originalname.split('.').pop()}`;
        const { data, error } = await supabase.storage
          .from('celestial-testimonials')
          .upload(path, file.buffer, { contentType: file.mimetype });
        if (error) throw error;
        return { url: supabase.storage.from('celestial-testimonials').getPublicUrl(path).data.publicUrl, type: file.mimetype };
      })
    );

    // Insert testimonial
    const { data, error } = await supabase
      .from('testimonials')
      .insert([{ user_name: name, user_email: email, location, title, body, rating, media: mediaUrls, verified: false }])
      .select();
    if (error) throw error;

    // TODO: Send verification email via Brevo
    res.status(200).json(data[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to submit testimonial' });
  }
});

// GET /api/testimonials
app.get('/api/testimonials', async (req, res) => {
  const { page = 1, limit = 9, rating, location, sort = 'newest' } = req.query;
  let query = supabase.from('testimonials').select('*').eq('verified', true);

  if (rating) query = query.eq('rating', rating);
  if (location) query = query.eq('location', location);
  if (sort === 'most-helpful') query = query.order('upvotes', { ascending: false });
  else query = query.order('created_at', { ascending: false });

  query = query.range((page - 1) * limit, page * limit - 1);

  const { data, error } = await query;
  if (error) throw error;
  res.status(200).json(data);
});

// POST /api/testimonials/:id/upvote
app.post('/api/testimonials/:id/upvote', async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('testimonials')
    .update({ upvotes: supabase.raw('upvotes + 1') })
    .eq('id', id)
    .select();
  if (error) throw error;
  res.status(200).json(data[0]);
});

// POST /api/testimonials/:id/flag
app.post('/api/testimonials/:id/flag', async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const { data, error } = await supabase
    .from('testimonial_flags')
    .insert([{ testimonial_id: id, reason }])
    .select();
  if (error) throw error;
  res.status(200).json(data[0]);
});

app.listen(3000, () => console.log('Server running on port 3000'));
