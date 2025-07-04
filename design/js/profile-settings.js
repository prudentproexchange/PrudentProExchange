// js/profile-settings.js
AOS.init({ duration:800, once:true });

// Supabase init
const { createClient } = supabase;
const supabaseClient = createClient(
  'https://iwkdznjqfbsfkscnbrkc.supabase.co',
  'PUBLIC_ANON_KEY' // swap in your anon key
);

// common UI handlers
;(function(){
  const hamb = document.getElementById('hamburgerBtn'),
        nav = document.getElementById('navDrawer'),
        themeT = document.getElementById('theme-toggle'),
        logout = document.getElementById('logout-btn');

  hamb.onclick = ()=> nav.classList.toggle('open');
  themeT.onclick = ()=>{
    document.body.classList.toggle('light-theme');
    themeT.querySelector('i').classList.toggle('fa-moon');
    themeT.querySelector('i').classList.toggle('fa-sun');
  };
  logout.onclick = async ()=>{
    await supabaseClient.auth.signOut();
    location.href='login.html';
  };
})();

// page main
async function initSettingsPage(){
  // auth
  const { data:{ user }, error: authErr } = await supabaseClient.auth.getUser();
  if(authErr||!user) return location.href='login.html';

  // load profile
  const { data:prof, error:profErr } = await supabaseClient
    .from('profiles')
    .select('first_name,photo_url')
    .eq('id', user.id)
    .single();
  if(profErr) return alert('Profile load failed');
  document.getElementById('welcomeName').textContent = prof.first_name;
  if(prof.photo_url){
    const { data:url } = supabaseClient.storage
      .from('profile-photos')
      .getPublicUrl(prof.photo_url);
    let img = document.getElementById('navProfilePhoto');
    img.src = url.publicUrl;
  }

  // load settings
  let { data:settings, error:setErr } = await supabaseClient
    .from('user_settings')
    .select('*').eq('user_id', user.id)
    .single();
  if(setErr && setErr.code!=='PGRST116') return alert('Settings load failed');

  // populate
  const map = {
    displayName:'#displayName',
    timezone:'#timezone',
    locale:'#locale',
    themeMode:'#themeMode',
    accentColor:'#accentColor',
    fontSize:'#fontSize',
    notify_email:'#notifyEmail',
    notify_sms:'#notifySMS',
    notify_push:'#notifyPush',
    digest_frequency:'#digestFrequency',
    two_factor_enabled:'#twoFactorEnabled'
  };
  if(settings){
    for(let k in map){
      let el = document.querySelector(map[k]);
      if(!el) continue;
      if(el.type==='checkbox') el.checked = settings[k];
      else el.value = settings[k] ?? el.value;
    }
  }

  // populate timezones
  let tzs = Intl.supportedValuesOf('timeZone');
  let sel = document.getElementById('timezone');
  tzs.forEach(tz=>{
    let opt = new Option(tz, tz);
    sel.add(opt);
  });

  // form submit
  document.getElementById('settingsForm').onsubmit = async e=>{
    e.preventDefault();
    let fd = new FormData(e.target),
        upd = {
          user_id:user.id,
          display_name: fd.get('displayName'),
          timezone: fd.get('timezone'),
          locale: fd.get('locale'),
          theme_mode: fd.get('themeMode'),
          accent_color: fd.get('accentColor'),
          font_size: fd.get('fontSize'),
          notify_email: fd.get('notifyEmail')==='on',
          notify_sms: fd.get('notifySMS')==='on',
          notify_push: fd.get('notifyPush')==='on',
          digest_frequency: fd.get('digestFrequency'),
          two_factor_enabled: fd.get('twoFactorEnabled')==='on',
          updated_at:new Date().toISOString()
        };
    // avatar
    let file = fd.get('avatarUpload');
    if(file && file.size){
      let name = `${user.id}_${Date.now()}_${file.name}`;
      let { error:upErr } = await supabaseClient.storage
        .from('profile-photos').upload(name, file, { upsert:true });
      if(upErr) return alert('Avatar upload failed');
      upd.avatar_url = name;
      await supabaseClient.from('profiles').update({ photo_url:name }).eq('id', user.id);
    }
    // upsert
    let { error:saveErr } = await supabaseClient
      .from('user_settings')
      .upsert(upd, { onConflict:'user_id' });
    if(saveErr) return alert('Save failed');
    alert('Settings saved!');
  };
}

initSettingsPage();
