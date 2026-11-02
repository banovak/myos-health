/* My OS: Health configuration. Copy to config.js and pick a level.

   Level 1 · This computer only
     storage: 'local'  → records stay in this browser. Open index.html and go.
     Export a backup from the footer now and then.

   Level 2 · Synced between phone and computer
     storage: 'supabase' → records live in YOUR Supabase project (health schema).
     supabaseUrl: Project Settings → API → Project URL
     supabaseKey: the publishable key (sb_publishable_…). It is designed to be public;
                  row-level security is what keeps your records private.
     Never put a secret / service-role key here.

   sample: true fills an empty app with fictional records to explore.
   accent: your colour (buttons, icon, tinted widgets). Change it any time in the app. */
window.MYOS_CONFIG = {
  storage: 'local',
  sample: true,
  supabaseUrl: '',
  supabaseKey: '',
  accent: '#CDEE45'
};
