/* My OS: Health. Records and displays your health data. Never interprets it. */
(function(){
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const pd=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const addDays=(s,n)=>{const d=pd(s);d.setDate(d.getDate()+n);return iso(d)};
const fmt=s=>{if(!s)return '';const d=pd(s);return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`};
const fmtShort=s=>{if(!s)return '';const d=pd(s);return `${MONTHS[d.getMonth()]} ${d.getDate()}`};
const TODAY=iso(new Date());
const dayDiff=(a,b)=>Math.round((pd(b)-pd(a))/864e5);
function ago(s){const days=dayDiff(s,TODAY);if(days<0){const f=-days;return f===1?'tomorrow':f<31?`in ${f} days`:`in ${Math.round(f/30)} months`}if(days===0)return 'today';if(days<31)return `${days} day${days>1?'s':''} ago`;const m=Math.round(days/30.4);return m<12?`${m} month${m>1?'s':''} ago`:`${(days/365).toFixed(1)} years ago`}
function span(a,b){const n=dayDiff(a,b||TODAY);if(n<60)return `${n} days`;return `${Math.round(n/30.4)} months`}
const uid=()=>Math.random().toString(36).slice(2,10);
const byDateDesc=(k='occurred_at')=>(a,b)=>a[k]<b[k]?1:a[k]>b[k]?-1:0;

/* ---------- vocab ---------- */
// Regions sit on the body; points sit on a region's 4:5 canvas. Two levels, the same ids as the phone.
const BASE_REGIONS={
  scalp:'Scalp & hair',face:'Face',neck:'Neck',chest:'Chest',abdomen:'Abdomen',back:'Back',lower_back:'Lower back',
  arm_l:'Left arm',arm_r:'Right arm',leg_l:'Left leg',leg_r:'Right leg',foot_l:'Left foot',foot_r:'Right foot',
  eyes:'Eyes',nose:'Nose',ears:'Ears',mouth:'Mouth',teeth:'Teeth',
  shoulder_l:'Left shoulder',elbow_l:'Left elbow',hand_l:'Left hand',shoulder_r:'Right shoulder',elbow_r:'Right elbow',hand_r:'Right hand',
  thigh_l:'Left thigh',knee_l:'Left knee',shin_l:'Left shin & calf',thigh_r:'Right thigh',knee_r:'Right knee',shin_r:'Right shin & calf',
  heel_l:'Left heel',arch_l:'Left arch',toes_l:'Left toes',heel_r:'Right heel',arch_r:'Right arch',toes_r:'Right toes',
  skin:'Skin (all over)',whole_body:'Whole body',
  // older areas, kept so entries tagged with them keep their names
  arms:'Arms',hands:'Hands',legs:'Legs',feet:'Feet'};
const REG=()=>({...BASE_REGIONS,...(D.customRegions||{})});
const rl=r=>REG()[r]||r;
// the regions on the body (% of the 200×460 figure; the figure faces you, so its right arm is on screen-left), and each region's starting points (% of its 4:5 canvas)
const DEFAULT_POINTS_RAW=[['scalp',50,3.2],['face',50,7.6],['neck',50,15.7],['chest',50,25],['abdomen',50,41],['arm_r',22.5,38],['arm_l',77.5,38],['leg_r',40,71.7],['leg_l',60,71.7],['foot_r',41.5,96],['foot_l',58.5,96],['back',50,27,'back'],['lower_back',50,44,'back']];
const DEFAULT_SUB_RAW=[['face','eyes',38,43.5],['face','eyes',62,43.5],['face','nose',50,55],['face','ears',18.5,47.5],['face','ears',81.5,47.5],['face','mouth',40,66.5],['face','teeth',55,65.5],
  ['arm_l','shoulder_l',50,10],['arm_l','elbow_l',50,50],['arm_l','hand_l',50,88],['arm_r','shoulder_r',50,10],['arm_r','elbow_r',50,50],['arm_r','hand_r',50,88],
  ['leg_l','thigh_l',50,18],['leg_l','knee_l',50,50],['leg_l','shin_l',50,78],['leg_r','thigh_r',50,18],['leg_r','knee_r',50,50],['leg_r','shin_r',50,78],
  ['foot_l','heel_l',50,22],['foot_l','arch_l',50,52],['foot_l','toes_l',50,86],['foot_r','heel_r',50,22],['foot_r','arch_r',50,52],['foot_r','toes_r',50,86]];
const defaultPoints=()=>[...DEFAULT_POINTS_RAW.map(([region,x,y,side])=>({id:uid(),region,x,y,...(side==='back'?{side}:{})})),...DEFAULT_SUB_RAW.map(([parent,region,x,y])=>({id:uid(),region,x,y,parent}))];
/* the region whose canvas this area is a point on, or null for a region */
const parentOf=r=>{const p=D.points.find(q=>q.region===r&&q.parent);return p?p.parent:null};
/* the areas with a point on this region's canvas */
const childRegions=r=>[...new Set(D.points.filter(p=>p.parent===r).map(p=>p.region))];
/* the regions on the body in the figure's order, then whole body, skin and custom areas with no point; extra ids (older tags) kept at the end */
function topRegions(extra){const out=[],add=r=>{if(!out.includes(r))out.push(r)};const l1=D.points.filter(p=>!p.parent).map(p=>p.region);
  DEFAULT_POINTS_RAW.forEach(([r])=>{if(l1.includes(r))add(r)});l1.forEach(add);add('whole_body');add('skin');
  const used=new Set(D.points.map(p=>p.region));Object.keys(D.customRegions||{}).forEach(r=>{if(!used.has(r))add(r)});
  if(extra)for(const r of extra)if(!parentOf(r))add(r);return out}
/* ---------- units: weight and height are stored in kg and cm; shown and entered in the unit chosen on the health card ---------- */
const LB_PER_KG=2.2046226,CM_PER_IN=2.54;
const unitPref=()=>{const u=D.settings.units||{};return {weight:u.weight==='lb'?'lb':'kg',height:u.height==='ft'?'ft':'cm'}};
const setUnit=(k,u)=>{D.settings.units={...(D.settings.units||{}),[k]:u}};
const lbFromKg=kg=>+(kg*LB_PER_KG).toFixed(1),kgFromLb=lb=>+(lb/LB_PER_KG).toFixed(2),cmFromFtIn=(ft,inch)=>+((ft*12+inch)*CM_PER_IN).toFixed(1);
function ftInFromCm(cm){const inches=cm/CM_PER_IN;let ft=Math.floor(inches/12),inch=Math.round(inches-ft*12);if(inch===12){ft++;inch=0}return {ft,inch}}
/* a stored value in the unit the person chose: the number as text, and the unit word after it */
function showMeasure(k,v){const p=unitPref();if(k==='weight'&&p.weight==='lb')return {value:String(lbFromKg(v)),unit:'lb'};if(k==='height'&&p.height==='ft'){const {ft,inch}=ftInFromCm(v);return {value:`${ft}′ ${inch}″`,unit:''}}return {value:String(+(+v).toFixed(2)),unit:(D.metrics[k]||{}).u||''}}
const numIn=(k,v)=>k==='weight'&&unitPref().weight==='lb'?lbFromKg(v):v;
const unitWord=k=>{const p=unitPref();return k==='weight'?p.weight:k==='height'?(p.height==='ft'?'ft in':'cm'):(D.metrics[k]||{}).u||''};
/* ---------- rating scales: the unit carries the scale, "/5" = 1 to 5, "/10" = 0 to 10 ---------- */
const RATING_SCALES=[['/5','1 to 5'],['/10','0 to 10, where 0 is none']];
const ratingRange=u=>u==='/10'?{lo:0,hi:10}:{lo:1,hi:5};
/* ---------- Apple Health items: what to do with each (settings.hkUse); weight and body fat merge with the typed-in measure ---------- */
const HK_ITEMS=[{key:'weight',label:'Weight',merge:'weight',hk:['weight']},{key:'body_fat',label:'Body fat',merge:'body_fat',hk:['body_fat']},{key:'steps',label:'Steps',hk:['steps']},{key:'active_kcal',label:'Active energy',hk:['active_kcal']},{key:'rhr',label:'Resting heart rate',hk:['rhr']},{key:'hrv',label:'HRV',hk:['hrv']},{key:'sleep',label:'Sleep, bedtime and wake time',hk:['sleep_hours','bedtime','wake','sleep']},{key:'cycle',label:'Menstrual flow, spotting and symptoms',hk:[]},{key:'workouts',label:'Workouts, as ticks on a regimen',hk:[]}];
const hkUse=key=>(D.settings.hkUse||{})[key]||'both';
const hkUseFor=hkKey=>{const it=HK_ITEMS.find(x=>x.hk.includes(hkKey));return it?hkUse(it.key):'both'};
const hkKeyForMetric=mk=>{const it=HK_ITEMS.find(x=>x.merge===mk);return it?it.hk[0]:null};
const metricForHk=hkKey=>{const it=HK_ITEMS.find(x=>x.merge&&x.hk.includes(hkKey));return it?it.merge:null};
/* a measure's values by day, manual and Health together under the item's setting: Health wins a day that has both, unless set to Manual only */
function measurePoints(key){
  const manual=D.entries.filter(e=>e.type==='measurement'&&e.details.metric===key&&e.details.value!=null).map(e=>({d:e.occurred_at,v:+e.details.value}));
  const hkKey=hkKeyForMetric(key),mode=hkKey?hkUse(hkKey):'manual';
  const health=hkKey&&mode!=='manual'&&mode!=='off'?(D.hk[hkKey]||[]).map(p=>({d:p.d,v:p.v,src:'Apple Health'})):[];
  const days=new Set(health.map(p=>p.d));
  return (mode==='health'?health:[...manual.filter(p=>!days.has(p.d)),...health]).sort((a,b)=>a.d<b.d?-1:1);
}
/* ---------- stints: a regimen or diet stopped and started again is one record ---------- */
const stintsOf=r=>r.periods&&r.periods.length?r.periods:[{from:r.started_on,to:r.ended_on||null}];
function setStints(r,ps){const s=ps.map(p=>({from:p.from,to:p.to||null})).sort((a,b)=>a.from<b.from?-1:1);if(!s.length)return;r.started_on=s[0].from;r.ended_on=s[s.length-1].to;if(s.length>1)r.periods=s;else delete r.periods}
function regimenActive(r,on=TODAY){return stintsOf(r).some(p=>p.from<=on&&(!p.to||p.to>=on))}
function regimenStopped(r,on=TODAY){return stintsOf(r).every(p=>!!p.to&&p.to<on)}
/* ---------- illnesses: a concern that comes in episodes, one record per group ("Viral", "Lupus"), an episode per bout ---------- */
const isIllness=c=>c.kind==='illness';
const illnesses=()=>D.concerns.filter(isIllness);
const ILLNESS_GROUPS=['Viral','Bacterial','Not sure'];
const episodesOf=c=>c.episodes&&c.episodes.length?c.episodes:c.started_on?[{from:c.started_on,to:c.resolved_on||null}]:[];
function setEpisodes(c,eps){const s=eps.map(e=>{const o={from:e.from,to:e.to||null};if(e.label&&e.label.trim())o.label=e.label.trim();if(e.notes&&e.notes.trim())o.notes=e.notes.trim();return o}).sort((a,b)=>a.from<b.from?-1:1);
  c.episodes=s;if(!s.length)return;const open=s.some(e=>!e.to);c.started_on=s[0].from;c.resolved_on=open?null:s.reduce((m,e)=>e.to>m?e.to:m,s[0].to);c.status=open?'active':'resolved'}
const sickOn=(c,on=TODAY)=>episodesOf(c).some(e=>e.from<=on&&(!e.to||e.to>=on));
const openEpisode=c=>episodesOf(c).find(e=>!e.to);
const episodeDays=(e,upTo=TODAY)=>Math.max(1,dayDiff(e.from,e.to&&e.to<=upTo?e.to:upTo)+1);
const episodeTitle=(c,e)=>e.label||c.title;
function episodeClash(eps,e,skip=-1){const T='9999-12-31',a=e.from,b=e.to||T;return eps.some((x,i)=>i!==skip&&x.from<=b&&(x.to||T)>=a)}
function sickDays(c,from,to){const hi=to<TODAY?to:TODAY;let n=0;for(const e of episodesOf(c)){const a=e.from>from?e.from:from,end=e.to||TODAY,b=end<hi?end:hi;if(a<=b)n+=dayDiff(a,b)+1}return n}
const yearStart=()=>TODAY.slice(0,4)+'-01-01';
const sickDaysThisYear=c=>sickDays(c,yearStart(),TODAY),episodesThisYear=c=>episodesOf(c).filter(e=>e.from>=yearStart()).length;
const isHex=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
function illnessColor(c){if(c.color)return c.color;const pool=ALL_COLORS.filter(isHex),i=illnesses().findIndex(x=>x.id===c.id);return pool[((i<0?0:i)*3)%pool.length]}
function recentLabels(){const seen=new Map();illnesses().forEach(c=>episodesOf(c).forEach(e=>{if(e.label){const k=e.label.toLowerCase();if(!seen.has(k)||seen.get(k)<e.from)seen.set(k,e.from)}}));
  const label=k=>{for(const c of illnesses())for(const e of episodesOf(c))if(e.label&&e.label.toLowerCase()===k)return e.label;return k};return [...seen.entries()].sort((a,b)=>a[1]<b[1]?1:-1).map(([k])=>label(k))}
/* ---------- reports: lab results are one kind of document; prescriptions, scans and letters are the others ---------- */
const REPORT_KINDS=[['lab','Lab results'],['prescription','Prescription'],['scan','Scan or imaging'],['letter','Letter or referral'],['other','Other document']];
const reportKind=l=>l.kind||'lab',isLab=l=>reportKind(l)==='lab',kindName=k=>(REPORT_KINDS.find(x=>x[0]===k)||[k,k])[1];
const reportTitle=l=>l.title||(isLab(l)?l.lab||'Lab report':kindName(reportKind(l)));
const labsOnly=()=>D.labs.filter(isLab);
const TITLE_HINT={lab:'',prescription:'Glasses prescription, Amoxicillin',scan:'Knee MRI, chest X-ray',letter:'Referral to dermatology',other:'Discharge summary'};
/* ---------- providers: in settings.providers; the health card's providers rows mirror the active ones as strings ---------- */
function providersOf(){if(D.settings.providers)return D.settings.providers;return (((D.settings.card||{}).providers)||[]).map((r,i)=>({id:'pv-seed-'+i,name:r.name||'',role:r.role||'',practice:r.practice||'',phone:r.phone||''}))}
function ensureProviders(){if(!D.settings.providers)D.settings.providers=providersOf().map(p=>({...p}));return D.settings.providers}
const activeProviders=()=>providersOf().filter(p=>!p.archived);
const providerOf=id=>id?providersOf().find(p=>p.id===id):undefined;
const sameName=(a,b)=>!!a&&!!b&&a.trim().toLowerCase()===b.trim().toLowerCase();
const providerEntries=p=>D.entries.filter(e=>e.type==='appointment'&&(e.details.provider_id===p.id||(!e.details.provider_id&&sameName(e.details.provider,p.name)))).sort(byDateDesc());
const providerCourses=p=>D.courses.filter(k=>sameName(k.provider,p.name));
const providerSpend=es=>es.reduce((s,e)=>s+(+e.details.cost||0),0);
const initials=name=>name.replace(/^dr\.?\s+/i,'').split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join('');
function mirrorCard(){D.settings.card=D.settings.card||{};D.settings.card.providers=activeProviders().map(p=>({name:p.name,role:p.role||'',practice:p.practice||'',phone:p.phone||''}))}
function upsertProvider(p){const ps=ensureProviders(),i=ps.findIndex(x=>x.id===p.id);if(i>=0)ps[i]=p;else ps.push(p);mirrorCard()}
function removeProvider(id){D.settings.providers=ensureProviders().filter(x=>x.id!==id);mirrorCard()}
function setArchived(id,v){const p=ensureProviders().find(x=>x.id===id);if(p)p.archived=v;mirrorCard()}
const ICONS={
 photo:'<path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
 appointment:'<rect x="4" y="5.5" width="16" height="14" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
 measurement:'<path d="M5 19 19 5"/><path d="M8 16l-1.5-1.5M11 13l-2-2M14 10l-1.5-1.5M17 7l-2-2"/>',
 procedure:'<path d="M14.5 4.5 19.5 9.5 9 20H4v-5z"/><path d="m12.5 6.5 5 5"/>',
 observation:'<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
 lab:'<path d="M9.5 3.5h5M10.5 3.5v6L5 18.5a1.5 1.5 0 0 0 1.3 2h11.4a1.5 1.5 0 0 0 1.3-2l-5.5-9v-6"/><path d="M7.5 14.5h9"/>',
 regimen:'<rect x="3.5" y="9" width="17" height="6.5" rx="3.25" transform="rotate(-35 12 12)"/><path d="m9.6 8.6 4.8 6.8"/>',
 diet:'<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z"/><path d="M5 19 13 11"/>',
 food_trial:'<path d="M7 3.5v17M4.5 3.5v5a2.5 2.5 0 0 0 5 0v-5M16.5 20.5v-17c-2.5 1-3.5 4-3.5 7.5h3.5"/>',
 cycle:'<path d="M12 3.5c3.5 4.5 6 7.7 6 10.8a6 6 0 0 1-12 0C6 11.2 8.5 8 12 3.5z"/>',
 challenge:'<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
 illness:'<path d="M12 3.5v17M3.5 12h17M6.5 6.5l11 11M17.5 6.5l-11 11"/><circle cx="12" cy="12" r="3"/>',
 report:'<path d="M14 3.5H7a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3.5V8h4.5M9 13h6M9 16.5h6"/>'
};
const FILE_ICON='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3.5H7a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3.5V8h4.5"/></svg>';
const icon=t=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[t]}</svg>`;
const ico=(t,sm)=>`<span class="ico${sm?' sm':''}" style="background:var(--t-${t});${t==='challenge'?'color:var(--on-dark)':''}">${icon(t)}</span>`;

const TYPES={
 photo:{label:'Photo',hint:'Anything you want to see change: skin, hair, teeth, a mole, your body',fields:[{k:'series',l:'Photo series',t:'select',o:[['none','Not part of a series'],['body','Body progress'],['face','Face progress']]}]},
 appointment:{label:'Appointment',hint:'Any visit or session: doctor, dentist, physio, a scan, your own fitness test',fields:[
   {k:'kind',l:'Kind',t:'kind'},
   {k:'status',l:'Status',t:'select',o:[['done','Done'],['upcoming','Upcoming'],['cancelled','Cancelled']]},
   {k:'provider',l:'Provider',t:'text',p:'Dr. Lee'},{k:'practice',l:'Practice',t:'text',p:'Clinic name'},
   {k:'plan_id',l:'Part of your plan',t:'plan'},{k:'course_id',l:'Part of a course of care',t:'course'},
   {k:'reason',l:'What you went in for',t:'text',full:1},{k:'what_was_done',l:'What was done',t:'area',full:1},
   {k:'what_they_said',l:'What they said',t:'area',full:1},{k:'results',l:'Results',t:'area',full:1},
   {k:'cost',l:'Cost',t:'number',p:'0'},{k:'tooth',l:'Tooth number',t:'text',p:'e.g. 36',only:'dentist'},{k:'follow_up_on',l:'Follow-up date',t:'date'}]},
 measurement:{label:'Measurement',hint:'Any number you track: weight, blood pressure, a 1–5 rating, a time',fields:[{k:'metric',l:'Measure',t:'metric'}]},
 procedure:{label:'Procedure',hint:'Something done once: a filling, a laser session, a mole removal, a vaccine',fields:[{k:'name',l:'Procedure',t:'text'},{k:'provider',l:'Provider',t:'text'}]},
 food_trial:{label:'Food trial',hint:'A food you reintroduced, and how much',fields:[{k:'food',l:'Food',t:'text',p:'Dairy, eggs, wheat'},{k:'amount',l:'How much',t:'text',p:'One glass of milk'}]},
 observation:{label:'Observation',hint:'Something you noticed: a symptom, a reaction, a change',fields:[{k:'severity',l:'Your own rating (optional)',t:'select',o:[['','No rating'],['1','1 · barely'],['2','2'],['3','3'],['4','4'],['5','5 · a lot']]}]}
};
const KIND_LABEL={doctor:'Doctor',dentist:'Dentist',therapy:'Therapy',physio:'Physio',med_spa:'Med spa',specialist:'Specialist / scan',self:'Self check-in',other:'Appointment'};
const REG_CATS=[['supplement','Supplement'],['medication','Medication'],['activity','Activity or exercise'],['skin','Skin care'],['hair','Hair care'],['other','Other']];
const catLabel=c=>c==='diet'?'Diet':(REG_CATS.find(x=>x[0]===c)||[,c])[1];

/* ---------- sample data (fictional) ---------- */
function sample(){
  const E=[];const add=o=>{const e={id:uid(),notes:'',regions:[],photos:[],details:{},source:'manual',concern_id:null,parent_entry_id:null,...o};E.push(e);return e};
  const C=[
    {id:'c-eczema',title:'Eczema, hands',regions:['hand_l','hand_r'],started_on:'2026-01-08',resolved_on:null,status:'active',tracking:{metrics:['itch'],per:'month'}},
    {id:'c-tired',title:'Tiredness',regions:['whole_body'],started_on:addDays(TODAY,-21),resolved_on:null,status:'active',notes:'Flat in the afternoons. Want to see how it lines up with sleep and B12.',tracking:{metrics:['energy','refreshed','bedtime'],per:'day'}},
    {id:'c-rash',title:'Rash, left cheek',regions:['face'],started_on:'2026-04-20',resolved_on:'2026-05-22',status:'resolved'},
    {id:'c-tooth',title:'Cavity, tooth 36',regions:['teeth'],started_on:'2026-03-12',resolved_on:'2026-03-26',status:'resolved'},
    {id:'c-mole',title:'Mole, left shoulder',regions:['back'],started_on:addDays(TODAY,-60),resolved_on:null,status:'active',notes:'Keep an eye on size and colour.'},
    {id:'c-knee',title:'Right knee',regions:['leg_r','knee_r'],started_on:'2025-10-20',resolved_on:null,status:'active'},
    // illnesses: one record per group, an episode per bout
    {id:'c-viral',title:'Viral',regions:[],started_on:'2026-02-14',resolved_on:null,status:'active',kind:'illness',color:'#D8916B',episodes:[{from:'2026-02-14',to:'2026-02-20',label:'Cold'},{from:'2026-06-03',to:'2026-06-05',label:'Stomach bug',notes:'Whole house had it.'},{from:addDays(TODAY,-4),to:null,label:'Cold'}]},
    {id:'c-migraine',title:'Migraine',regions:['face'],started_on:'2026-03-02',resolved_on:'2026-08-28',status:'resolved',kind:'illness',color:'#8556B5',episodes:[{from:'2026-03-02',to:'2026-03-03'},{from:'2026-05-19',to:'2026-05-19'},{from:'2026-08-27',to:'2026-08-28',notes:'Missed lunch, long screen day.'}]}
  ];
  const metrics={weight:{l:'Weight',u:'kg'},body_fat:{l:'Body fat',u:'%'},height:{l:'Height',u:'cm'},itch:{l:'Hand itch',u:'/5',rating:true},skin_clarity:{l:'Skin clarity',u:'/5',rating:true},knee_pain:{l:'Knee pain',u:'/5',rating:true},energy:{l:'Energy',u:'/5',kind:'rating',rating:true},refreshed:{l:'Refreshed on waking',u:'/5',kind:'rating',rating:true},bedtime:{l:'Ready for bed',u:'',kind:'time_night'},five_k:{l:'5k time',u:'min'},squat_1rm:{l:'Squat 1RM',u:'kg'}};
  const months=['2026-01-10','2026-02-11','2026-03-09','2026-04-12','2026-05-10','2026-06-14','2026-07-12','2026-08-09','2026-09-13','2026-10-11'];
  const w=[71.6,71.2,70.9,71.0,70.4,70.1,69.8,69.9,69.5,69.2],hd=[4,4,4,3,3,3,2,2,2,2],sk=[4,4,3,2,3,4,4,4,4,4];
  months.forEach((d,i)=>{
    add({type:'measurement',occurred_at:d,title:`Weight ${w[i]} kg`,regions:['whole_body'],details:{metric:'weight',value:w[i]}});
    add({type:'measurement',occurred_at:d,title:`Hand itch ${hd[i]}/5`,regions:['hand_l','hand_r'],concern_id:'c-eczema',details:{metric:'itch',value:hd[i]}});
    add({type:'measurement',occurred_at:d,title:`Skin clarity ${sk[i]}/5`,regions:['face'],details:{metric:'skin_clarity',value:sk[i]}});
    add({type:'photo',occurred_at:d,title:'Body progress',regions:['whole_body'],details:{series:'body'},photos:i%3===0?[{ph:'body',w:1.06-i*0.012,label:'Front'},{ph:'body',w:1.06-i*0.012,label:'Back'}]:[{ph:'body',w:1.06-i*0.012}]});
    if(i<6)add({type:'photo',occurred_at:d,title:'Hands, back view',regions:['hand_l','hand_r'],concern_id:'c-eczema',photos:[{ph:'hands',hue:8+i*3}]});
  });
  [['2026-01-10',22.4],['2026-04-12',21.8],['2026-07-12',21.1],['2026-10-11',20.5]].forEach(([d,v])=>add({type:'measurement',occurred_at:d,title:`Body fat ${v}%`,regions:['whole_body'],details:{metric:'body_fat',value:v}}));
  add({type:'measurement',occurred_at:'2026-01-10',title:'Height 175 cm',regions:['whole_body'],details:{metric:'height',value:175}});
  // weekly hand photos for the challenge (two weeks missed)
  for(let k=0;k<13;k++){if(k===4||k===9)continue;const d=addDays('2026-07-20',k*7+1);if(d>TODAY)break;add({type:'photo',occurred_at:d,title:'Hands, weekly',regions:['hand_l','hand_r'],concern_id:'c-eczema',photos:[{ph:'hands',hue:20+k}]})}
  add({type:'observation',occurred_at:'2026-01-08',title:'Cracked, itchy skin on both hands',regions:['hand_l','hand_r'],concern_id:'c-eczema',details:{severity:'3'},notes:'Worse after washing up, for about a month.'});
  const gp1=add({type:'appointment',occurred_at:'2026-01-15',title:'GP, eczema on hands',regions:['hand_l','hand_r'],concern_id:'c-eczema',details:{kind:'doctor',status:'done',provider:'Dr. Patel',practice:'Riverside Family Health',reason:'Itchy, cracked hands for about a month',what_they_said:'Fragrance-free emollient after every wash. Ordered routine bloodwork: CBC, B12, TSH, lipids.',results:'See lab report Jan 20.'}});
  add({type:'appointment',occurred_at:'2026-01-29',title:'GP, bloodwork results',regions:['whole_body'],concern_id:'c-eczema',parent_entry_id:gp1.id,details:{kind:'doctor',status:'done',provider:'Dr. Patel',practice:'Riverside Family Health',reason:'Go over results',what_they_said:'B12 on the low side: suggested 1000 mcg daily. Retest in about three months.',results:'',follow_up_on:'2026-05-12'}});
  const dent=add({type:'appointment',occurred_at:'2026-03-12',title:'Dental cleaning',regions:['teeth'],concern_id:'c-tooth',details:{kind:'dentist',status:'done',provider:'Dr. Okafor',practice:'Harbour Dental',reason:'Six-month cleaning',plan_id:'p-dental',cost:180,what_they_said:'Small cavity on the lower left molar. Booked a filling.',results:'X-rays taken.',tooth:'36'}});
  add({type:'procedure',occurred_at:'2026-03-26',title:'Filling, tooth 36',regions:['teeth'],concern_id:'c-tooth',parent_entry_id:dent.id,details:{name:'Composite filling',provider:'Dr. Okafor'}});
  add({type:'observation',occurred_at:'2026-04-20',title:'Red patch on left cheek',regions:['face'],concern_id:'c-rash',details:{severity:'3'},notes:'Started after switching moisturiser.',photos:[{ph:'face',hue:350}]});
  add({type:'appointment',occurred_at:'2026-05-08',title:'GP, cheek rash',regions:['face'],concern_id:'c-rash',details:{kind:'doctor',status:'done',provider:'Dr. Patel',practice:'Riverside Family Health',reason:'Rash on left cheek',what_they_said:'Said it looked like a reaction to a product. Stop the new moisturiser; cream for 7 days.'}});
  add({type:'photo',occurred_at:'2026-05-22',title:'Cheek, cleared',regions:['face'],concern_id:'c-rash',photos:[{ph:'face',hue:25}]});
  add({type:'appointment',occurred_at:'2026-06-18',title:'Laser resurfacing consult',regions:['face'],details:{kind:'med_spa',status:'done',provider:'Maya R., RN',practice:'Lumen Aesthetics',reason:'Texture and fine lines',what_they_said:'Three fractional sessions, four weeks apart.'}});
  add({type:'procedure',occurred_at:'2026-07-09',title:'Fractional laser, session 1',regions:['face'],details:{name:'Fractional laser resurfacing',provider:'Lumen Aesthetics'},photos:[{ph:'face',hue:15}]});
  add({type:'observation',occurred_at:'2025-10-20',title:'Right knee sore after runs',regions:['leg_r','knee_r'],concern_id:'c-knee',details:{severity:'2'}});
  add({type:'observation',occurred_at:addDays(TODAY,-40),title:'New mole on left shoulder',regions:['back'],concern_id:'c-mole',notes:'About 4 mm, flat, light brown.'});
  const K=[{id:'k-physio',title:'Physio, right knee',kind:'physio',provider:'Sam Chen',practice:'Motion Physio',cadence:'Every 3 weeks',started_on:'2025-11-04',ended_on:null,concern_id:'c-knee',metric:'knee_pain',cost:95,notes:'Goal: run 10k without knee pain.'}];
  const work=['Assessment. Kneecap tracking issue, given three exercises.','Manual therapy and taping. Progressed exercises.','Dry needling (quad). Reviewed form.','Ultrasound. Added single-leg squats.','Same program. Added hopping drills.'];
  const pain=[3,3,4,3,3,2,3,3,3,4,3,3,2,3,3,3,3,3,3];
  for(let k=0;k<40;k++){const d=addDays('2025-11-04',k*21);
    if(d>TODAY){add({type:'appointment',occurred_at:d,title:'Physio, right knee',regions:['leg_r','knee_r'],concern_id:'c-knee',details:{kind:'physio',status:'upcoming',provider:'Sam Chen',provider_id:'pv-chen',practice:'Motion Physio',course_id:'k-physio',cost:95}});break}
    const ap=add({type:'appointment',occurred_at:d,title:'Physio, right knee',regions:['leg_r','knee_r'],concern_id:'c-knee',details:{kind:'physio',status:'done',provider:'Sam Chen',provider_id:'pv-chen',practice:'Motion Physio',course_id:'k-physio',cost:95,what_was_done:work[k%work.length],what_they_said:k===0?'Expect six to eight weeks to settle.':''}});
    add({type:'measurement',occurred_at:d,title:`Knee pain ${pain[k%pain.length]}/5`,regions:['leg_r','knee_r'],concern_id:'c-knee',details:{metric:'knee_pain',value:pain[k%pain.length],from_appt:ap.id}})}
  const PL=[{id:'p-physical',title:'Annual physical',kind:'doctor',per_year:1,notes:''},{id:'p-dental',title:'Dental cleaning',kind:'dentist',per_year:2,notes:''},{id:'p-dexa',title:'DEXA scan',kind:'specialist',per_year:1,notes:'Body composition and bone density.'},{id:'p-fitness',title:'Personal fitness test',kind:'self',per_year:1,notes:'Timed 5k, then 1RM squat, deadlift and bench.'}].map(p=>({...p,year:+TODAY.slice(0,4)}));
  PL.push({id:'p-fitness-25',title:'Personal fitness test',kind:'self',per_year:1,notes:'Timed 5k, then 1RM squat.',year:+TODAY.slice(0,4)-1});
  const PCAT={'p-physical':'physical','p-dental':'oral','p-dexa':'physical','p-fitness':'physical','p-fitness-25':'physical'};PL.forEach(p=>p.category=PCAT[p.id]||'');
  PL.push({id:'p-therapy',title:'Therapy',kind:'therapy',per_year:12,notes:'Monthly with Dr. Reyes.',category:'mental',year:+TODAY.slice(0,4)},{id:'p-skin',title:'Full skin check',kind:'specialist',per_year:1,notes:'Dermatologist mole map.',category:'skin',year:+TODAY.slice(0,4)});
  for(let m=1;m<=12;m++){const d=`${TODAY.slice(0,4)}-${String(m).padStart(2,'0')}-14`;if(d>addDays(TODAY,31))break;add({type:'appointment',occurred_at:d,title:'Therapy, Dr. Reyes',regions:['whole_body'],details:{kind:'therapy',status:d<=TODAY?'done':'upcoming',provider:'Dr. Reyes',plan_id:'p-therapy'}})}
  [['2025-06-07',31.4,55,'p-fitness-25'],['2026-06-06',29.6,62.5,'p-fitness']].forEach(([d,t,sq,pid])=>{const ap=add({type:'appointment',occurred_at:d,title:'Personal fitness test',regions:['whole_body'],details:{kind:'self',status:'done',plan_id:pid,what_was_done:'Timed 5k on the track, then 1RM squat.',results:`5k ${t} min · squat ${sq} kg`}});
    add({type:'measurement',occurred_at:d,title:`5k time ${t} min`,regions:['whole_body'],details:{metric:'five_k',value:t,from_appt:ap.id}});add({type:'measurement',occurred_at:d,title:`Squat 1RM ${sq} kg`,regions:['leg_l','leg_r'],details:{metric:'squat_1rm',value:sq,from_appt:ap.id}})});
  add({type:'appointment',occurred_at:addDays(TODAY,4),title:'Dental cleaning',regions:['teeth'],details:{kind:'dentist',status:'upcoming',provider:'Dr. Okafor',practice:'Harbour Dental',plan_id:'p-dental'}});
  const R=[
    // stopped and started again: one record with two stints
    {id:'r-b12',name:'Vitamin B12',category:'supplement',dose:'500 mcg',frequency:'Daily',started_on:'2026-02-01',ended_on:null,periods:[{from:'2026-02-01',to:'2026-07-31'},{from:addDays(TODAY,-20),to:null}],changes:[{on:'2026-05-15',dose:'500 mcg',frequency:'Daily',prev_dose:'1000 mcg',prev_frequency:'Daily'}],regions:['whole_body'],concern_id:null,notes:'Taken with breakfast.',photos:[{ph:'bottle',hue:200}]},
    {id:'r-yoga',name:'Yoga',category:'activity',dose:'60 min class',frequency:'2× a week',started_on:addDays(TODAY,-56),ended_on:null,regions:['back'],concern_id:null,notes:'',target:{count:2,per:'week'},match:{source:'strava',activity:'Yoga'}},
    {id:'r-omega',name:'Omega-3 fish oil',category:'supplement',dose:'1 g',frequency:'Daily',started_on:'2026-02-01',ended_on:null,regions:['whole_body'],concern_id:null,notes:''},
    {id:'r-emollient',name:'Fragrance-free emollient',category:'skin',dose:'',frequency:'After every hand wash',started_on:'2026-01-15',ended_on:null,regions:['hand_l','hand_r'],concern_id:'c-eczema',notes:''},
    {id:'r-gloves',name:'Cotton gloves at night',category:'skin',dose:'',frequency:'3× a week',started_on:'2026-04-01',ended_on:null,regions:['hand_l','hand_r'],concern_id:'c-eczema',notes:'Over a thick layer of emollient.'},
    {id:'r-hc',name:'Hydrocortisone 1% cream',category:'medication',dose:'Thin layer, twice a day',frequency:'Twice daily',started_on:'2026-05-08',ended_on:'2026-05-15',regions:['face'],concern_id:'c-rash',notes:''},
    {id:'r-d1',name:'Mediterranean',category:'diet',started_on:'2026-01-01',ended_on:'2026-03-31',regions:['whole_body'],notes:''},
    {id:'r-d2',name:'High protein, about 120 g a day',category:'diet',started_on:'2026-04-01',ended_on:'2026-06-30',regions:['whole_body'],notes:''},
    {id:'r-d3',name:'No alcohol',category:'diet',started_on:'2026-07-01',ended_on:null,regions:['whole_body'],notes:'A dry summer, to see what changes.'}
  ];
  const L=[
    {id:'l1',date:'2026-01-20',lab:'Northside Labs',file:'bloodwork-2026-01-20.pdf',results:[['Hemoglobin',141,'g/L','120–160',''],['Vitamin B12',138,'pmol/L','150–700','L'],['LDL cholesterol',3.7,'mmol/L','<3.5','H'],['TSH',2.4,'mIU/L','0.32–4.00','']]},
    {id:'l2',date:'2026-05-12',lab:'Northside Labs',file:'bloodwork-2026-05-12.pdf',results:[['Hemoglobin',139,'g/L','120–160',''],['Vitamin B12',296,'pmol/L','150–700',''],['LDL cholesterol',3.4,'mmol/L','<3.5',''],['TSH',2.2,'mIU/L','0.32–4.00','']]},
    {id:'l3',date:'2026-08-20',lab:'Northside Labs',file:'bloodwork-2026-08-20.pdf',results:[['Hemoglobin',140,'g/L','120–160',''],['Vitamin B12',412,'pmol/L','150–700',''],['LDL cholesterol',3.1,'mmol/L','<3.5','']]}
  ].map(l=>({...l,results:l.results.map(([marker,value,unit,range,flag])=>({marker,value,unit,range,flag}))}));
  // other documents keep their own values, out of the markers table
  L.push({id:'l-glasses',date:'2026-04-03',lab:'Riverside Optometry',kind:'prescription',title:'Glasses prescription',file:null,notes:'',results:[{marker:'OD sphere',value:-1.25,unit:'D',range:'axis 90',flag:''},{marker:'OS sphere',value:-1.5,unit:'D',range:'axis 85',flag:''}]},
    {id:'l-mri',date:'2026-09-09',lab:'Harbour Imaging',kind:'scan',title:'Knee MRI',file:'knee-mri-2026-09-09.pdf',notes:'Report says patellar tracking; physio to continue.',results:[]});
  const CH=[{id:'ch1',title:'90-day hand check',started_on:'2026-07-20',days:90,regimen_ids:['r-gloves'],rules:[{label:'Hand photo',kind:'photo',region:'hand_l',per:'week'},{label:'Hand itch rating',kind:'metric',metric:'itch',per:'month'}],notes:''}];
  const HK={sleep:[],rhr:[]};
  for(let k=0;k<41;k++){const d=addDays('2026-01-05',k*7);if(d>TODAY)break;HK.sleep.push({d,v:+(6.9+0.5*Math.sin(k/4)+(k>20?0.25:0)).toFixed(1)});HK.rhr.push({d,v:Math.round(61-k*0.06+2*Math.sin(k/3))})}
  const S=[{id:uid(),title:'Annual physical, Dr. Patel',occurred_at:'2026-10-28',details:{kind:'doctor',provider:'Dr. Patel',plan_id:'p-physical'},status:'pending',found:'Calendar: "Physical – Dr Patel"'},
           {id:uid(),title:'Lumen Aesthetics, session 2',occurred_at:'2026-11-12',details:{kind:'med_spa',provider:'Lumen Aesthetics'},status:'pending',found:'Calendar: "Lumen laser #2"'}];
  const RC={'r-yoga':'#4B9DAD','r-b12':'#7480F7','r-omega':'#E9B89B','r-emollient':'#C7B0E3','r-gloves':'#78AA87','r-hc':'#C7B0E3','r-d1':'#A6C9AF','r-d2':'#D3EB8E','r-d3':'#E9B89B'};
  // round 1 sample: tracked tiredness, yoga with a target, logs, health card
  for(let d=1;d<=14;d++){const day=addDays(TODAY,-d),en=[3,2,3,2,2,3,4,3,2,2,3,3,2,3][d-1],rf=[2,2,3,2,1,3,3,2,2,1,3,2,2,3][d-1],bt=[1350,1395,1320,1410,1440,1335,1290,1365,1425,1455,1350,1380,1440,1320][d-1]%1440;
    add({type:'measurement',occurred_at:day,title:`Energy ${en}/5`,regions:['whole_body'],concern_id:'c-tired',details:{metric:'energy',value:en}});
    add({type:'measurement',occurred_at:day,title:`Refreshed on waking ${rf}/5`,regions:['whole_body'],concern_id:'c-tired',details:{metric:'refreshed',value:rf}});
    add({type:'measurement',occurred_at:day,title:`Ready for bed ${hhmm(bt)}`,regions:['whole_body'],concern_id:'c-tired',details:{metric:'bedtime',value:bt}})}
  add({type:'observation',occurred_at:addDays(TODAY,-3),title:'Hives after lunch',regions:['chest','arm_l','arm_r'],details:{severity:'3',time:'13:40',end_date:addDays(TODAY,-3),end_time:'16:10'},notes:'Itchy welts on chest and forearms. Faded by late afternoon.'});
  const RL=[];const rlog=(rid,d)=>RL.push({id:'rl-'+uid(),regimen_id:rid,on_date:d,time:null,source:'manual',note:''});
  for(let w=0;w<8;w++){const base=addDays(TODAY,-7*w);[1,4].forEach((o,j)=>{if(!(w===0&&j===1)&&!(w===3&&j===0))rlog('r-yoga',addDays(base,-o))})}
  for(let d=1;d<=56;d++){if(d%7===0||d%7===3||d%7===5)rlog('r-gloves',addDays(TODAY,-d))}
  const PV=[{id:'pv-patel',name:'Dr. Patel',role:'Family doctor',practice:'Riverside Family Health',phone:'555 0100',address:'200 Main St',link:'',photo:null},{id:'pv-okafor',name:'Dr. Okafor',role:'Dentist',practice:'Harbour Dental',phone:'',address:'',link:'harbourdental.example',photo:null},{id:'pv-chen',name:'Sam Chen',role:'Physiotherapist',practice:'Motion Physio',phone:'',address:'',link:'',photo:null},{id:'pv-old',name:'Dr. Reyes',role:'Therapist',practice:'',phone:'',address:'',link:'',photo:null,archived:true}];
  const CARD={blood:'O+',allergies:[{what:'Penicillin',reaction:'Rash',severity:'moderate'}],vaccines:[{name:'Tetanus (Tdap)',date:'2021-03-10',booster:'2031-03-10'},{name:'Influenza',date:'2025-10-20',booster:''}],conditions:[],
    providers:PV.filter(p=>!p.archived).map(p=>({name:p.name,role:p.role,practice:p.practice,phone:p.phone})),contacts:[]};
  // round 2 sample: cycle, experiments, food trials
  const CY=[];let cst=addDays(TODAY,-9);const clens=[28,30,27,29,31,28,29,30,28];
  for(let k=0;k<9;k++){['medium','heavy','medium','light','light'].forEach((f,j)=>CY.push({on_date:addDays(cst,j),source:'manual',flow:f,symptoms:j===0?['Cramps']:j===1?['Cramps','Fatigue']:[],note:'',source_ref:null}));
    CY.push({on_date:addDays(cst,-1),source:'manual',flow:'spotting',symptoms:['Breast tenderness'],note:'',source_ref:null});cst=addDays(cst,-clens[k])}
  add({type:'observation',occurred_at:'2026-06-01',title:'Switched to fragrance-free soap',regions:['hand_l','hand_r'],concern_id:'c-eczema',notes:'Kitchen and bathroom both.'});
  C.push({id:'c-allergy',title:'Food reactions',regions:['chest','arm_l','arm_r'],started_on:addDays(TODAY,-17),resolved_on:null,status:'active',notes:'Adding one food group back a week on low FODMAP.',tracking:{}});
  const hv=E.find(e=>e.title==='Hives after lunch');if(hv)hv.concern_id='c-allergy';
  add({type:'food_trial',occurred_at:addDays(TODAY,-3),title:'Reintroduced garlic',regions:['whole_body'],details:{food:'Garlic',amount:'Garlic in a pasta sauce',time:'12:30'}});
  add({type:'food_trial',occurred_at:addDays(TODAY,-10),title:'Reintroduced onion',regions:['whole_body'],details:{food:'Onion',amount:'Half an onion, cooked',time:'19:00'}});
  add({type:'food_trial',occurred_at:addDays(TODAY,-17),title:'Reintroduced lactose',regions:['whole_body'],details:{food:'Lactose',amount:'A glass of milk',time:'08:15'}});
  add({type:'observation',occurred_at:addDays(TODAY,-17),title:'Itchy throat',regions:['neck'],concern_id:'c-allergy',details:{severity:'2',time:'10:30',end_date:addDays(TODAY,-17),end_time:'11:15'}});
  add({type:'food_trial',occurred_at:addDays(TODAY,-24),title:'Reintroduced wheat',regions:['whole_body'],details:{food:'Wheat',amount:'Slice of toast',time:'09:00'}});
  R.forEach(r=>{if(r.id==='r-d3')r.ended_on=addDays(TODAY,-31)});
  R.push({id:'r-d4',name:'Low FODMAP, adding one group back a week',category:'diet',started_on:addDays(TODAY,-30),ended_on:null,regions:['whole_body'],notes:''});RC['r-d4']='#C3E55A';
  CH.push({id:'ch-handphases',kind:'phases',title:'Hands: what I was using',started_on:'2026-02-01',days:null,regimen_ids:[],rules:[],notes:'',config:{measures:['itch'],phases:[{name:'Emollient only',from:'2026-02-01',to:'2026-03-31'},{name:'Emollient + night gloves',from:'2026-04-01',to:'2026-05-31'},{name:'Plus fragrance-free soap',from:'2026-06-01',to:TODAY}]}},
    {id:'ch-soap',kind:'before_after',title:'Fragrance-free soap: before and after',started_on:addDays('2026-06-01',-90),days:null,regimen_ids:[],rules:[],notes:'',config:{event_date:'2026-06-01',label:'Fragrance-free soap',window:90,measures:['itch','skin_clarity'],cycle:true,photo_region:'hand_l'}});
  const RM=[{id:'rm-hands',title:'Hand photo',target_kind:'challenge',target_id:'ch1',schedule:{repeat:'weekly',days:[7],time:'09:00'},private:false,skip_if_done:true,enabled:true},
    {id:'rm-cycle',title:'Log your cycle',target_kind:'quick',target_id:'w-qcycle',schedule:{repeat:'daily',time:'21:00'},private:true,skip_if_done:true,enabled:true},
    {id:'rm-tired',title:'Check in: Tiredness',target_kind:'concern',target_id:'c-tired',schedule:{repeat:'weekly',days:[1],time:'20:00'},private:false,skip_if_done:true,enabled:true},
    {id:'rm-skin',title:'Book the skin check',target_kind:'custom',target_id:null,schedule:{repeat:'once',date:addDays(TODAY,14),time:'10:00'},private:false,skip_if_done:false,enabled:true}];
  return {reminders:RM,cycle:CY,regLogs:RL,settings:{card:CARD,providers:PV,units:{weight:'kg',height:'cm'},points_v:2,regimens_v:2,cycle_on:true,teeth:{36:{s:['filled'],since:'2026-03-26',note:'Composite filling.'},46:{s:['root_canal','crown'],since:'2023-05-10',note:''},15:{s:['watch'],since:'2026-03-12',note:'Small shadow on the X-ray. Recheck at next cleaning.'},18:{s:['extracted'],since:'2014-07-02',note:''},28:{s:['extracted'],since:'2014-07-02',note:''},48:{s:['extracted'],since:'2014-07-02',note:''},38:{s:['missing'],since:'',note:'Never came in.'}}},plans:PL,courses:K,entries:E,concerns:C,regimens:R.map(r=>({...r,color:RC[r.id]})),labs:L,challenges:CH,hk:HK,suggestions:S,metrics,points:defaultPoints(),customRegions:{},basePhoto:null,
    widgets:{left:[{id:'w-qcycle',type:'quick',src:'cycle'},{id:uid(),type:'teeth'},{id:uid(),type:'challenge'},{id:uid(),type:'regimens'},{id:uid(),type:'savedchart',chartId:'ch-b12'}],right:[{id:uid(),type:'plan'},{id:uid(),type:'appointments'},{id:uid(),type:'concerns'}]},
    chartLayout:'top',chartZones:[['ch-hands'],['ch-b12','ch-knee'],['ch-mycycle','ch-weight','ch-cycle']],
    charts:[
      {id:'ch-hands',title:'Hand itch and what I was using',y1:'m:itch',y1Type:'column',y1Color:'#4F5BF5',y2:null,y2Type:'line',y2Color:'#C2693F',bands:['r-emollient','r-gloves'],photos:['hand_l'],range:'all'},
      {id:'ch-b12',title:'Vitamin B12',y1:'lab:Vitamin B12',y1Type:'area',y1Color:'#4F5BF5',y2:null,y2Type:'line',y2Color:'#C2693F',bands:['r-b12'],photos:[],range:'all'},
      {id:'ch-knee',title:'Knee: physio and pain',y1:'m:knee_pain',y1Type:'line',y1Color:'#C2693F',y2:null,y2Type:'line',y2Color:'#4F5BF5',bands:['k:k-physio'],sessions:['k-physio'],photos:[],range:'all'},
      {id:'ch-mycycle',kind:'cycle',title:'My cycle',months:3,y1:null,y2:null,bands:[],photos:[],range:'12m'},
      {id:'ch-cycle',title:'Cycle and skin',y1:'m:skin_clarity',y1Type:'column',y1Color:'#8556B5',y2:null,y2Type:'line',y2Color:'#C2693F',bands:['cycle'],markers:['procedure'],photos:[],range:'12m'},
      {id:'ch-weight',title:'Weight and sleep',y1:'m:weight',y1Type:'line',y1Color:'#4F5BF5',y2:'hk:sleep',y2Type:'line',y2Color:'#D8916B',bands:['r-d1','r-d2','r-d3'],photos:[],range:'12m',scroll:true,window:6},
      {id:'ch-sick',title:'Sick days by month',y1:'sick:c-viral',y1More:['sick:c-migraine'],y1Type:'column',y1Color:'#D8916B',y2:null,y2Type:'line',y2Color:'#C2693F',bands:['i:c-viral'],photos:[],range:'12m'},
      {id:'ch-tired',title:'Energy and sleep, same scale',y1:'m:energy',y1More:['m:refreshed'],y1Type:'line',y1Color:'#2E9C8F',y2:null,y2Type:'line',y2Color:'#C2693F',bands:[],photos:[],range:'3m',axes:true,grid:true},
      {id:'ch-cal',kind:'month',title:'Cotton gloves at night',reg:'r-gloves',months:1,y1:null,y2:null,bands:[],photos:[],range:'12m'}
    ]};
}

/* ---------- state ---------- */
let D=null,STORE=null;const CFG=window.MYOS_CONFIG||{storage:'local',sample:false};
const V={tab:'dashboard',region:null,concern:null,type:'all',frame:null,editing:false,customizing:false,editChart:null,photoRegion:'all',apptKind:'all',planYear:+TODAY.slice(0,4),expanded:new Set(),exp:null};
function save(){if(STORE&&D)STORE.save(D)}
const metric=k=>D.metrics[k]||{l:k,u:''};

/* ---------- series (shared by widgets, charts, labs) ---------- */
const HK_LABEL={sleep:'Sleep',sleep_hours:'Sleep',rhr:'Resting heart rate',hrv:'HRV',steps:'Steps',active_kcal:'Active energy',weight:'Weight',body_fat:'Body fat',bedtime:'Bedtime',wake:'Wake time'};
const HK_UNIT={sleep:'h',sleep_hours:'h',rhr:'bpm',hrv:'ms',steps:'',active_kcal:'kcal',weight:'kg',body_fat:'%',bedtime:'',wake:''};
function seriesList(){
  const out=[];
  // a measure with values typed in, or with Health values merged into it (weight, body fat)
  Object.keys(D.metrics).forEach(k=>{if(measurePoints(k).length)out.push({id:'m:'+k,label:metric(k).l,group:'Measurements'})});
  [...new Set(labsOnly().flatMap(l=>l.results.map(r=>r.marker)))].forEach(m=>out.push({id:'lab:'+m,label:m,group:'Lab results'}));
  // counts per month: sick days (all illnesses, or one), days a regimen was done
  const ills=illnesses();
  if(ills.length)out.push({id:'sick:all',label:'Sick days',group:'Per month'});
  if(ills.length>1)ills.forEach(c=>out.push({id:'sick:'+c.id,label:`${c.title} sick days`,group:'Per month'}));
  D.regimens.filter(r=>r.category!=='diet').forEach(r=>out.push({id:'done:'+r.id,label:`${r.name} days`,group:'Per month'}));
  D.regimens.filter(r=>r.category!=='diet').forEach(r=>out.push({id:'r:'+r.id,label:r.name,group:'Regimens & diet'}));
  if(D.regimens.some(r=>r.category==='diet'))out.push({id:'diet',label:'Diet',group:'Regimens & diet'});
  [...new Set(D.entries.filter(e=>e.photos.length&&!(e.details.series==='body')).flatMap(e=>e.regions))].forEach(r=>out.push({id:'ph:'+r,label:`${rl(r)} photos`,group:'Photos'}));
  if(cycleRows().length)out.push({id:'cy:flow',label:'Period flow',group:'Cycle'});
  // weight and body fat sit under Measurements; items turned off stay out of the list
  Object.keys(D.hk||{}).forEach(k=>{if((D.hk[k]||[]).length&&!metricForHk(k)&&hkUseFor(k)!=='off')out.push({id:'hk:'+k,label:`${HK_LABEL[k]||k} (Apple Health)`,group:'Apple Health'})});
  return out;
}
/* one point a month from the month `since` falls in to this month, dated the first; months with nothing count as 0 */
function monthlyPoints(count,since){if(!since)return [];const T=pd(TODAY),s=pd(since),pts=[];
  for(let d=new Date(s.getFullYear(),s.getMonth(),1);d.getTime()<=T.getTime();d=new Date(d.getFullYear(),d.getMonth()+1,1)){const e=new Date(d.getFullYear(),d.getMonth()+1,0);pts.push({d:iso(d),v:count(iso(d),iso(e))})}return pts}
const monthLabel=d=>`${MONTHS[+d.slice(5,7)-1]} ${d.slice(0,4)}`;
function getSeries(id){
  const [k,...rest]=id.split(':'),key=rest.join(':');
  if(k==='m'){const m=metric(key),kd=mkind(key),night=kd==='time_night';
    // weight and height are stored in kg and cm; shown in the unit chosen on the health card
    const u=unitPref(),lb=key==='weight'&&u.weight==='lb',inch=key==='height'&&u.height==='ft';
    const unit=kd==='rating'?(m.u&&m.u.startsWith('/')?m.u:'/5'):kd==='number'?(lb?'lb':inch?'in':m.u):'';
    const conv=v=>lb?lbFromKg(v):inch?+(v/2.54).toFixed(1):v;
    const hkKey=hkKeyForMetric(key),mode=hkKey?hkUse(hkKey):'manual',pts=measurePoints(key);
    return {kind:'line',label:m.l,unit,mkind:kd,fmt:v=>lb||inch?fmtV(v,unit):fmtM(key,v),points:pts.map(p=>({d:p.d,v:conv(night&&p.v<720?p.v+1440:p.v),...(p.src?{src:p.src}:{})})),
      ...(hkKey&&mode==='health'?{sub:'Apple Health'}:pts.some(p=>p.src)?{sub:'with Apple Health'}:{}),rating:kd==='rating',...(kd==='rating'?{scale:ratingRange(unit)}:{}),...(key==='weight'?{step:lb?2:0.5}:key==='height'?{step:1}:{})}}
  if(k==='lab'){const pts=labsOnly().flatMap(l=>l.results.filter(r=>r.marker===key).map(r=>({d:l.date,v:+r.value,flag:r.flag,range:r.range,unit:r.unit}))).sort((a,b)=>a.d<b.d?-1:1);return {kind:'line',label:key,unit:pts[0]?pts[0].unit:'',points:pts,lab:true}}
  if(k==='sick'||k==='done'){const r=k==='done'?D.regimens.find(x=>x.id===key):null,cs=k==='sick'?(key==='all'?illnesses():illnesses().filter(c=>c.id===key)):[];
    if(k==='done'&&!r)return null;if(k==='sick'&&!cs.length)return null;
    const label=k==='done'?`${r.name} days`:key==='all'?'Sick days':`${cs[0].title} sick days`;
    const since=k==='done'?stintsOf(r)[0].from:cs.map(c=>(episodesOf(c)[0]||{}).from).filter(Boolean).sort()[0];
    return {kind:'line',label,unit:'days',points:monthlyPoints(k==='done'?(f,t)=>new Set(logsOf(key,f,t).map(l=>l.on_date)).size:(f,t)=>cs.reduce((a,c)=>a+sickDays(c,f,t),0),since),monthly:true}}
  if(k==='cy'){const lv={none:0,spotting:1,light:2,medium:3,heavy:4,unspecified:2},nm=['None','Spotting','Light','Medium','Heavy'];
    const pts=[...new Set(cycleRows().map(x=>x.on_date))].sort().map(d=>({d,v:lv[cycleRec(d).flow]||0}));return {kind:'line',label:'Period flow',unit:'',points:pts,fmt:v=>v<0||v>4||v%1?'':nm[v]}}
  if(k==='hk'){const mk=metricForHk(key);if(mk)return getSeries('m:'+mk);// older charts that picked the Health series: it is the measure now
    const pts=hkUseFor(key)==='off'?[]:(D.hk[key]||[]).slice(),kd=key==='bedtime'?'time_night':key==='wake'?'time':undefined,lb=key==='weight'&&unitPref().weight==='lb';
    return {kind:'line',label:HK_LABEL[key]||key,unit:lb?'lb':HK_UNIT[key]??'',points:pts.map(p=>({d:p.d,v:lb?lbFromKg(p.v):kd==='time_night'&&p.v<720?p.v+1440:p.v})),sub:'Apple Health',mkind:kd,fmt:kd?v=>hhmm(v):undefined,...(key==='weight'?{step:lb?2:0.5}:{})}}
  if(k==='r'){const r=D.regimens.find(x=>x.id===key);if(!r)return null;return {kind:'bars',label:r.name,sub:[r.dose,r.frequency].filter(Boolean).join(' · '),segments:stintsOf(r).map(p=>({from:p.from,to:p.to||TODAY,label:r.dose||r.name,open:!p.to}))}}
  if(id==='diet'){return {kind:'bars',label:'Diet',sub:'Qualitative',segments:D.regimens.filter(r=>r.category==='diet').flatMap(r=>stintsOf(r).map(p=>({from:p.from,to:p.to||TODAY,label:r.name,open:!p.to}))).sort((a,b)=>a.from<b.from?-1:1)}}
  if(k==='ph'){const dates=D.entries.filter(e=>e.photos.length&&e.regions.includes(key)&&e.details.series!=='body').map(e=>({d:e.occurred_at,id:e.id}));return {kind:'dots',label:`${rl(key)} photos`,sub:`${dates.length} photos`,dots:dates}}
  return null;
}
const lastVal=s=>s&&s.points&&s.points.length?s.points[s.points.length-1]:null;
const fmtV=(v,u)=>`${+(+v).toFixed(2)}${u?(u.startsWith('/')||u==='%'?u:' '+u):''}`;
const mkind=k=>{const m=metric(k);return m.kind||(m.rating?'rating':'number')};
const hhmm=min=>{min=((Math.round(min)%1440)+1440)%1440;const h=Math.floor(min/60),m=min%60;return `${h%12||12}:${String(m).padStart(2,'0')} ${h<12?'AM':'PM'}`};
const toHHMM=min=>{min=((Math.round(min)%1440)+1440)%1440;return `${String(Math.floor(min/60)).padStart(2,'0')}:${String(min%60).padStart(2,'0')}`};
const tfmt=s=>{if(!s)return '';const [h,m]=s.split(':').map(Number);return hhmm(h*60+m)};
const dur=min=>{min=Math.round(min);const h=Math.floor(min/60),m=min%60;return h?`${h} h${m?` ${m} min`:''}`:`${m} min`};
function fmtM(k,v){const kd=mkind(k);if(kd==='time'||kd==='time_night')return hhmm(v);if(kd==='duration')return dur(v);return fmtV(v,metric(k).u)}
const KIND_OPTS=[['number','A number with a unit'],['rating','My own rating, 1 to 5 or 0 to 10'],['time','A time of day'],['time_night','A time around midnight, like bedtime'],['duration','A length of time']];
const PER_LABEL={day:'Every day',week:'Every week',month:'Every month'};
/* ---------- cycle tracking: one record per day per source; manual wins over imports ---------- */
const FLOW=[['none','None'],['spotting','Spotting'],['light','Light'],['medium','Medium'],['heavy','Heavy']];
const FLOW_COL={spotting:'#F2B8C6',light:'#EE8FA8',medium:'#E05A7E',heavy:'#B8264F',unspecified:'#E05A7E'};
const SYMPTOMS=['Cramps','Bloating','Breast tenderness','Headache','Acne','Mood changes','Fatigue','Back pain'];
const SRC_NAME={manual:'you',apple_health:'Apple Health'};
/* the cycle rows in play: your own, and imported ones unless the Apple Health cycle item is switched off */
const cycleRows=()=>(D.cycle||[]).filter(c=>c.source==='manual'||hkUse('cycle')!=='off');
function cycleRec(d){const rs=cycleRows().filter(c=>c.on_date===d);return rs.find(c=>c.source==='manual')||rs[0]||null}
function cyclePeriods(){
  const days=[...new Set(cycleRows().map(c=>c.on_date))].sort().filter(d=>{const r=cycleRec(d);return r&&['light','medium','heavy','unspecified'].includes(r.flow)});
  const out=[];days.forEach(d=>{const last=out[out.length-1];if(last&&dayDiff(last.end,d)<=2)last.end=d;else out.push({start:d,end:d})});
  out.forEach(p=>p.len=dayDiff(p.start,p.end)+1);return out;
}
function cycleDayOf(d){const ps=cyclePeriods().filter(p=>p.start<=d),p=ps[ps.length-1];if(!p)return null;const n=dayDiff(p.start,d)+1;return n<=60?n:null}
function cycleLengths(){const ps=cyclePeriods();return ps.slice(1).map((p,i)=>({start:ps[i].start,len:dayDiff(ps[i].start,p.start)}))}
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
function cycleStatsIn(from,to){const ps=cyclePeriods().filter(p=>p.start>=from&&p.start<=to),cl=cycleLengths().filter(c=>c.start>=from&&c.start<=to);return {periods:ps.length,cycleLen:avg(cl.map(c=>c.len)),periodLen:avg(ps.map(p=>p.len))}}
function openCycleDay(date){
  const d=date||TODAY,cur=(D.cycle||[]).find(c=>c.on_date===d&&c.source==='manual')||{flow:'none',symptoms:[],note:''};
  const imp=(D.cycle||[]).find(c=>c.on_date===d&&c.source!=='manual');
  const sym=new Set(cur.symptoms||[]);let flow=cur.flow||'none';
  openSheet(`<div class="sheet-h"><h3>${ico('cycle')}Cycle day</h3><button class="x" type="button" aria-label="Close">✕</button></div>
   <form class="form" id="cyForm" novalidate><div class="f"><label for="cy_d">Date</label><input id="cy_d" type="date" value="${d}"></div>
   ${imp?`<p class="story-p">Also recorded by ${esc(SRC_NAME[imp.source]||imp.source)}: ${esc(imp.flow)}. What you enter here is shown instead.</p>`:''}
   <div class="f"><span class="l">Flow</span><div class="seg flowseg" id="cyFlow">${FLOW.map(([v,l])=>`<button type="button" data-flow="${v}" class="${flow===v?'on':''}">${l}</button>`).join('')}</div></div>
   <div class="f"><span class="l">Symptoms (optional)</span><div class="chips" id="cySym">${[...new Set([...SYMPTOMS,...sym])].map(s=>`<button type="button" class="chip${sym.has(s)?' on':''}" data-sym="${esc(s)}">${esc(s)}</button>`).join('')}</div><input id="cy_new" placeholder="Add another symptom" style="margin-top:6px"></div>
   <div class="f"><label for="cy_n">Note (optional)</label><textarea id="cy_n">${esc(cur.note||'')}</textarea></div>
   <div class="form-acts"><span></span><button class="btn-accent" type="submit">Save</button></div></form>`);
  $('#cyFlow').addEventListener('click',e=>{const b=e.target.closest('[data-flow]');if(!b)return;flow=b.dataset.flow;$('#cyFlow').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b))});
  $('#cySym').addEventListener('click',e=>{const b=e.target.closest('[data-sym]');if(!b)return;sym.has(b.dataset.sym)?sym.delete(b.dataset.sym):sym.add(b.dataset.sym);b.classList.toggle('on')});
  $('#cyForm').addEventListener('submit',e=>{e.preventDefault();const day=$('#cy_d').value||TODAY,nw=$('#cy_new').value.trim();if(nw)sym.add(nw);const note=$('#cy_n').value.trim();
    D.cycle=(D.cycle||[]).filter(c=>!(c.on_date===day&&c.source==='manual'));
    if(flow!=='none'||sym.size||note)D.cycle.push({on_date:day,source:'manual',flow,symptoms:[...sym],note,source_ref:null});
    save();closeSheet();render()});
}
function monthGrid(y,m){
  const first=new Date(y,m,1),lead=(first.getDay()+6)%7,days=new Date(y,m+1,0).getDate();let cells='';
  for(let i=0;i<lead;i++)cells+='<span></span>';
  for(let n=1;n<=days;n++){const ds=iso(new Date(y,m,n)),r=cycleRec(ds),col=r&&FLOW_COL[r.flow];
    cells+=`<button type="button" class="cday${ds===TODAY?' today':''}${r&&(r.symptoms||[]).length?' sym':''}${ds>TODAY?' future':''}" data-cday="${ds}"${col?` style="background:${col};color:#fff"`:''} aria-label="${fmt(ds)}${r?', '+r.flow:''}">${n}</button>`}
  return `<div class="cmonth"><div class="cmh">${MONTHS[m]} ${y}</div><div class="cdw">${['M','T','W','T','F','S','S'].map(x=>`<span>${x}</span>`).join('')}</div><div class="cgrid2">${cells}</div></div>`;
}
function cycleOn(){return !!(D.settings.cycle_on||cycleRows().length)}
/* the cycle chart: your logged days on a calendar, with past averages. Never a prediction. */
function cycleChartBody(c,small){
  const n=small?1:(+c.months||3),t=pd(TODAY),months=[...Array(n)].map((_,i)=>{const d=new Date(t.getFullYear(),t.getMonth()-(n-1-i),1);return [d.getFullYear(),d.getMonth()]});
  const ps=cyclePeriods(),last=ps[ps.length-1],cd=cycleDayOf(TODAY),cl=cycleLengths().slice(-6),imp=(D.cycle||[]).some(x=>x.source!=='manual');
  const stats=`<div class="cstats"><div><b>${cd?'Day '+cd:'–'}</b><span>of your cycle today</span></div><div><b>${last?fmtShort(last.start):'–'}</b><span>last period started${last?' · '+last.len+' days':''}</span></div>
    <div><b>${cl.length?Math.round(avg(cl.map(x=>x.len)))+' days':'–'}</b><span>average cycle${cl.length?', last '+cl.length:''}</span></div><div><b>${ps.length?Math.round(avg(ps.slice(-6).map(p=>p.len)))+' days':'–'}</b><span>average period</span></div></div>`;
  const legend=`<div class="legend">${FLOW.slice(1).map(([v,l])=>`<span class="lg"><i class="bx" style="background:${FLOW_COL[v]}"></i>${l}</span>`).join('')}<span class="lg">A dot under a day means symptoms were logged</span></div>`;
  if(small)return `${stats}<div class="cmonths">${months.map(([y,m])=>monthGrid(y,m)).join('')}</div>`;
  return `${stats}<div class="cmonths">${months.map(([y,m])=>monthGrid(y,m)).join('')}</div>${legend}
   <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px"><button type="button" class="btn-accent btn-sm" data-cday="${TODAY}">Log today</button><span class="disclaim" style="margin:0">Tap any day to log it. Averages of your own records; nothing here predicts anything.${imp?' Includes days from Apple Health; what you log yourself comes first.':''}</span></div>`;
}
function cycleBuilder(c){return `<div class="builder"><div class="brow"><span>Title</span><input class="inp" data-cb="title" value="${esc(c.title)}" aria-label="Chart title" style="width:100%;max-width:420px"></div>
  <div class="brow"><span>Show</span><div class="chips">${[1,3,6,12].map(n=>`<button type="button" class="chip${(+c.months||3)===n?' on':''}" data-cym="${n}">${n} month${n>1?'s':''}</button>`).join('')}</div></div>
  <div class="brow"><span></span><div><button type="button" class="btn-accent" data-cact="done:${c.id}">Done</button></div></div></div>`}
function openChartChooser(){
  openSheet(`<div class="sheet-h"><h3>New chart</h3><button class="x" type="button" aria-label="Close">✕</button></div><div class="types" style="grid-template-columns:minmax(0,1fr)">
   <button type="button" class="type" data-ct="chart">${ico('measurement')}<b>Chart</b><span>Your values over time on up to two axes: measures, labs, Apple Health, and counts by month like sick days. Lines, areas, columns or dots, with regimens, periods and photos alongside.</span></button>
   <button type="button" class="type" data-ct="month">${ico('appointment')}<b>Calendar</b><span>One regimen a day at a time: the days you took the magnesium, the days you missed. Click a day to tick it.</span></button>
   <button type="button" class="type" data-ct="cycle">${ico('cycle')}<b>Cycle</b><span>Your period, spotting and symptoms on a calendar, with your average cycle and period length.</span></button></div>`);
  $('#overlay').querySelector('.types').addEventListener('click',e=>{const b=e.target.closest('[data-ct]');if(!b)return;closeSheet();const k=b.dataset.ct;
    if(k==='cycle'){newChart({kind:'cycle',title:'My cycle',months:3,y1:null});V.editChart=null;D.settings.cycle_on=true;save()}
    else if(k==='month'){const r=D.regimens.find(x=>x.category!=='diet'&&!x.ended_on);newChart({kind:'month',title:r?r.name:'Calendar',months:1,y1:null,reg:r?r.id:undefined})}
    else newChart();
    render();window.scrollTo({top:0,behavior:'smooth'})});
}
/* ---------- experiments: challenge | phases | before_after ---------- */
const EXP_LABEL={challenge:'Check-in challenge',phases:'Phases',before_after:'Before and after'};
const expKind=c=>c.kind||'challenge';
const chOnly=()=>D.challenges.filter(c=>expKind(c)==='challenge');
function ruleHit(r,a,b){if(r.kind==='regimen')return logsOf(r.regimen,a,b).length>0;
  return D.entries.some(e=>e.occurred_at>=a&&e.occurred_at<=b&&(r.kind==='photo'?(e.photos.length&&e.regions.includes(r.region)):(e.type==='measurement'&&e.details.metric===r.metric)))}
const perDays=per=>per==='day'?1:per==='week'?7:30;
/* "Daily face photo", "Weekly weight": a check-in as a heading */
const ruleTitle=r=>{const p=r.per==='day'?'Daily':r.per==='week'?'Weekly':'Monthly';return `${p} ${r.kind==='regimen'?r.label:r.label.charAt(0).toLowerCase()+r.label.slice(1)}`};
const perUnit=(per,n)=>(per==='day'?'day':per)+(n===1?'':'s');
/* where a check-in stands right now: due, or up to date. A missed period cannot be caught up, so the headline (label) says
   only where today stands; the detail adds how many were missed, for the challenge's own page */
function ruleStatus(c,r){const cells=ruleCellList(c,r),n=cells.length,hit=cells.filter(x=>x.st==='hit').length,miss=cells.filter(x=>x.st==='miss').length,open=cells.some(x=>x.st==='open'),fut=cells.some(x=>x.st==='fut');
  if(c.started_on>TODAY){const l='Starts '+fmtShort(c.started_on);return {st:'soon',label:l,detail:l,hit,n}}
  if(!open&&!fut){const l=`Finished, ${hit} of ${n}`;return {st:'done',label:l,detail:l,hit,n}}
  const label=open?(r.per==='day'?'Due today':`Due this ${r.per}`):'Up to date';
  return {st:open?'due':'ok',label,detail:miss?`${label} · ${miss} missed`:label,hit,n}}
function ruleCellList(c,r){const per=perDays(r.per),n=Math.ceil((c.days||1)/per),out=[];
  for(let i=0;i<n;i++){const a=addDays(c.started_on,i*per),b=addDays(c.started_on,(i+1)*per-1);out.push({a,b,st:a>TODAY?'fut':ruleHit(r,a,b)?'hit':b>=TODAY?'open':'miss'})}return out}
const statusClass=st=>st==='due'?'st-due':st==='ok'||st==='done'?'st-ok':'';
function statIn(k,from,to){const night=mkind(k)==='time_night';const vs=D.entries.filter(e=>e.type==='measurement'&&e.details.metric===k&&e.occurred_at>=from&&e.occurred_at<=to).map(e=>{const v=+e.details.value;return night&&v<720?v+1440:v});
  return {n:vs.length,avg:avg(vs)}}
const statTxt=(k,s)=>s.n?`${fmtM(k,s.avg)}<small> avg · ${s.n}</small>`:'<small>nothing logged</small>';
function lastPhotoIn(region,from,to){return D.entries.filter(e=>e.photos.length&&e.regions.includes(region)&&e.details.series!=='body'&&e.occurred_at>=from&&e.occurred_at<=to).sort(byDateDesc())[0]}
function baBody(c,full){
  const cf=c.config||{},ev=cf.event_date,w=+cf.window||90,bFrom=addDays(ev,-w),bTo=addDays(ev,-1),aFrom=ev,aTo=addDays(ev,w-1),future=ev>TODAY;
  const rows=(cf.measures||[]).filter(k=>D.metrics[k]).map(k=>`<tr><td>${esc(metric(k).l)}</td><td>${statTxt(k,statIn(k,bFrom,bTo))}</td><td>${future?'<small>after '+fmtShort(ev)+'</small>':statTxt(k,statIn(k,aFrom,aTo>TODAY?TODAY:aTo))}</td></tr>`);
  if(cf.cycle){const b=cycleStatsIn(bFrom,bTo),a=cycleStatsIn(aFrom,aTo);const f=(v,u)=>v==null?'<small>–</small>':`${Math.round(v)} ${u}`;
    rows.push(`<tr><td>Cycle length</td><td>${f(b.cycleLen,'days')}</td><td>${future?'':f(a.cycleLen,'days')}</td></tr><tr><td>Period length</td><td>${f(b.periodLen,'days')}</td><td>${future?'':f(a.periodLen,'days')}</td></tr>`)}
  let photos='';if(full&&cf.photo_region){const pb=lastPhotoIn(cf.photo_region,bFrom,bTo),pa=future?null:lastPhotoIn(cf.photo_region,aFrom,aTo);
    photos=`<div class="bapics"><div>${pb?`<div class="bapic">${photoHTML(pb.photos[0],pb.title,pb.occurred_at)}</div><small>${fmt(pb.occurred_at)}</small>`:'<small>No photo before</small>'}</div><div>${pa?`<div class="bapic">${photoHTML(pa.photos[0],pa.title,pa.occurred_at)}</div><small>${fmt(pa.occurred_at)}</small>`:`<small>${future?'After '+fmtShort(ev):'No photo after'}</small>`}</div></div>`}
  const base=future?`<p class="story-p">Baseline running: logging before ${fmt(ev)} gives you something to compare against.</p>`:'';
  return `${base}<table class="batable"><thead><tr><th></th><th>${w} days before</th><th>${w} days after</th></tr></thead><tbody>${rows.join('')||'<tr><td colspan="3"><small>Pick some measures to compare.</small></td></tr>'}</tbody></table>${photos}`;
}
function phasesBody(c){const cf=c.config||{};
  return `<div class="list">${(cf.phases||[]).map(p=>{const to=p.to>TODAY?TODAY:p.to;return `<div class="row" style="align-items:flex-start"><span><span class="t">${esc(p.name)}</span><br><span class="s">${fmtShort(p.from)} – ${p.to>=TODAY?'now':fmtShort(p.to)}</span></span><span class="phstats">${(cf.measures||[]).filter(k=>D.metrics[k]).map(k=>`<span><b>${esc(metric(k).l)}</b> ${statTxt(k,statIn(k,p.from,to))}</span>`).join('')}</span></div>`}).join('')}</div>`}
function expCard(c){const k=expKind(c);
  if(k==='challenge')return `<button type="button" class="rcard" data-challenge="${c.id}"><span class="xk">Challenge</span>${challengeBlock(c)}</button>`;
  return `<button type="button" class="rcard xcard" data-exp="${c.id}"><span class="xk">${EXP_LABEL[k]}</span><span class="t" style="font-size:15px">${esc(c.title)}</span>${k==='phases'?phasesBody(c):baBody(c,false)}</button>`}
function openExperiment(id){openExpPage(id)}
const metricChips=sel=>`<div class="chips" id="xMet">${Object.entries(D.metrics).map(([mk,m])=>`<button type="button" class="chip${sel.has(mk)?' on':''}" data-xm="${mk}">${esc(m.l)}</button>`).join('')}</div>`;
const wireMetricChips=sel=>$('#xMet').addEventListener('click',e=>{const b=e.target.closest('[data-xm]');if(!b)return;sel.has(b.dataset.xm)?sel.delete(b.dataset.xm):sel.add(b.dataset.xm);b.classList.toggle('on')});
function openNewExperiment(){
  openSheet(`<div class="sheet-h"><h3>New experiment</h3><button class="x" type="button" aria-label="Close">✕</button></div><div class="types" style="grid-template-columns:minmax(0,1fr)">
   <button type="button" class="type" data-xk="challenge">${ico('challenge')}<b>Challenge</b><span>Do something for a set time, with check-ins. "90 days of red light, photo every week."</span></button>
   <button type="button" class="type" data-xk="phases">${ico('challenge')}<b>Phases</b><span>Try things one after another and compare each stretch. "Yoga only, then physio only, then both."</span></button>
   <button type="button" class="type" data-xk="before_after">${ico('challenge')}<b>Before and after</b><span>Compare the weeks either side of a change. "Before and after a new medication."</span></button></div>`);
  $('#overlay').querySelector('.types').addEventListener('click',e=>{const b=e.target.closest('[data-xk]');if(!b)return;const k=b.dataset.xk;k==='challenge'?openChallenge():k==='phases'?openPhases():openBeforeAfter()});
}
function openPhases(pre={}){
  const cf=pre.config||{},sel=new Set(cf.measures||[]);const prow=(n='',f='',t='')=>`<div class="crow"><input data-f="name" placeholder="Phase name" value="${esc(n)}" aria-label="Phase name"><input data-f="from" type="date" value="${f}" aria-label="From"><input data-f="to" type="date" value="${t}" aria-label="To"><button type="button" class="rm" data-crm aria-label="Remove">✕</button></div>`;
  const phRegs=[...new Set(D.entries.filter(e=>e.photos.length&&e.details.series!=='body').flatMap(e=>e.regions))];
  const rows=(cf.phases||[]).length?cf.phases.map(p=>prow(p.name,p.from,p.to)).join(''):prow('',TODAY,addDays(TODAY,55))+prow('',addDays(TODAY,56),addDays(TODAY,111));
  openSheet(`<div class="sheet-h"><h3>${ico('challenge')}${pre.id?'Edit phases':'Phases'}</h3><button class="x" type="button" aria-label="Close">✕</button></div>
   <form class="form" id="phForm" novalidate><div class="f"><label for="ph_t">Name</label><input id="ph_t" value="${esc(pre.title||'')}" placeholder="Posture: what helps"></div>
   <div class="f"><span class="l">Phases</span><div class="list" id="phRows">${rows}</div><button type="button" class="btn-ghost btn-sm" id="phAdd" style="margin-top:6px;align-self:flex-start">+ Phase</button></div>
   <div class="f"><span class="l">Measures to compare</span>${metricChips(sel)}</div>
   <div class="f"><label for="ph_p">Photos (optional)</label><select id="ph_p"><option value="">None</option>${phRegs.map(r=>`<option value="${r}"${cf.photo_region===r?' selected':''}>${esc(rl(r))}</option>`).join('')}</select></div>
   <div class="f"><label for="ph_n">Notes (optional)</label><textarea id="ph_n">${esc(pre.notes||'')}</textarea></div>
   <div class="form-acts"><span></span><button class="btn-accent" type="submit">${pre.id?'Save':'Create'}</button></div><div class="err" id="phErr"></div></form>`);
  wireMetricChips(sel);
  $('#phAdd').addEventListener('click',()=>$('#phRows').insertAdjacentHTML('beforeend',prow()));
  $('#phRows').addEventListener('click',e=>{const r=e.target.closest('[data-crm]');if(r)r.closest('.crow').remove()});
  $('#phForm').addEventListener('submit',e=>{e.preventDefault();const t=$('#ph_t').value.trim(),err=m=>{$('#phErr').textContent=m};if(!t)return err('Name it.');
    const phases=[...document.querySelectorAll('#phRows .crow')].map(r=>Object.fromEntries([...r.querySelectorAll('[data-f]')].map(i=>[i.dataset.f,i.value.trim()]))).filter(p=>p.name&&p.from&&p.to);
    if(!phases.length)return err('Add at least one phase with a name and dates.');if(phases.some(p=>p.to<p.from))return err('A phase ends before it starts.');
    phases.sort((a,b)=>a.from<b.from?-1:1);
    upsertExp({...pre,id:pre.id||'ch-'+uid(),kind:'phases',title:t,started_on:phases[0].from,days:null,regimen_ids:pre.regimen_ids||[],rules:[],notes:$('#ph_n').value.trim(),config:{phases,measures:[...sel],photo_region:$('#ph_p').value||''}})});
}
function openBeforeAfter(pre={}){
  const cf=pre.config||{},sel=new Set(cf.measures||[]);
  const phRegs=[...new Set(D.entries.filter(e=>e.photos.length&&e.details.series!=='body').flatMap(e=>e.regions))];
  openSheet(`<div class="sheet-h"><h3>${ico('challenge')}${pre.id?'Edit before and after':'Before and after'}</h3><button class="x" type="button" aria-label="Close">✕</button></div>
   <form class="form" id="baForm" novalidate><div class="f2"><div class="f"><label for="ba_l">The change</label><input id="ba_l" value="${esc(cf.label||'')}" placeholder="Started a new medication"></div><div class="f"><label for="ba_d">On</label><input id="ba_d" type="date" value="${esc(cf.event_date||TODAY)}"></div>
   <div class="f"><label for="ba_w">Compare</label><select id="ba_w">${[30,60,90,180].map(n=>`<option value="${n}"${(+cf.window||90)===n?' selected':''}>${n} days either side</option>`).join('')}</select></div>
   <div class="f"><label for="ba_p">Photos (optional)</label><select id="ba_p"><option value="">None</option>${phRegs.map(r=>`<option value="${r}"${cf.photo_region===r?' selected':''}>${esc(rl(r))}</option>`).join('')}</select></div></div>
   <div class="f"><span class="l">Measures to compare</span>${metricChips(sel)}</div>
   ${cycleOn()?`<label class="chk"><input type="checkbox" id="ba_c"${cf.cycle!==false?' checked':''}> Include cycle and period length</label>`:''}
   <div class="f"><label for="ba_n">Notes (optional)</label><textarea id="ba_n">${esc(pre.notes||'')}</textarea></div>
   <p class="story-p" style="margin:0">If the change is still ahead, this starts a baseline: keep logging these and the comparison fills in after.</p>
   <div class="form-acts"><span></span><button class="btn-accent" type="submit">${pre.id?'Save':'Create'}</button></div><div class="err" id="baErr"></div></form>`);
  wireMetricChips(sel);
  $('#baForm').addEventListener('submit',e=>{e.preventDefault();const l=$('#ba_l').value.trim();if(!l){$('#baErr').textContent='Name the change.';return}
    const ev=$('#ba_d').value||TODAY,w=+$('#ba_w').value,cb=$('#ba_c');
    upsertExp({...(pre.id?pre:{}),id:pre.id||'ch-'+uid(),kind:'before_after',title:`${l}: before and after`,started_on:addDays(ev,-w),days:null,regimen_ids:pre.regimen_ids||[],rules:[],notes:$('#ba_n').value.trim(),config:{event_date:ev,label:l,window:w,measures:[...sel],cycle:cb?cb.checked:false,photo_region:$('#ba_p').value||''}})});
}
/* ---------- yearly plan categories ---------- */
const DEF_PLAN_CATS=[{id:'physical',name:'Physical health'},{id:'oral',name:'Oral health'},{id:'mental',name:'Mental health'},{id:'skin',name:'Skin health'},{id:'eyes',name:'Eye health'},{id:'other',name:'Other'}];
function planCats(){if(!Array.isArray(D.settings.planCats))D.settings.planCats=DEF_PLAN_CATS.map(c=>({...c}));
  // Eye health and Other joined the defaults later; once, they are added to categories made before them (they can be deleted)
  if(!D.settings.planCatsEyes){D.settings.planCatsEyes=true;if(!D.settings.planCats.some(c=>c.id==='eyes'))D.settings.planCats.push({id:'eyes',name:'Eye health'})}
  if(!D.settings.planCatsOther){D.settings.planCatsOther=true;if(!D.settings.planCats.some(c=>c.id==='other'))D.settings.planCats.push({id:'other',name:'Other'})}
  return D.settings.planCats}
function planSectionHTML(){
  const items=plansFor(V.planYear),cats=planCats(),known=new Set(cats.map(c=>c.id)),other=items.filter(p=>!known.has(p.category));
  const group=(id,name,ps)=>`<div class="pcat"><div class="pcat-h"><h3>${esc(name)}</h3><span class="s">${ps.length?ps.length+(ps.length>1?' items':' item'):''}</span><button type="button" class="btn-ghost btn-sm" data-addplan="${esc(id)}">+ Add</button></div>
    ${ps.length?`<div class="rgrid">${ps.map(planCard).join('')}</div>`:`<div class="pcat-empty">Nothing planned for ${esc(name.toLowerCase())} in ${V.planYear}.</div>`}</div>`;
  const empty=!items.length&&plansFor(V.planYear-1).length?`<div class="row" style="background:var(--soft)"><span class="s">Nothing planned for ${V.planYear} yet.</span><button type="button" class="btn-dark btn-sm" data-act="copy-plan">Copy ${V.planYear-1} plan</button></div>`:'';
  return `<section class="card" id="planSec"><div class="card-h"><div class="yearnav"><button type="button" class="dots" data-pyear="-1" aria-label="Previous year">‹</button><h2>${V.planYear} plan</h2><button type="button" class="dots" data-pyear="1" aria-label="Next year">›</button></div><span style="display:flex;gap:8px;align-items:center"><span class="sub">${+V.planYear===+YEAR?'What you want to get done this year':+V.planYear>+YEAR?'Planning ahead':'Looking back'}</span><button type="button" class="btn-ghost btn-sm" data-act="plan-cats">Categories</button></span></div>
   ${empty}<div class="pcats">${cats.map(c=>group(c.id,c.name,items.filter(p=>p.category===c.id))).join('')}${other.length?group('','Other',other):''}</div></section>`;
}
function openPlanCats(){
  const row=(c={id:'',name:''})=>`<div class="crow" data-pc="${esc(c.id)}"><input value="${esc(c.name)}" placeholder="Category name" aria-label="Category name"><button type="button" class="rm" data-pcu aria-label="Move up">↑</button><button type="button" class="rm" data-crm aria-label="Remove">✕</button></div>`;
  openSheet(`<div class="sheet-h"><h3>Plan categories</h3><button class="x" type="button" aria-label="Close">✕</button></div>
   <p class="story-p" style="margin-top:0">Group your yearly plan however suits you. Removing a category moves its items to Other; nothing is deleted.</p>
   <div class="list" id="pcRows">${planCats().map(row).join('')}</div>
   <button type="button" class="btn-ghost btn-sm" id="pcAdd" style="margin-top:8px">+ Category</button>
   <div class="form-acts" style="margin-top:14px"><button type="button" class="btn-ghost" id="pcReset">Back to the default four</button><button type="button" class="btn-accent" id="pcSave">Save</button></div>`);
  $('#pcAdd').addEventListener('click',()=>{$('#pcRows').insertAdjacentHTML('beforeend',row());const ins=$('#pcRows').querySelectorAll('input');ins[ins.length-1].focus()});
  $('#pcRows').addEventListener('click',e=>{const r=e.target.closest('.crow');if(!r)return;if(e.target.closest('[data-crm]'))r.remove();else if(e.target.closest('[data-pcu]')&&r.previousElementSibling)r.parentNode.insertBefore(r,r.previousElementSibling)});
  $('#pcReset').addEventListener('click',()=>{$('#pcRows').innerHTML=DEF_PLAN_CATS.map(row).join('')});
  $('#pcSave').addEventListener('click',()=>{const used=new Set();
    D.settings.planCats=[...document.querySelectorAll('#pcRows .crow')].map(r=>{const name=r.querySelector('input').value.trim();if(!name)return null;let id=r.dataset.pc||name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'c';while(used.has(id))id+='-'+uid().slice(0,3);used.add(id);return {id,name}}).filter(Boolean);
    save();closeSheet();render()});
}
function viewPlan(){
  const c=V.exp&&D.challenges.find(x=>x.id===V.exp);if(c)return expPage(c);V.exp=null;
  return `<div class="page-h" style="margin-bottom:16px"><div><h1>Plan</h1><span class="sub">What you're aiming for: the experiments you're running and this year's plan.</span></div><span style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn-ghost" data-act="add-plan">+ Plan item</button><button type="button" class="btn-accent" data-act="new-exp">+ Experiment</button></span></div>
  <div style="display:flex;flex-direction:column;gap:16px"><section class="card"><div class="card-h"><h2>Experiments</h2><span class="sub">Tap one to see everything in it</span></div><div class="xgrid">${D.challenges.slice().sort((a,b)=>a.started_on<b.started_on?1:-1).map(expCard).join('')||'<div class="empty">No experiments yet.</div>'}</div></section>
  ${planSectionHTML()}${remindersSection()}</div>`;
}
/* ---------- experiment page: everything that belongs to one experiment ---------- */
function upsertExp(o){const i=D.challenges.findIndex(x=>x.id===o.id);if(i>=0)D.challenges[i]=o;else D.challenges.push(o);save();closeSheet();render()}
function openExpPage(id){V.tab='plan';V.exp=id;V.customizing=false;closeSheet();render();window.scrollTo({top:0})}
function expRange(c){const k=expKind(c),cf=c.config||{};
  if(k==='challenge')return {from:c.started_on,to:addDays(c.started_on,c.days-1)};
  if(k==='phases'){const ps=cf.phases||[];return {from:ps[0]?ps[0].from:c.started_on,to:ps.length?ps[ps.length-1].to:TODAY}}
  const w=+cf.window||90;return {from:addDays(cf.event_date,-w),to:addDays(cf.event_date,w-1)}}
const expRegions=c=>expKind(c)==='challenge'?c.rules.filter(r=>r.kind==='photo').map(r=>r.region):((c.config||{}).photo_region?[c.config.photo_region]:[]);
const expMetrics=c=>expKind(c)==='challenge'?c.rules.filter(r=>r.kind==='metric').map(r=>r.metric):((c.config||{}).measures||[]);
const expRegs=c=>[...new Set([...(c.regimen_ids||[]),...(c.rules||[]).filter(r=>r.kind==='regimen').map(r=>r.regimen)])].map(i=>D.regimens.find(r=>r.id===i)).filter(Boolean);
function ruleCells(c,r){const per=r.per==='day'?1:r.per==='week'?7:30,n=Math.ceil(c.days/per);let out='';
  for(let i=0;i<n;i++){const a=addDays(c.started_on,i*per),b=addDays(c.started_on,(i+1)*per-1);
    const st=a>TODAY?'fut':ruleHit(r,a,b)?'hit':b>=TODAY?'open':'miss';
    out+=`<span class="rc ${st}" title="${fmtShort(a)}${per>1?' – '+fmtShort(b):''}: ${st==='hit'?'done':st==='miss'?'missed':st==='open'?'still open':'ahead'}"></span>`}
  return `<div class="rcells">${out}</div>`}
const photoTile=e=>`<button type="button" class="pcell" data-entry="${e.id}"><div class="pbox">${photoHTML(e.photos[0],e.title,e.occurred_at)}</div><span>${fmt(e.occurred_at)}</span></button>`;
function expPhotos(c,from,to){const rs=expRegions(c);if(!rs.length)return [];
  return D.entries.filter(e=>e.photos.length&&e.details.series!=='body'&&e.occurred_at>=from&&e.occurred_at<=to&&e.regions.some(r=>rs.includes(r))).sort(asc)}
function expPage(c){
  const k=expKind(c),{from,to}=expRange(c),end=to>TODAY?TODAY:to,cf=c.config||{};
  const head=`<button type="button" class="linkish backl" data-act="exp-back">‹ Plan</button>
   <div class="page-h" style="margin-bottom:16px"><div><span class="xk">${EXP_LABEL[k]}</span><h1>${esc(c.title)}</h1><span class="sub">${fmt(from)} – ${to>=TODAY&&k!=='before_after'?'now, ends '+fmt(to):fmt(to)}</span></div>
   <span style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">${remindBtn('challenge',c.id)}<button type="button" class="btn-accent btn-sm" data-act="exp-edit">Edit</button></span></div>`;
  // summary: each check-in says where today stands, and how many periods were missed
  let summary='';
  if(k==='challenge'){const s=challengeStats(c);
    summary=`<section class="card"><div class="donut-w" style="gap:20px;align-items:flex-start"><div style="text-align:center">${donut(s.elapsed/s.total,120,13,'var(--accent)',`<b>${s.elapsed}</b><span>of ${s.total} days</span>`)}<div class="s" style="font-size:12.5px;font-weight:700;margin-top:6px">Challenge duration</div>${s.elapsed===0?`<div class="s" style="font-size:12px;color:var(--muted)">Starts ${fmtShort(c.started_on)}</div>`:''}</div>
     <div class="rules" style="flex:1;min-width:0;gap:14px">${s.rules.map(r=>{const st=ruleStatus(c,r);return `<div><div class="rule" style="margin-bottom:6px;justify-content:space-between"><b>${esc(ruleTitle(r))}</b><span class="${statusClass(st.st)}" style="font-weight:700">${esc(st.detail)}</span></div><div class="prog accent" style="margin-bottom:6px"><span style="width:${Math.round((st.n?st.hit/st.n:0)*100)}%"></span></div><span class="s" style="font-size:12px;color:var(--muted)">${st.hit} of ${st.n} ${perUnit(r.per,st.n)}</span>${ruleCells(c,r)}</div>`}).join('')||'<span class="s">No check-ins set. Add some with Edit.</span>'}</div></div>
     ${s.rules.length?'<p class="disclaim" style="margin-top:12px">Filled squares are done, outlined ones missed, the ringed one is still open.</p>':''}</section>`}
  else summary=`<section class="card"><p class="story-p" style="margin-top:0">${k==='phases'?'Each phase side by side, with the average of what you logged during it.':`Comparing ${+cf.window||90} days either side of ${esc(cf.label||'the change')} on ${fmt(cf.event_date)}.`} Averages and counts only; what they mean is yours to judge, or to take to your doctor.</p>${k==='phases'?phasesBody(c):baBody(c,false)}</section>`;
  // photos
  const ps=expPhotos(c,from,end),rs=expRegions(c);let photos='';
  if(rs.length){let body;
    if(!ps.length)body=`<div class="empty">No ${esc(rs.map(rl).join(', ').toLowerCase())} photos in this stretch yet.</div>`;
    else if(k==='phases')body=(cf.phases||[]).map(p=>{const pp=ps.filter(e=>e.occurred_at>=p.from&&e.occurred_at<=p.to);return `<div class="sec" style="margin-top:12px">${esc(p.name)} <span class="s">· ${pp.length}</span></div>${pp.length?`<div class="pgrid">${pp.map(photoTile).join('')}</div>`:'<div class="empty">None.</div>'}`}).join('');
    else if(k==='before_after'){const b=ps.filter(e=>e.occurred_at<cf.event_date),a=ps.filter(e=>e.occurred_at>=cf.event_date);
      body=`${photoPair(b[b.length-1],'Last before',a[a.length-1],'Latest after')}${photoFold('before','All before',b)}${photoFold('after','All after',a)}`}
    else body=ps.length>1?`${photoPair(ps[0],'First',ps[ps.length-1],'Latest')}${photoFold('all','All of them',ps)}`:`<div class="pgrid tiles">${ps.map(photoTile).join('')}</div>`;
    photos=`<section class="card"><div class="card-h"><h2>Photos <span class="sub">${esc(rs.map(rl).join(', '))} · ${ps.length}</span></h2>${plusBtn('exp-photo','Add a photo')}</div>${body}</section>`}
  // measurements
  const ms=expMetrics(c).filter(m=>D.metrics[m]);
  const meas=ms.length?`<section class="card"><div class="card-h"><h2>Measurements</h2><span class="sub">Everything logged in this stretch</span></div><div class="list">${ms.map(m=>{const es=D.entries.filter(e=>e.type==='measurement'&&e.details.metric===m&&e.occurred_at>=from&&e.occurred_at<=end).sort(asc),s=statIn(m,from,end);
    return `<div class="mblock"><div class="row" style="background:transparent;padding:0"><span class="t">${esc(metric(m).l)}</span><span class="s">${s.n?`${fmtM(m,s.avg)} avg · ${s.n} logged`:'nothing logged'}</span></div>${es.length?`<div class="chips" style="margin-top:6px">${es.map(e=>`<button type="button" class="pill mv" data-entry="${e.id}">${fmtShort(e.occurred_at)} · ${esc(fmtM(m,e.details.value))}</button>`).join('')}</div>`:''}</div>`}).join('')}</div></section>`:'';
  // lifestyle
  const regs=expRegs(c);
  const life=regs.length?`<section class="card"><div class="card-h"><h2>Lifestyle</h2><span class="sub">Part of this ${k==='challenge'?'challenge':'experiment'}</span></div><div class="list">${regs.map(r=>{const n=logsOf(r.id,from,end).length;return `<button type="button" class="row" data-regimen="${r.id}"><span><span class="t">${esc(r.name)}</span><br><span class="s">${esc([r.dose,r.frequency].filter(Boolean).join(' · '))}</span></span><span class="s mono">${n?`logged ${n}×`:''}</span></button>`}).join('')}</div></section>`:'';
  const notes=c.notes?`<section class="card"><div class="card-h"><h2>Notes</h2></div><p class="story-p" style="margin:0;white-space:pre-wrap">${esc(c.notes)}</p></section>`:'';
  const del=`<div style="text-align:center"><button type="button" class="btn-ghost" data-act="exp-del" style="color:var(--t-observation);border-color:currentColor">${k==='challenge'?'Delete entire challenge':k==='phases'?'Delete these phases':'Delete this comparison'}</button></div>`;
  return head+`<div style="display:flex;flex-direction:column;gap:16px">${summary}${photos}${meas}${life}${notes}${del}</div>`;
}
/* two photos labelled side by side, all tiles the same size (4:5), and a grid folded away behind its heading */
const photoPair=(a,la,b,lb)=>`<div class="bapics" style="margin-top:0">${[[a,la],[b,lb]].map(([e,l])=>`<div>${e?`<button type="button" class="pcell" data-entry="${e.id}"><div class="bapic">${photoHTML(e.photos[0],e.title,e.occurred_at)}</div></button><small>${l} · ${fmt(e.occurred_at)}</small>`:`<small>${l}: none</small>`}</div>`).join('')}</div>`;
function photoFold(key,title,es){const open=(V.folds||{})[key];return `<div style="margin-top:14px"><button type="button" class="sec foldbtn" data-fold="${key}" aria-expanded="${!!open}" style="margin:0 0 8px">${title} · ${es.length} <span aria-hidden="true">${open?'▾':'▸'}</span></button>${open?(es.length?`<div class="pgrid tiles">${es.map(photoTile).join('')}</div>`:'<div class="empty">None.</div>'):''}</div>`}
function openExpEdit(){const c=D.challenges.find(x=>x.id===V.exp);if(!c)return;const k=expKind(c);k==='challenge'?openChallenge(c):k==='phases'?openPhases(c):openBeforeAfter(c)}
/* ---------- quick entry widget: log today in one tap; tomorrow it asks again ---------- */
const flowName=v=>(FLOW.find(f=>f[0]===v)||[,v])[1];
function quickTitle(w){const s=w.src||'cycle';return s==='cycle'?'Cycle today':`${metric(s.slice(2)).l} today`}
function quickBody(w){return quickBody0(w)+`<div style="margin-top:10px">${remindBtn('quick',w.id)}</div>`}
function quickBody0(w){
  const s=w.src||'cycle';
  if(s==='cycle'){
    const r=(D.cycle||[]).find(c=>c.on_date===TODAY&&c.source==='manual'),cd=cycleDayOf(TODAY);
    if(r)return `<div class="qdone"><span class="qtick">✓</span><span style="min-width:0"><span class="t">${esc(flowName(r.flow))}${(r.symptoms||[]).length?' · '+esc(r.symptoms.join(', ')):''}</span>${r.note?`<br><span class="s">${esc(r.note)}</span>`:''}<br><span class="s">Logged for today${cd?` · cycle day ${cd}`:''}. It'll ask again tomorrow.</span></span><button type="button" class="btn-ghost btn-sm" data-cday="${TODAY}">Edit</button></div>`;
    return `<div class="qform" data-qw="${w.id}"><span class="s">${cd?`Cycle day ${cd}. `:''}How's today?</span><div class="seg flowseg">${FLOW.map(([v,l])=>`<button type="button" data-qflow="${v}">${l}</button>`).join('')}</div>
      <div class="chips">${SYMPTOMS.map(x=>`<button type="button" class="chip" data-qsym="${esc(x)}">${esc(x)}</button>`).join('')}</div>
      <input data-qnewsym placeholder="Add another symptom" aria-label="Add another symptom">
      <div class="f"><label for="qn${w.id}">Note (optional)</label><textarea id="qn${w.id}" data-qnote rows="2" placeholder="Anything else about today"></textarea></div>
      <div style="display:flex;gap:8px;align-items:center"><button type="button" class="btn-accent btn-sm" data-qsave="${w.id}">Save today</button><span class="err" data-qerr></span></div></div>`;
  }
  const k=s.slice(2);if(!D.metrics[k])return `<div class="empty">This measure was removed.</div>`;
  const e=D.entries.filter(x=>x.type==='measurement'&&x.details.metric===k&&x.occurred_at===TODAY).sort(byDateDesc())[0];
  if(e)return `<div class="qdone"><span class="qtick">✓</span><span style="min-width:0"><span class="t">${esc(fmtM(k,e.details.value))}</span><br><span class="s">Logged for today. It'll ask again tomorrow.</span></span><button type="button" class="btn-ghost btn-sm" data-entry="${e.id}">Edit</button></div>`;
  return `<div class="qform" data-qw="${w.id}"><div class="f">${valHTML(mkind(k),null,'q'+w.id,metric(k).l,metric(k).u)}</div><div class="f"><label for="qn${w.id}">Note (optional)</label><textarea id="qn${w.id}" data-qnote rows="2" placeholder="Anything else about today"></textarea></div><div style="display:flex;gap:8px;align-items:center"><button type="button" class="btn-accent btn-sm" data-qsave="${w.id}">Save today</button><span class="err" data-qerr></span></div></div>`;
}
function quickSave(id){
  const w=[...D.widgets.left,...D.widgets.right].find(x=>x.id===id),box=document.querySelector(`[data-qw="${id}"]`);if(!w||!box)return;const s=w.src||'cycle',err=m=>{box.querySelector('[data-qerr]').textContent=m};
  if(s==='cycle'){const f=box.querySelector('[data-qflow].on');if(!f)return err('Pick a flow, or None.');
    D.cycle=(D.cycle||[]).filter(c=>!(c.on_date===TODAY&&c.source==='manual'));
    D.cycle.push({on_date:TODAY,source:'manual',flow:f.dataset.qflow,symptoms:[...box.querySelectorAll('[data-qsym].on')].map(b=>b.dataset.qsym).concat(box.querySelector('[data-qnewsym]').value.split(',').map(x=>x.trim()).filter(Boolean)),note:box.querySelector('[data-qnote]').value.trim(),source_ref:null});
    if(!D.settings.cycle_on)D.settings.cycle_on=true;save();render();return}
  const k=s.slice(2),v=readVal(mkind(k),'q'+id);if(v==null||isNaN(v))return err('Enter a value.');
  D.entries.push({id:uid(),type:'measurement',occurred_at:TODAY,title:`${metric(k).l} ${fmtM(k,v)}`,notes:box.querySelector('[data-qnote]').value.trim(),regions:['whole_body'],concern_id:null,parent_entry_id:null,details:{metric:k,value:v},source:'manual',photos:[],files:[]});save();render();
}
/* ---------- reminders: set here or on the phone; the My OS phone app delivers them ---------- */
const WD=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const ord=n=>{n=+n;const s=['th','st','nd','rd'],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0])};
const remFor=(kind,id)=>(D.reminders||[]).find(r=>r.target_kind===kind&&r.target_id===id);
function remTarget(r){const k=r.target_kind,id=r.target_id;
  if(k==='challenge'){const c=D.challenges.find(x=>x.id===id);return c&&{label:c.title,go:`data-exp="${c.id}"`}}
  if(k==='concern'){const c=D.concerns.find(x=>x.id===id);return c&&{label:c.title,go:`data-concern="${c.id}"`}}
  if(k==='regimen'){const g=D.regimens.find(x=>x.id===id);return g&&{label:g.name,go:`data-regimen="${g.id}"`}}
  if(k==='quick'){const w=[...D.widgets.left,...D.widgets.right].find(x=>x.id===id);return w&&{label:quickTitle(w)+' (dashboard)',go:'data-tabgo="dashboard"'}}
  return {label:'',go:''}}
function remDefaultTitle(kind,id){const t=remTarget({target_kind:kind,target_id:id})||{};
  return kind==='concern'?`Check in: ${t.label}`:kind==='quick'?t.label.replace(' (dashboard)','').replace(/ today$/,''):t.label||''}
function schedText(sc){const t=tfmt(sc.time||'09:00');
  return sc.repeat==='weekly'?`${(sc.days||[]).length===7?'Every day':(sc.days||[]).slice().sort().map(d=>WD[d-1]).join(', ')||'No days picked'} at ${t}`:sc.repeat==='monthly'?`The ${ord(sc.monthday||1)} of each month at ${t}`:sc.repeat==='once'?`${fmt(sc.date||TODAY)} at ${t}`:`Every day at ${t}`}
const firesOn=(sc,d)=>{const wd=d.getDay()||7;return sc.repeat==='weekly'?(sc.days||[]).includes(wd):sc.repeat==='monthly'?d.getDate()===+(sc.monthday||1):sc.repeat==='once'?iso(d)===sc.date:true};
function nextFire(r){if(!r.enabled)return null;const sc=r.schedule||{},[h,m]=(sc.time||'09:00').split(':').map(Number),now=new Date();
  for(let i=0;i<400;i++){const d=new Date(now.getFullYear(),now.getMonth(),now.getDate()+i,h,m);if(d<=now)continue;if(firesOn(sc,d))return d}return null}
/* "already done that day": the phone uses the same rules to skip a reminder */
function remDone(r,day){const k=r.target_kind,id=r.target_id;
  if(k==='regimen')return logsOf(id,day,day).length>0;
  if(k==='quick'){const w=[...D.widgets.left,...D.widgets.right].find(x=>x.id===id);if(!w)return false;const s=w.src||'cycle';
    return s==='cycle'?(D.cycle||[]).some(c=>c.on_date===day&&c.source==='manual'):D.entries.some(e=>e.type==='measurement'&&e.details.metric===s.slice(2)&&e.occurred_at===day)}
  if(k==='concern'){const c=D.concerns.find(x=>x.id===id);return !!c&&((c.tracking||{}).metrics||[]).length>0&&dueMetrics(c).length===0}
  if(k==='challenge'){const c=D.challenges.find(x=>x.id===id);if(!c||expKind(c)!=='challenge'||!c.rules.length)return false;
    return c.rules.every(rl=>{const per=rl.per==='day'?1:rl.per==='week'?7:30,i=Math.floor(dayDiff(c.started_on,day)/per);if(i<0)return false;return ruleHit(rl,addDays(c.started_on,i*per),addDays(c.started_on,(i+1)*per-1))})}
  return false}
function remindBtn(kind,id){const r=remFor(kind,id);
  return `<button type="button" class="btn-ghost btn-sm remb${r&&r.enabled?' on':''}" data-remind="${kind}:${esc(id)}">${BELL}${r?(r.enabled?esc(schedText(r.schedule||{})):'Reminder paused'):'Remind me'}</button>`}
const BELL='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';
function openReminder(o={}){
  const ex=o.rid?(D.reminders||[]).find(r=>r.id===o.rid):o.kind&&o.kind!=='custom'?remFor(o.kind,o.id):null;
  const r=ex||{id:'rm-'+uid(),title:remDefaultTitle(o.kind||'custom',o.id),target_kind:o.kind||'custom',target_id:o.id||null,schedule:{repeat:'daily',time:'09:00',days:[1,2,3,4,5,6,7],monthday:1,date:TODAY},private:o.kind==='concern',skip_if_done:true,enabled:true};
  const sc={days:[1,2,3,4,5,6,7],monthday:1,date:TODAY,time:'09:00',repeat:'daily',...r.schedule};let rep=sc.repeat;const days=new Set(sc.days);
  const tgt=r.target_kind!=='custom'?remTarget(r):null;
  openSheet(`<div class="sheet-h"><h3>${BELL.replace('width="14" height="14"','width="18" height="18"')} ${ex?'Edit reminder':'New reminder'}</h3><button class="x" type="button" aria-label="Close">✕</button></div>
   <form class="form" id="rmForm" novalidate>
   ${tgt?`<p class="story-p" style="margin:0">For: <b>${esc(tgt.label)}</b></p>`:''}
   <div class="f"><label for="rm_t">What it says</label><input id="rm_t" value="${esc(r.title)}" placeholder="Take iron, scalp photo, drink water"></div>
   <div class="f"><span class="l">Repeat</span><div class="seg" id="rmRep">${[['daily','Every day'],['weekly','Some days'],['monthly','Monthly'],['once','Once']].map(([v,l])=>`<button type="button" data-rep="${v}" class="${rep===v?'on':''}">${l}</button>`).join('')}</div></div>
   <div class="f" data-for="weekly"${rep==='weekly'?'':' hidden'}><span class="l">On</span><div class="chips" id="rmDays">${WD.map((d,i)=>`<button type="button" class="chip${days.has(i+1)?' on':''}" data-wd="${i+1}">${d}</button>`).join('')}</div></div>
   <div class="f2"><div class="f" data-for="monthly"${rep==='monthly'?'':' hidden'}><label for="rm_md">Day of the month</label><input id="rm_md" type="number" min="1" max="28" value="${esc(sc.monthday)}"></div>
    <div class="f" data-for="once"${rep==='once'?'':' hidden'}><label for="rm_d">Date</label><input id="rm_d" type="date" value="${esc(sc.date)}"></div>
    <div class="f"><label for="rm_tm">Time</label><input id="rm_tm" type="time" value="${esc(sc.time)}"></div></div>
   <label class="chk"><input type="checkbox" id="rm_p"${r.private?' checked':''}> Keep it private on the lock screen <span class="s">(shows "My OS Health: time for a check-in" instead)</span></label>
   ${r.target_kind!=='custom'?`<label class="chk"><input type="checkbox" id="rm_s"${r.skip_if_done!==false?' checked':''}> Skip it if I've already done it that day</label>`:''}
   ${ex?`<label class="chk"><input type="checkbox" id="rm_e"${r.enabled?'':' checked'}> Pause this reminder</label>`:''}
   <div class="form-acts"><span>${ex?'<button type="button" class="btn-ghost" id="rmDel">Delete</button>':''}</span><button class="btn-accent" type="submit">Save</button></div><div class="err" id="rmErr"></div></form>`);
  const show=()=>document.querySelectorAll('#rmForm [data-for]').forEach(el=>el.hidden=el.dataset.for!==rep);
  $('#rmRep').addEventListener('click',e=>{const b=e.target.closest('[data-rep]');if(!b)return;rep=b.dataset.rep;$('#rmRep').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));show()});
  $('#rmDays').addEventListener('click',e=>{const b=e.target.closest('[data-wd]');if(!b)return;const d=+b.dataset.wd;days.has(d)?days.delete(d):days.add(d);b.classList.toggle('on')});
  if(ex)$('#rmDel').addEventListener('click',e=>{if(!e.target.dataset.armed){e.target.dataset.armed=1;e.target.textContent='Tap again to delete';return}D.reminders=D.reminders.filter(x=>x.id!==r.id);save();closeSheet();render()});
  $('#rmForm').addEventListener('submit',e=>{e.preventDefault();const err=m=>{$('#rmErr').textContent=m};const t=$('#rm_t').value.trim();if(!t)return err('Say what it should remind you of.');
    if(rep==='weekly'&&!days.size)return err('Pick at least one day.');
    const o2={...r,title:t,schedule:{repeat:rep,time:$('#rm_tm').value||'09:00',...(rep==='weekly'?{days:[...days].sort()}:{}),...(rep==='monthly'?{monthday:Math.min(28,Math.max(1,+$('#rm_md').value||1))}:{}),...(rep==='once'?{date:$('#rm_d').value||TODAY}:{})},
      private:$('#rm_p').checked,skip_if_done:$('#rm_s')?$('#rm_s').checked:false,enabled:$('#rm_e')?!$('#rm_e').checked:true};
    D.reminders=(D.reminders||[]).filter(x=>x.id!==r.id);D.reminders.push(o2);save();closeSheet();render()});
}
function remindersSection(){
  const rs=(D.reminders||[]).slice().sort((a,b)=>(nextFire(a)||Infinity)-(nextFire(b)||Infinity));
  return `<section class="card"><div class="card-h"><h2>Reminders</h2><span style="display:flex;gap:8px;align-items:center"><span class="sub">Sent by the My OS app on your phone</span><button type="button" class="btn-ghost btn-sm" data-remind="custom:">+ Reminder</button></span></div>
   <div class="list">${rs.map(r=>{const t=remTarget(r),nf=nextFire(r),done=r.target_kind!=='custom'&&t&&r.skip_if_done!==false&&firesOn(r.schedule||{},pd(TODAY))&&remDone(r,TODAY);
     return `<button type="button" class="row" data-remedit="${r.id}"><span style="display:flex;gap:10px;align-items:center;min-width:0"><span class="remico${r.enabled?'':' off'}">${BELL}</span><span style="min-width:0"><span class="t">${esc(r.title)}</span>${r.private?' <span class="pill mut">Private</span>':''}<br><span class="s">${esc(schedText(r.schedule||{}))}${!t?' · what it was for has been removed':t.label?' · '+esc(t.label):''}</span></span></span>
      <span class="s" style="text-align:right">${!r.enabled?'Paused':done?'Done today':nf?'Next '+(iso(nf)===TODAY?'today':fmtShort(iso(nf)))+', '+hhmm(nf.getHours()*60+nf.getMinutes()):'–'}</span></button>`}).join('')||'<div class="empty">No reminders yet. Add one here, or use Remind me on a challenge, concern, Lifestyle item or quick entry.</div>'}</div></section>`;
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-remind],[data-remedit]');if(!b||!D)return;e.preventDefault();e.stopPropagation();
  if(b.dataset.remedit){openReminder({rid:b.dataset.remedit});return}const [kind,...rest]=b.dataset.remind.split(':');openReminder({kind,id:rest.join(':')||null})},true);

/* ---------- figure: the same geometry as the phone. Body viewBox 200×460; the head drawing (200×250, the face canvas's
   4:5) sits on the figure's head at HEAD_S, its face centre (100,110) on the figure's head centre (100,37). ---------- */
// right half of a front-facing figure, neck to crotch; mirrored for the left. Head a seventh of the height, crotch just past halfway, feet at 450
const FIG_RIGHT=[[108,70],[110,85],[124,92],[142,97],[151,106],[155,123],[159,144],[164,164],[169,185],[174,204],[178,215],[183,225],[183,236],[177,241],[170,238],[168,228],[165,219],[159,200],[152,180],[146,159],[141,140],[138,128],[137,146],[133,167],[128,188],[132,206],[137,225],[138,256],[134,295],[129,330],[131,365],[127,404],[124,427],[130,441],[127,450],[108,450],[107,436],[108,420],[106,383],[106,342],[104,300],[103,265],[100,240]];
function smoothClosed(pts,k=7){
  const n=pts.length,P=i=>pts[(i+n)%n];let d=`M${P(0)[0].toFixed(1)} ${P(0)[1].toFixed(1)}`;
  for(let i=0;i<n;i++){const p0=P(i-1),p1=P(i),p2=P(i+1),p3=P(i+2);
    d+=` C${(p1[0]+(p2[0]-p0[0])/k).toFixed(1)} ${(p1[1]+(p2[1]-p0[1])/k).toFixed(1)} ${(p2[0]-(p3[0]-p1[0])/k).toFixed(1)} ${(p2[1]-(p3[1]-p1[1])/k).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`}
  return d+' Z';
}
function figurePath(w=1){const sx=x=>100+(x-100)*w;const right=FIG_RIGHT.map(([x,y])=>[sx(x),y]);const left=FIG_RIGHT.slice(0,-1).reverse().map(([x,y])=>[sx(200-x),y]);return smoothClosed([...right,...left])}
const HEAD_S=0.34;
const FACE_D='M100 30 C148 30 160 68 158 110 C156 158 136 196 100 201 C64 196 44 158 42 110 C40 68 52 30 100 30Z';
const HAIR_D='M44 104 C38 44 72 18 100 18 C128 18 162 44 156 104 C152 72 132 46 100 46 C68 46 48 72 44 104Z';
// the hair from behind: over the whole back of the head, down to the nape
const BACK_HAIR_D='M44 104 C38 44 72 18 100 18 C128 18 162 44 156 104 C158 148 146 176 128 188 C110 182 90 182 72 188 C54 176 42 148 44 104Z';
const FEATURES='<path d="M63 109 Q76 100 89 109 Q76 116 63 109Z"/><path d="M111 109 Q124 100 137 109 Q124 116 111 109Z"/><path d="M62 97 Q76 90 90 96 M110 96 Q124 90 138 97" stroke-opacity=".55"/><path d="M100 114 Q97 132 92 141 Q100 146 108 141"/><path d="M83 165 Q92 159 100 162 Q108 159 117 165 Q100 175 83 165Z"/>';
const EARS='<ellipse cx="41" cy="119" rx="9" ry="17"/><ellipse cx="159" cy="119" rx="9" ry="17"/>';
/* the head's outline, ears and hair, placed on the figure; sw is in the head drawing's units */
const headShape=(sw,back,hairFill='var(--line)')=>`<g transform="translate(100 37) scale(${HEAD_S}) translate(-100 -110)" stroke-width="${sw}" stroke-linecap="round">${EARS}<path d="${FACE_D}"/><path d="${back?BACK_HAIR_D:HAIR_D}"${hairFill?` fill="${hairFill}"`:''} stroke-opacity=".5"/></g>`;
/* the still figure: outline, head and hair, no face */
function figureSVG(w=1,side='front'){
  return `<svg class="fig" viewBox="0 0 200 460" aria-label="Outline of a body"><g fill="var(--soft)" stroke="var(--muted)" stroke-width="1.3" stroke-linejoin="round" stroke-opacity=".75"><path d="${figurePath(w)}"/>${headShape(4.5,side==='back')}</g></svg>`;
}
/* the face canvas with no photo: the head drawing (200×250, the canvas's 4:5), its points sit on the features */
function faceSVG(){
  return `<svg class="fig face" viewBox="0 0 200 250" aria-label="Outline of a face"><g fill="var(--soft)" stroke="var(--muted)" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" stroke-opacity=".75">${EARS}<path d="${FACE_D}"/><path d="${HAIR_D}" fill="var(--line)" stroke-opacity=".5"/><g fill="none">${FEATURES}</g></g></svg>`;
}
/* white outlines over a photo being adjusted: the figure (200:460) or the face (4:5) */
function outlineSVG(kind){
  if(kind==='face')return `<svg class="fig" viewBox="0 0 200 250" aria-hidden="true"><g fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-opacity=".65" stroke-linecap="round" stroke-linejoin="round">${EARS}<path d="${FACE_D}"/><path d="${HAIR_D}" stroke-opacity=".35"/></g></svg>`;
  return `<svg class="fig" viewBox="0 0 200 460" aria-hidden="true"><g fill="none" stroke="#FFFFFF" stroke-width="2" stroke-opacity=".65" stroke-linejoin="round"><path d="${figurePath()}"/>${headShape(4.5,false,'')}</g></svg>`;
}
/* ---------- teeth: one chart, a status per tooth, stored by FDI number in profile.settings.teeth ---------- */
const TOOTH_STATUS=[['watch','Watching','#E0A63B'],['cavity','Cavity','#D9534F'],['filled','Filled','#4F5BF5'],['crown','Crown','#8556B5'],['root_canal','Root canal','#C2693F'],['implant','Implant','#5C6470'],['bridge','Bridge','#3C9A8F'],['extracted','Removed',''],['missing','Never grew','']];
const TS_KEYS=new Set(TOOTH_STATUS.map(x=>x[0]));
const TS_FILL=['cavity','watch','root_canal','crown','implant','bridge','filled'];
const TOOTH_NAME=['central incisor','lateral incisor','canine','first premolar','second premolar','first molar','second molar','wisdom tooth'];
const QUAD_NAME={1:'upper right',2:'upper left',3:'lower left',4:'lower right'};
const ALL_TEETH=[18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28,48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];
const teethData=()=>{if(!D.settings.teeth||typeof D.settings.teeth!=='object')D.settings.teeth={};return D.settings.teeth};
const toothNum=n=>{if(D.settings.toothNumbering!=='universal')return String(n);const q=Math.floor(n/10),d=n%10;return String(q===1?9-d:q===2?8+d:q===3?25-d:24+d)};
const toothLabel=n=>`Tooth ${toothNum(n)}: ${QUAD_NAME[Math.floor(n/10)]} ${TOOTH_NAME[n%10-1]}`;
const toothGone=r=>!!r&&Array.isArray(r.s)&&r.s.some(s=>s==='extracted'||s==='missing');
function toothEntries(n){const re=new RegExp(`(^|\\D)${n}(\\D|$)`),reT=new RegExp(`tooth\\s*${n}\\b`,'i');
  return D.entries.filter(e=>(e.details&&e.details.tooth&&re.test(String(e.details.tooth)))||reT.test(e.title||'')).sort(byDateDesc())}
function toothPath(d,w,h){
  const x=w/2,y=h/2;
  if(d<=2)return `M${-x},${-y+1} Q0,${-y-2.5} ${x},${-y+1} Q${x-.5},${h*0.12} ${w*0.14},${y} Q0,${y+1.5} ${-w*0.14},${y} Q${-x+.5},${h*0.12} ${-x},${-y+1}Z`;
  if(d===3)return `M0,${-y-1} Q${x},${-y} ${x},${-h*0.05} Q${x-1},${y} 0,${y} Q${-x+1},${y} ${-x},${-h*0.05} Q${-x},${-y} 0,${-y-1}Z`;
  const r=d<=5?w*0.38:w*0.3,b=d<=5?1:2;
  return `M${-x+r},${-y} Q${-w/4},${-y-b} 0,${-y+.5} Q${w/4},${-y-b} ${x-r},${-y} Q${x},${-y} ${x},${-y+r} Q${x+b},0 ${x},${y-r} Q${x},${y} ${x-r},${y} Q${w/4},${y+b} 0,${y-.5} Q${-w/4},${y+b} ${-x+r},${y} Q${-x},${y} ${-x},${y-r} Q${-x-b},0 ${-x},${-y+r} Q${-x},${-y} ${-x+r},${-y}Z`;
}
function toothGrooves(d,w,h){
  if(d<=3)return '';
  if(d<=5)return `M${-w*0.28},${h*0.02} Q0,${h*0.12} ${w*0.28},${h*0.02}`;
  return `M${-w*0.32},${-h*0.04} Q${-w*0.1},${h*0.1} 0,${-h*0.02} Q${w*0.12},${h*0.1} ${w*0.32},${-h*0.06} M${-w*0.04},${-h*0.34} Q${w*0.08},${-h*0.12} ${-w*0.02},${h*0.02} Q${-w*0.1},${h*0.18} ${w*0.04},${h*0.34}`;
}
function teethSVG(small){
  const W=[25,19,22,21,20,30,28,25],H=[19,18,22,24,24,30,29,27],GAP=2,td=teethData();
  const half=W.reduce((a,b)=>a+b+GAP,0),MAXT=Math.PI*0.54;let g='';
  ALL_TEETH.forEach(n=>{const q=Math.floor(n/10),d=n%10,up=q<=2,left=q===1||q===4;
    let cum=W[d-1]/2+GAP/2;for(let i=0;i<d-1;i++)cum+=W[i]+GAP;const t=(cum/half)*MAXT*(left?-1:1);
    const R=up?{rx:132,ry:166,cy:250}:{rx:126,ry:158,cy:332},s=Math.sin(t),c=Math.cos(t);
    const x=200+R.rx*s,y=up?R.cy-R.ry*c:R.cy+R.ry*c,ang=Math.atan2(up?R.ry*s:-R.ry*s,R.rx*c)*180/Math.PI;
    const lx=200+(R.rx+32)*s,ly=up?R.cy-(R.ry+32)*c:R.cy+(R.ry+32)*c;
    const r=td[n],ss=((r&&r.s)||[]).filter(k=>TS_KEYS.has(k)),gone=toothGone(r),fillK=TS_FILL.find(k=>ss.includes(k)),col=fillK?TOOTH_STATUS.find(x=>x[0]===fillK)[2]:'';
    const w=W[d-1],h=H[d-1],tr=`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${ang.toFixed(1)})${up?'':' scale(1 -1)'}`;
    g+=`<g class="tooth${gone?' gone':''}${col?' noted':''}" data-tooth="${n}" role="button" tabindex="0" aria-label="${esc(toothLabel(n)+(ss.length?', '+ss.map(k=>TOOTH_STATUS.find(x=>x[0]===k)[1]).join(', '):''))}">
      <g transform="${tr}"><path class="tb" d="${toothPath(d,w,h)}"${col?` style="fill:${col};stroke:${col}"`:''}/>${gone?'':`<path class="tg" d="${toothGrooves(d,w,h)}"${col?` style="stroke:${col}"`:''}/>`}
      ${ss.length>1&&!gone?`<circle r="3" cy="${(h*0.02).toFixed(1)}" class="tmulti"/>`:''}</g>
      ${small?'':`<text x="${lx.toFixed(1)}" y="${(ly+4).toFixed(1)}" text-anchor="middle">${toothNum(n)}</text>`}</g>`});
  return `<svg class="teeth${small?' small':''}" viewBox="0 0 400 560" role="group" aria-label="Teeth chart">
    ${small?'':`<line x1="125" y1="292" x2="275" y2="292" class="tsep"/><text class="tjaw" x="200" y="272" text-anchor="middle">Upper teeth</text><text class="tjaw" x="200" y="320" text-anchor="middle">Lower teeth</text><text class="tside" x="14" y="552">← Your right</text><text class="tside" x="386" y="552" text-anchor="end">Your left →</text>`}${g}</svg>`;
}
function teethLegend(){
  const used=new Set(Object.values(teethData()).flatMap(r=>r.s||[]));
  return `<div class="legend" style="justify-content:center">${TOOTH_STATUS.filter(([k])=>used.has(k)).map(([k,l,c])=>`<span class="lg"><i class="bx" style="${c?'background:'+c:'border:1.5px dashed var(--muted);background:transparent'}"></i>${l}</span>`).join('')||'<span class="lg">Tap a tooth to note what\'s been done to it.</span>'}</div>
   <div style="display:flex;justify-content:center;gap:8px;align-items:center;margin-top:8px;font-size:12px;color:var(--muted)">Numbering <div class="seg sm">${[['fdi','International'],['universal','US']].map(([v,l])=>`<button type="button" data-tnum="${v}" class="${(D.settings.toothNumbering||'fdi')===v?'on':''}">${l}</button>`).join('')}</div></div>
   <p class="disclaim" style="text-align:center;margin:8px 0 0">Shown as your dentist sees it, facing you. A record of what was done, not a diagnosis.</p>`;
}
function openTooth(n){
  n=+n;const cur=teethData()[n]||{s:[],since:'',note:''},sel=new Set((Array.isArray(cur.s)?cur.s:[]).filter(k=>TS_KEYS.has(k))),es=toothEntries(n);
  openSheet(`<div class="sheet-h"><h3>${esc(toothLabel(n))}</h3><button class="x" type="button" aria-label="Close">✕</button></div>
   <form class="form" id="tForm" novalidate>
   <div class="f"><span class="l">What's true of it now (pick any)</span><div class="chips" id="tStat">${TOOTH_STATUS.map(([k,l,c])=>`<button type="button" class="chip${sel.has(k)?' on':''}" data-ts="${k}"><i class="dot" style="${c?'background:'+c:'border:1.5px dashed var(--muted)'}"></i>${l}</button>`).join('')}</div><span class="s" style="font-size:12px;color:var(--muted)">Nothing picked means healthy, as far as you know.</span></div>
   <div class="f2"><div class="f"><label for="t_since">Since</label><input id="t_since" type="date" value="${esc(cur.since||'')}"></div></div>
   <div class="f"><label for="t_note">Note (optional)</label><textarea id="t_note" placeholder="Composite filling, sensitive to cold">${esc(cur.note||'')}</textarea></div>
   <div class="form-acts"><button type="button" class="btn-ghost" id="tVisit">+ Dental visit for this tooth</button><button class="btn-accent" type="submit">Save</button></div></form>
   <div class="sec" style="margin-top:16px">History</div><div>${es.map(entryRow).join('')||'<div class="empty">Nothing logged for this tooth yet. Dental visits with this tooth number show up here.</div>'}</div>`);
  $('#tStat').addEventListener('click',e=>{const b=e.target.closest('[data-ts]');if(!b)return;sel.has(b.dataset.ts)?sel.delete(b.dataset.ts):sel.add(b.dataset.ts);b.classList.toggle('on')});
  $('#tVisit').addEventListener('click',()=>openForm('appointment',{regions:['teeth'],title:'Dentist',details:{kind:'dentist',status:'done',tooth:String(n)}}));
  $('#overlay').querySelector('.sheet').addEventListener('click',e=>{const r=e.target.closest('[data-entry]');if(r&&!e.target.closest('form'))openEntry(r.dataset.entry)});
  $('#tForm').addEventListener('submit',e=>{e.preventDefault();const td=teethData(),note=$('#t_note').value.trim(),since=$('#t_since').value;
    if(sel.size||note)td[n]={s:[...sel],since:since||(sel.size&&!cur.since?TODAY:since),note};else delete td[n];save();closeSheet();render()});
}
function teethWidget(){const td=teethData(),ns=ALL_TEETH.filter(n=>td[n]&&((td[n].s||[]).length||td[n].note));
  return `<div class="tw">${teethSVG(true)}</div><div class="list" style="margin-top:6px">${ns.slice(0,5).map(n=>`<button type="button" class="row" data-tooth="${n}"><span class="t">${esc(toothLabel(n).replace(/^Tooth /,''))}</span><span class="s">${esc((td[n].s||[]).map(k=>(TOOTH_STATUS.find(x=>x[0]===k)||[,k])[1]).join(', ')||'Note')}</span></button>`).join('')||'<div class="empty">Tap a tooth to note fillings, crowns, removed or never-grown teeth.</div>'}</div>
   <button type="button" class="linkish" data-region-go="teeth" style="margin-top:6px">Open the full chart</button>`}

document.addEventListener('keydown',e=>{const t=e.target.closest&&e.target.closest('g[data-tooth]');if(t&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openTooth(t.dataset.tooth)}});
/* ---------- what came before ---------- */
const entryTime=e=>new Date(`${e.occurred_at}T${(e.details&&e.details.time)||'12:00'}`);
const hoursAgo=ms=>{const h=Math.round(ms/3600e3);return h<1?'under an hour before':h<48?`${h} h before`:`${Math.round(h/24)} days before`};
function beforeItems(e,hours){
  const end=entryTime(e),start=new Date(end-hours*3600e3),items=[];
  D.entries.forEach(x=>{if(x.id===e.id)return;const t=entryTime(x);if(t>=start&&t<end)items.push({t,ico:x.type,label:x.title,sub:TYPES[x.type]?TYPES[x.type].label:'',entry:x.id,key:x.type==='food_trial'?`Food: ${x.details.food||x.title}`:x.type==='procedure'?x.title:x.type==='observation'?null:null})});
  (D.regLogs||[]).forEach(l=>{const t=new Date(`${l.on_date}T${l.time||'12:00'}`);if(t>=start&&t<end){const r=D.regimens.find(z=>z.id===l.regimen_id);if(r)items.push({t,ico:'regimen',label:r.name,sub:'Logged',key:r.name})}});
  const diet=D.regimens.find(r=>r.category==='diet'&&regimenActive(r,e.occurred_at));
  return {items:items.sort((a,b)=>b.t-a.t),diet,cd:cycleOn()?cycleDayOf(e.occurred_at):null,end};
}
function openBefore(id,hours=48){
  const e=D.entries.find(x=>x.id===id);if(!e)return;const r=beforeItems(e,hours);
  openSheet(`<div class="sheet-h"><h3>${ico('observation')}What came before</h3><button class="x" type="button" aria-label="Close">✕</button></div>
   <p class="story-p">Everything logged in the ${hours} hours before <b>${esc(e.title)}</b> (${fmt(e.occurred_at)}${e.details.time?' '+tfmt(e.details.time):''}). This shows what was nearby, not what caused anything.</p>
   <div class="chips" style="margin-bottom:10px">${[24,48,72].map(h=>`<button type="button" class="chip${h===hours?' on':''}" data-bh="${h}">${h} hours</button>`).join('')}</div>
   ${r.diet||r.cd?`<div class="chips" style="margin-bottom:10px">${r.diet?`<span class="pill">Diet: ${esc(r.diet.name)}</span>`:''}${r.cd?`<span class="pill">Cycle day ${r.cd}</span>`:''}</div>`:''}
   <div class="list">${r.items.map(it=>`<${it.entry?'button type="button" data-entry="'+it.entry+'"':'div'} class="row"><span style="display:flex;gap:10px;align-items:center;min-width:0">${ico(it.ico,1)}<span><span class="t">${esc(it.label)}</span><br><span class="s">${esc(it.sub)}</span></span></span><span class="s">${hoursAgo(r.end-it.t)}</span></${it.entry?'button':'div'}>`).join('')||'<div class="empty">Nothing logged in that window.</div>'}</div>`);
  $('#overlay').querySelector('.sheet').addEventListener('click',ev=>{const h=ev.target.closest('[data-bh]');if(h){openBefore(id,+h.dataset.bh);return}const row=ev.target.closest('[data-entry]');if(row)openEntry(row.dataset.entry)});
}
function openBeforeConcern(cid,hours=48){
  const c=D.concerns.find(x=>x.id===cid);if(!c)return;const obs=D.entries.filter(e=>e.concern_id===cid&&e.type==='observation').sort(byDateDesc());
  const counts={};const blocks=obs.map(o=>{const r=beforeItems(o,hours),keys=[...new Set(r.items.map(i=>i.key).filter(Boolean))];keys.forEach(k=>counts[k]=(counts[k]||0)+1);
    return `<div class="bblock"><button type="button" class="linkish" data-entry="${o.id}">${esc(o.title)}</button><span class="s"> · ${fmt(o.occurred_at)}</span><div class="chips" style="margin-top:6px">${keys.map(k=>`<span class="pill">${esc(k)}</span>`).join('')||'<span class="s">Nothing logged before</span>'}${r.diet?`<span class="pill mut">Diet: ${esc(r.diet.name)}</span>`:''}${r.cd?`<span class="pill mut">Cycle day ${r.cd}</span>`:''}</div></div>`});
  const rep=Object.entries(counts).filter(([,n])=>n>1).sort((a,b)=>b[1]-a[1]);
  openSheet(`<div class="sheet-h"><h3>${ico('observation')}What came before: ${esc(c.title)}</h3><button class="x" type="button" aria-label="Close">✕</button></div>
   <p class="story-p">For each observation, the food trials, procedures and regimens logged in the ${hours} hours before it. Counts show what was nearby more than once; they don't show what caused anything.</p>
   <div class="chips" style="margin-bottom:10px">${[24,48,72].map(h=>`<button type="button" class="chip${h===hours?' on':''}" data-bh="${h}">${h} hours</button>`).join('')}</div>
   ${rep.length?`<div class="sec">Logged before more than one</div><table class="batable"><tbody>${rep.map(([k,n])=>`<tr><td>${esc(k)}</td><td>before ${n} of ${obs.length}</td></tr>`).join('')}</tbody></table>`:''}
   <div class="sec" style="margin-top:14px">Each one</div><div class="list">${blocks.join('')||'<div class="empty">No observations on this concern yet.</div>'}</div>`);
  $('#overlay').querySelector('.sheet').addEventListener('click',ev=>{const h=ev.target.closest('[data-bh]');if(h){openBeforeConcern(cid,+h.dataset.bh);return}const row=ev.target.closest('[data-entry]');if(row)openEntry(row.dataset.entry)});
}
const MARKERS=[['procedure','Procedures'],['appointment','Appointments'],['food_trial','Food trials'],['observation','Observations']];
function cycleChip(c){return cycleOn()?`<button type="button" class="chip${c.bands.includes('cycle')?' on':''}" data-cbband="cycle"><i class="dot" style="background:#E05A7E"></i>Periods (cycle)</button>`:''}
// value input for any kind of measure; p prefixes the element ids so several can sit on one sheet
function valHTML(kd,v,p,label,unit){
  const has=v!=null&&v!=='';
  if(kd==='rating'){const r=ratingRange(unit),ns=Array.from({length:r.hi-r.lo+1},(_,i)=>r.lo+i);return `<span class="l">${esc(label)}</span><div class="seg rate${ns.length>6?' wide':''}">${ns.map(n=>`<button type="button" data-rate="${n}" class="${has&&+v===n?'on':''}">${n}</button>`).join('')}</div><input type="hidden" id="${p}_val" value="${has?esc(v):''}">`}
  if(kd==='time'||kd==='time_night')return `<label for="${p}_val">${esc(label)}</label><input id="${p}_val" type="time" value="${has?toHHMM(v):''}">`;
  if(kd==='duration')return `<span class="l">${esc(label)}</span><div style="display:flex;gap:8px;align-items:center"><input id="${p}_vh" type="number" min="0" step="1" value="${has?Math.floor(v/60):''}" style="width:90px" aria-label="Hours"> h <input id="${p}_vm" type="number" min="0" max="59" step="1" value="${has?Math.round(v%60):''}" style="width:90px" aria-label="Minutes"> min</div>`;
  return `<label for="${p}_val">${esc(label)}</label><input id="${p}_val" type="number" step="any" value="${has?esc(v):''}">`;
}
function readVal(kd,p){
  const g=id=>{const el=document.getElementById(id);return el?el.value.trim():''};
  if(kd==='time'||kd==='time_night'){const s=g(p+'_val');if(!s)return null;const [h,m]=s.split(':').map(Number);return h*60+m}
  if(kd==='duration'){const h=g(p+'_vh'),m=g(p+'_vm');if(h===''&&m==='')return null;return (+h||0)*60+(+m||0)}
  const s=g(p+'_val');return s===''?null:+s;
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-rate]');if(!b)return;const seg=b.closest('.rate');seg.querySelectorAll('[data-rate]').forEach(x=>x.classList.toggle('on',x===b));seg.nextElementSibling.value=b.dataset.rate});
// check-in plans on concerns
function periodStart(per){const d=pd(TODAY);if(per==='week'){d.setDate(d.getDate()-((d.getDay()+6)%7))}else if(per==='month')d.setDate(1);return iso(d)}
function dueMetrics(c){const t=c.tracking||{};if(c.status==='resolved'||!(t.metrics||[]).length)return [];const from=periodStart(t.per||'week');
  return t.metrics.filter(k=>D.metrics[k]&&!D.entries.some(e=>e.type==='measurement'&&e.details.metric===k&&e.occurred_at>=from&&e.occurred_at<=TODAY))}
const tracked=()=>D.concerns.filter(c=>c.status!=='resolved'&&((c.tracking||{}).metrics||[]).length);
function openCheckin(ids){
  const cs=(ids&&ids.length?ids.map(i=>D.concerns.find(c=>c.id===i)):(tracked().some(c=>dueMetrics(c).length)?tracked().filter(c=>dueMetrics(c).length):tracked())).filter(c=>c&&((c.tracking||{}).metrics||[]).length);
  if(!cs.length){alertSheet('Nothing to check in yet','Open a concern and choose Set up under Check-in plan to pick what you want to track and how often.');return}
  let n=0;
  const block=c=>{const due=dueMetrics(c);return `<div class="ckblock" data-cid="${c.id}"><div class="sec" style="margin-top:14px">${esc(c.title)} <span class="ckper">${esc(PER_LABEL[c.tracking.per||'week'])}</span></div>
    ${c.tracking.metrics.filter(k=>D.metrics[k]).map(k=>{const p='ck'+(n++);return `<div class="f ckm" data-metric="${k}" data-p="${p}" data-kind="${mkind(k)}">${valHTML(mkind(k),null,p,metric(k).l+(due.includes(k)?'':' (already logged this period)'),metric(k).u)}</div>`}).join('')}
    <div class="f"><label for="cn_${c.id}">Anything else? (optional)</label><textarea id="cn_${c.id}" class="cknote" placeholder="How it felt, what you noticed"></textarea></div></div>`};
  openSheet(`<div class="sheet-h"><h3>${ico('measurement')}Check in</h3><button class="x" type="button" aria-label="Close">✕</button></div>
   <div class="f"><label for="ck_date">Date</label><input id="ck_date" type="date" value="${TODAY}"></div>${cs.map(block).join('')}
   <div class="form-acts" style="margin-top:14px"><span></span><button class="btn-accent" type="button" id="ckSave">Save check-in</button></div><div class="err" id="ckErr"></div>`);
  $('#ckSave').addEventListener('click',()=>{const date=$('#ck_date').value||TODAY;let added=0;
    document.querySelectorAll('.ckblock').forEach(b=>{const c=D.concerns.find(x=>x.id===b.dataset.cid);
      b.querySelectorAll('.ckm').forEach(m=>{const k=m.dataset.metric,v=readVal(m.dataset.kind,m.dataset.p);if(v==null||isNaN(v))return;
        D.entries.push({id:uid(),type:'measurement',occurred_at:date,title:`${metric(k).l} ${fmtM(k,v)}`,notes:'',regions:c.regions.length?c.regions:['whole_body'],concern_id:c.id,parent_entry_id:null,details:{metric:k,value:v},source:'manual',photos:[],files:[]});added++});
      const note=b.querySelector('.cknote').value.trim();
      if(note){D.entries.push({id:uid(),type:'observation',occurred_at:date,title:`Check-in: ${c.title}`,notes:note,regions:c.regions,concern_id:c.id,parent_entry_id:null,details:{},source:'manual',photos:[],files:[]});added++}});
    if(!added){$('#ckErr').textContent='Fill in at least one measure, or add a note.';return}
    save();closeSheet();V.frame=null;render()});
}
function openConcernNew(){
  const regs=new Set(V.region?[V.region]:[]);
  openSheet(`<div class="sheet-h"><h3>${ico('observation')}New concern</h3><button class="x" type="button" aria-label="Close">✕</button></div>
   <form class="form" id="cnForm" novalidate><div class="f"><label for="cn_t">What are you keeping an eye on?</label><input id="cn_t" placeholder="Posture, tiredness, left breast"></div>
   <div class="f"><label for="cn_s">Since</label><input id="cn_s" type="date" value="${TODAY}"></div>
   <div class="f"><span class="l">Body areas</span>${regionChips(regs)}</div>
   <div class="f"><label for="cn_n">Notes</label><textarea id="cn_n"></textarea></div>
   <div class="form-acts"><span></span><button class="btn-accent" type="submit">Create</button></div><div class="err" id="cnErr"></div></form>`);
  wireRegions(regs);
  $('#cnForm').addEventListener('submit',e=>{e.preventDefault();const t=$('#cn_t').value.trim();if(!t){$('#cnErr').textContent='Give it a name.';return}
    const id='c-'+uid();D.concerns.push({id,title:t,regions:[...regs],started_on:$('#cn_s').value||TODAY,resolved_on:null,status:'active',notes:$('#cn_n').value,tracking:{}});save();render();openConcern(id)});
}
// adherence: logs of when a regimen was actually done
// imported ticks (Apple Health workouts) count unless that item is switched off
const logsOf=(id,from,to)=>(D.regLogs||[]).filter(l=>l.regimen_id===id&&(!from||l.on_date>=from)&&(!to||l.on_date<=to)&&(l.source!=='apple_health'||hkUse('workouts')!=='off')).sort((a,b)=>a.on_date<b.on_date?1:-1);
function adherence(r){const t=r.target;if(!t||!t.count)return null;return {done:logsOf(r.id,periodStart(t.per||'week'),TODAY).length,target:+t.count,per:t.per||'week'}}
function logToday(id){D.regLogs=D.regLogs||[];D.regLogs.push({id:'rl-'+uid(),regimen_id:id,on_date:TODAY,time:null,source:'manual',note:''});save();render()}
const SOURCES=[['manual','I tick it off'],['strava','A Strava activity'],['garmin','A Garmin activity'],['apple_health','An Apple Health workout'],['oura','An Oura activity'],['whoop','A Whoop activity']];
const srcLabel=s=>(SOURCES.find(x=>x[0]===s)||[,s])[1];
/* a regimen's stretches on a chart: a part per stint, cut again at each dose change */
function regParts(r){
  const ch=(r.changes||[]).slice().sort((a,b)=>a.on<b.on?-1:1),lbl=dose=>`${r.name}${dose?' · '+dose:''}`,parts=[];
  for(const st of stintsOf(r)){const end=st.to||TODAY;
    if(!ch.length){parts.push({from:st.from,to:end,label:r.name});continue}
    // the dose at the stint's start is the last change on or before it, or what the first change replaced
    const before=ch.filter(c=>c.on<=st.from),cuts=ch.filter(c=>c.on>st.from&&c.on<=end);
    let from=st.from,dose=before.length?before[before.length-1].dose:ch[0].prev_dose;
    for(const c of cuts){parts.push({from,to:addDays(c.on,-1),label:lbl(dose)});from=c.on;dose=c.dose}
    parts.push({from,to:end,label:lbl(dose)})}
  return parts.filter(p=>p.from<=p.to);
}
function regAdhHTML(r){
  if(r.category==='diet'||!regimenActive(r))return '';
  const a=adherence(r),today=logsOf(r.id,TODAY,TODAY).length,auto=r.match&&r.match.source&&r.match.source!=='manual';
  return `<div class="radh"><span class="s">${a?`<b style="color:var(--ink)">${a.done} of ${a.target}</b> this ${a.per}`:today?'Logged today':'Not logged today'}${auto?` · <span class="pill src">from ${esc(srcLabel(r.match.source).replace(/^An? /,''))} when connected</span>`:''}</span><button type="button" class="btn-ghost btn-sm" data-rtick="${r.id}">${today?'+ Log again':'Log today'}</button></div>`;
}
// health card
const BLOOD=['','A+','A−','B+','B−','AB+','AB−','O+','O−','Not sure'];
const CARD_SECS=[
  ['allergies','Allergies',[['what','Allergic to'],['reaction','What happens'],['severity','Severity','select',[['','–'],['mild','Mild'],['moderate','Moderate'],['severe','Severe']]]]],
  ['vaccines','Vaccinations',[['name','Vaccine'],['date','Date','date'],['booster','Booster due','date']]],
  ['conditions','Ongoing conditions',[['name','Condition'],['since','Since','date'],['notes','Notes']]],
  ['providers','Your providers',[['name','Name'],['role','Role, e.g. family doctor'],['practice','Practice'],['phone','Phone']]],
  ['contacts','Emergency contacts',[['name','Name'],['relation','Relationship'],['phone','Phone']]]
];
function cardSummary(){const c=(D.settings&&D.settings.card)||{},n=(k,a,b)=>(c[k]||[]).length?`${c[k].length} ${c[k].length>1?b:a}`:null;
  return [c.blood&&c.blood!=='Not sure'?`Blood type ${c.blood}`:null,n('allergies','allergy','allergies'),n('vaccines','vaccination','vaccinations')].filter(Boolean).join(' · ')||'Blood type, allergies, vaccinations, providers'}
/* ---------- line chart (widgets, labs) ---------- */
function niceStep(range,count){const raw=range/count,mag=Math.pow(10,Math.floor(Math.log10(raw))),n=raw/mag;return (n<1.5?1:n<3?2:n<7?5:10)*mag}
function lineChart(box,s,opts={}){
  const W=Math.max(220,box.clientWidth||360),H=opts.h||Math.round(Math.min(200,Math.max(140,W*0.4)));
  const pts=s.points;if(!pts||pts.length<2){box.innerHTML=`<div class="empty">Needs two or more values to draw.</div>`;return}
  const L=36,R=14,T=16,B=22,iw=W-L-R,ih=H-T-B;
  const t0=pd(pts[0].d).getTime(),t1=pd(pts[pts.length-1].d).getTime();
  let lo=Math.min(...pts.map(p=>p.v)),hi=Math.max(...pts.map(p=>p.v));
  const st=niceStep(Math.max(hi-lo,s.rating?2:0.5),3);lo=Math.floor(lo/st)*st;hi=Math.ceil(hi/st)*st;if(hi===lo)hi=lo+st;
  const x=t=>L+(t-t0)/(t1-t0||1)*iw,y=v=>T+(1-(v-lo)/(hi-lo))*ih;
  let g='';for(let v=lo;v<=hi+1e-9;v+=st){g+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-dasharray="2 4"/><text x="${L-7}" y="${y(v)+4}" text-anchor="end">${+v.toFixed(2)}</text>`}
  const xy=pts.map(p=>[x(pd(p.d).getTime()),y(p.v)]);
  const line=xy.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
  const area=line+` L${xy[xy.length-1][0]} ${T+ih} L${xy[0][0]} ${T+ih} Z`;
  let lab='';const every=Math.ceil(pts.length/(W<360?4:8));pts.forEach((p,i)=>{if(i%every===0||i===pts.length-1){lab+=`<text x="${xy[i][0]}" y="${H-5}" text-anchor="middle">${fmtShort(p.d)}</text>`}});
  const flags=pts.map((p,i)=>p.flag?`<text x="${xy[i][0]+7}" y="${xy[i][1]-7}" style="fill:var(--ink);font-weight:500">${esc(p.flag)}</text>`:'').join('');
  const last=xy[xy.length-1],lp=pts[pts.length-1];
  box.innerHTML=`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(s.label)} over time">${g}
    <path d="${area}" fill="var(--accent)" fill-opacity=".3"/><path d="${line}" fill="none" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round"/>
    ${xy.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="2.6" fill="var(--card)" stroke="var(--ink)" stroke-width="1.5"/>`).join('')}${flags}
    <circle cx="${last[0]}" cy="${last[1]}" r="5.5" fill="var(--accent)" stroke="var(--ink)" stroke-width="2"/>
    <text x="${Math.min(last[0],W-R)}" y="${last[1]-12}" text-anchor="end" style="fill:var(--ink);font-weight:500">${fmtV(lp.v,s.unit)}</text>${lab}</svg>`;
}

/* ---------- photos: no text on the image; the date on hover. A photo with a `fit` is drawn contain, centred, then moved,
   turned and scaled as the user set it; without one, cover, anchored top-centre (o.pos 'center' for small circles) ---------- */
const fitStyle=(p,o={})=>p.fit?`object-fit:contain;object-position:center;transform:translate(${(p.fit.x*100).toFixed(2)}%,${(p.fit.y*100).toFixed(2)}%) rotate(${+(p.fit.r||0)}deg) scale(${+p.fit.s})`:o.fit==='contain'?'object-fit:contain;object-position:center':o.pos==='center'?'object-position:center':'';
function photoHTML(p,label,date,o={}){
  const hd=date?`<span class="phd">${fmt(date)}</span>`:'',st=fitStyle(p,o),sa=st?` style="${st}"`:'';
  if(p.enc&&!p.src)return `<img class="vimg" data-vault="${esc(p.path)}" alt="${esc(label)}"${sa}>${hd}`;
  if(p.src)return `<img src="${esc(p.src)}" alt="${esc(label)}"${sa}>${hd}`;
  if(p.ph==='body')return figureSVG(p.w||1,(p.label||'').toLowerCase()==='back'?'back':'front');
  const h=p.hue??200;
  return `<div class="ph" style="background:linear-gradient(150deg,hsl(${h} 45% 62%),hsl(${(h+30)%360} 40% 38%))"><em>Sample</em></div>${hd}`;
}
/* an entry's photo of one side of the body, by its label; an unlabelled photo counts as the front */
function sidePhoto(ps,side){const lab=p=>(p.label||'').trim().toLowerCase();const hit=ps.find(p=>lab(p)===side);if(hit)return hit;return side==='front'?ps.find(p=>lab(p)!=='back')||null:null}
function frames(region=V.region,side=V.side||'front'){
  const byDate=(a,b)=>a.occurred_at<b.occurred_at?-1:1;
  if(!region){
    const f=[];D.entries.filter(e=>e.details.series==='body'&&e.photos.length).sort(byDate).forEach(e=>{const p=sidePhoto(e.photos,side);if(p)f.push({date:e.occurred_at,photo:p,entry:e})});
    if(side==='front'&&(D.basePhoto||D.basePhotoPath))f.push({date:TODAY,photo:D.basePhoto?{src:D.basePhoto}:{path:D.basePhotoPath,enc:D.basePhotoEnc},base:true});
    return f;
  }
  const f=[];D.entries.filter(e=>e.regions.includes(region)&&e.photos.length&&(e.details.series!=='body'||region==='whole_body')).sort(byDate).forEach(e=>e.photos.forEach(p=>f.push({date:e.occurred_at,photo:p,entry:e})));
  return f;
}
/* zoom and position a photo inside its box, with the body or face outline over it; saves a fit on the photo (null = as shot) */
function openAdjust(photo,outline,onSave){
  const ONE={s:1,x:0,y:0,r:0},f={...ONE,...(photo.fit||{})};let show=true;
  const isOne=()=>Math.abs(f.s-1)<0.01&&Math.abs(f.x)<0.005&&Math.abs(f.y)<0.005&&Math.abs(f.r||0)<0.3;
  openModal(`<div class="sheet-h"><h3>Adjust photo</h3><button class="x" type="button" aria-label="Close">✕</button></div>
   <div class="adj"><div class="adjbox${outline==='body'?' body':''}" id="adjBox">${photoHTML({...photo,fit:undefined},'Photo',null,{fit:'contain'})}${outline?`<div class="adjol" id="adjOl">${outlineSVG(outline)}</div>`:''}</div>
   <p class="story-p" style="margin:10px 0 6px;text-align:center">Drag to move. Scroll or use the sliders to zoom and straighten.</p>
   <div class="adjctl"><label>Zoom <input type="range" id="adjS" min="0.5" max="5" step="0.01" value="${f.s}"></label><label>Tilt <input type="range" id="adjR" min="-45" max="45" step="0.5" value="${f.r||0}"></label>${outline?`<label class="chk"><input type="checkbox" id="adjOn" checked> Outline</label>`:''}</div>
   <div class="form-acts" style="margin-top:12px"><span><button type="button" class="btn-ghost" id="adjReset">Reset</button></span><span style="display:flex;gap:8px"><button type="button" class="btn-ghost" id="adjCancel">Cancel</button><button type="button" class="btn-accent" id="adjDone">Done</button></span></div></div>`);
  const box=$('#adjBox'),img=box.querySelector('img');
  const draw=()=>{if(img)img.style.transform=`translate(${(f.x*100).toFixed(2)}%,${(f.y*100).toFixed(2)}%) rotate(${f.r||0}deg) scale(${f.s})`;$('#adjS').value=f.s;$('#adjR').value=f.r||0};
  draw();
  let drag=null;
  box.addEventListener('pointerdown',e=>{drag={x0:e.clientX,y0:e.clientY,fx:f.x,fy:f.y};box.setPointerCapture(e.pointerId);e.preventDefault()});
  box.addEventListener('pointermove',e=>{if(!drag)return;const b=box.getBoundingClientRect();f.x=Math.max(-1.5,Math.min(1.5,drag.fx+(e.clientX-drag.x0)/b.width));f.y=Math.max(-1.5,Math.min(1.5,drag.fy+(e.clientY-drag.y0)/b.height));draw()});
  box.addEventListener('pointerup',()=>{drag=null});box.addEventListener('pointercancel',()=>{drag=null});
  box.addEventListener('wheel',e=>{e.preventDefault();f.s=Math.max(0.5,Math.min(5,f.s*(e.deltaY<0?1.05:0.95)));draw()},{passive:false});
  $('#adjS').addEventListener('input',e=>{f.s=+e.target.value;draw()});$('#adjR').addEventListener('input',e=>{f.r=+e.target.value;draw()});
  const on=$('#adjOn');if(on)on.addEventListener('change',()=>{$('#adjOl').hidden=!on.checked});
  $('#adjReset').addEventListener('click',()=>{Object.assign(f,ONE);draw()});
  $('#adjCancel').addEventListener('click',closeModal);
  $('#adjDone').addEventListener('click',()=>{onSave(isOne()?null:{s:+f.s.toFixed(3),x:+f.x.toFixed(3),y:+f.y.toFixed(3),...(Math.abs(f.r||0)>=0.3?{r:+(+f.r).toFixed(1)}:{})});closeModal()});
}
/* a photo full size on a dark ground; click anywhere to close */
function openLightbox(p){openModal(`<div class="lightbox" id="lbox">${photoHTML(p,'Photo',null,{fit:'contain'})}</div>`);$('#lbox').addEventListener('click',closeModal)}

/* ---------- widgets ---------- */
const WIDGETS={
  appointments:{label:'Appointments',hint:'Upcoming, and last visit by kind'},
  concerns:{label:'Concerns',hint:'Active and resolved'},
  regimens:{label:'Active regimens',hint:'Your diet, supplements, meds, products'},
  diet:{label:'Diet',hint:'What you are eating now'},
  challenge:{label:'Challenge',hint:'Progress on a time-boxed challenge'},
  savedchart:{label:'Chart',hint:'One of the charts you built on the Charts page'},
  labs:{label:'Latest lab results',hint:'Most recent report'},
  photos:{label:'Recent photos',hint:'Latest photos, any area'},
  recent:{label:'Recent entries',hint:'Latest things you logged'},
  teeth:{label:'Teeth',hint:'Your teeth chart: fillings, crowns, removed or never-grown teeth'},
  quick:{label:'Quick entry',hint:'Log one thing for today in a tap, like your cycle or a rating. Asks again each day.'},
  plan:{label:'Yearly plan',hint:'Your appointment targets for the year'},
  integrations:{label:'Integrations',hint:'Apple Health, Oura, Garmin, Whoop'}
};
const inRegion=e=>!V.region||(e.regions||[]).includes(V.region);
function donut(pct,size,stroke,col,center=''){const r=(size-stroke)/2,C=2*Math.PI*r,p=Math.max(0,Math.min(1,pct));
  return `<div class="donut" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="var(--line)" stroke-opacity=".7" stroke-width="${stroke}"/>${p>0?`<circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${col}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${(C*p).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 ${size/2} ${size/2})"/>`:''}</svg>${center?`<div class="dc">${center}</div>`:''}</div>`}
function challengeBlock(c){const s=challengeStats(c);
  return `<div class="donut-w">${donut(s.elapsed/s.total,112,12,'var(--accent)',`<b>${s.elapsed}</b><span>of ${s.total} days</span>`)}<div class="rules"><span class="t" style="font-weight:700;font-size:15px">${esc(c.title)}</span><span class="s" style="font-size:12px;color:var(--muted)">${fmtShort(c.started_on)} – ${fmtShort(s.end)}</span>
   ${s.rules.map(r=>{const st=ruleStatus(c,r);return `<div class="rule" style="justify-content:space-between"><span><b>${esc(ruleTitle(r))}</b></span><span class="${statusClass(st.st)}" style="font-weight:700;font-size:12.5px">${esc(st.label)}</span></div>`}).join('')}</div></div>`}
function challengeStats(c){
  const end=addDays(c.started_on,c.days-1),total=c.days,elapsed=Math.max(0,Math.min(total,dayDiff(c.started_on,TODAY)+1));
  const rules=c.rules.map(r=>{
    const per=r.per==='day'?1:r.per==='week'?7:30,periods=Math.max(1,Math.ceil(Math.min(elapsed,total)/per));let hit=0;
    for(let i=0;i<periods;i++){const a=addDays(c.started_on,i*per),b=addDays(c.started_on,(i+1)*per-1);
      if(ruleHit(r,a,b))hit++}
    return {...r,hit,periods};
  });
  return {end,total,elapsed,rules};
}
function sugHTML(){const pend=D.suggestions.filter(s=>s.status==='pending');return pend.map(s=>`<div class="rcard" data-sug style="background:transparent;border:1.5px dashed var(--muted)"><span class="s" style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;font-weight:700">Found on your calendar</span><span class="t">${esc(s.title)}</span><span class="s">${fmt(s.occurred_at)} · ${esc(s.found)}</span><span style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn-dark btn-sm" type="button" data-sug="${s.id}" data-a="accept">Add</button><button class="btn-ghost btn-sm" type="button" data-sug="${s.id}" data-a="dismiss">Dismiss</button></span></div>`).join('')}
const WIDGET_TAB={appointments:'appointments',plan:'plan',suggestions:'appointments',concerns:'concerns',regimens:'routines',diet:'routines',challenge:'plan',savedchart:'charts',labs:'labs',photos:'photos',recent:'timeline'};
function widgetBody(w){
  if(w.type==='teeth')return teethWidget();
  if(w.type==='quick')return quickBody(w);
  if(w.type==='appointments'){
    const ap=D.entries.filter(e=>e.type==='appointment'&&inRegion(e));const sug=sugHTML();
    const up=ap.filter(e=>e.details.status==='upcoming').sort((a,b)=>a.occurred_at<b.occurred_at?-1:1);
    const kinds={};ap.filter(e=>e.details.status==='done').sort(byDateDesc()).forEach(e=>{if(!kinds[e.details.kind])kinds[e.details.kind]=e});
    return sug+(up.map(e=>`<button type="button" class="row" data-entry="${e.id}"><span><span class="t">${esc(e.title)}</span><br><span class="s">${fmt(e.occurred_at)} · ${ago(e.occurred_at)}</span></span><span class="pill up">Upcoming</span></button>`).join('')
      +(w.showPast===false?[]:Object.values(kinds)).map(e=>`<button type="button" class="row" data-entry="${e.id}"><span><span class="t">${esc(kindLabel(e.details.kind))}</span><br><span class="s">Last visit ${ago(e.occurred_at)}</span></span><span class="pill mut">${fmtShort(e.occurred_at)}</span></button>`).join(''))||`<div class="empty">No appointments.</div>`;
  }
  if(w.type==='concerns'){
    const cs=D.concerns.filter(c=>!V.region||c.regions.includes(V.region)).sort((a,b)=>(a.status==='resolved')-(b.status==='resolved')||(a.started_on<b.started_on?1:-1));
    return cs.map(c=>{const n=D.entries.filter(e=>e.concern_id===c.id).length;return `<button type="button" class="row${V.concern===c.id?' sel':''}" data-concern="${c.id}"><span><span class="t">${esc(c.title)}</span><br><span class="s">${n} entries · since ${fmtShort(c.started_on)}</span></span><span class="pill ${c.status==='resolved'?'mut':'up'}">${c.status==='resolved'?'Resolved':'Active'}</span></button>`}).join('')||`<div class="empty">No concerns.</div>`;
  }
  if(w.type==='regimens'){
    // the current diet counts as active too: it sits first, then the regimens
    const cur=D.regimens.find(r=>r.category==='diet'&&regimenActive(r));
    const rs=[...(cur?[cur]:[]),...D.regimens.filter(r=>r.category!=='diet'&&regimenActive(r)&&(!V.region||r.regions.includes(V.region)))];
    const sub=r=>r.category==='diet'?`Diet · ${span(stintsOf(r)[stintsOf(r).length-1].from)}`:[r.dose,r.frequency].filter(Boolean).join(' · ');
    return rs.map(r=>`<div class="row rrow"><button type="button" class="rlink" data-regimen="${r.id}"><span style="display:flex;gap:10px;align-items:center;min-width:0">${ico(r.category==='diet'?'diet':'regimen',1)}<span style="min-width:0"><span class="t">${esc(r.name)}</span><br><span class="s">${esc(sub(r))}</span></span></span></button>${regAdhHTML(r)}</div>`).join('')||`<div class="empty">Nothing active.</div>`;
  }
  if(w.type==='diet'){
    const cur=D.regimens.find(r=>r.category==='diet'&&regimenActive(r));
    const past=D.regimens.filter(r=>r.category==='diet'&&r!==cur).sort((a,b)=>a.started_on<b.started_on?1:-1).slice(0,2);
    return (cur?`<button type="button" class="rcard" data-regimen="${cur.id}" style="background:var(--accent-soft)"><span class="s">Current diet · ${span(stintsOf(cur)[stintsOf(cur).length-1].from)}</span><span class="t" style="font-size:17px">${esc(cur.name)}</span>${cur.notes?`<span class="s">${esc(cur.notes)}</span>`:''}</button>`:`<div class="empty">No current diet set.</div>`)
      +past.map(r=>`<button type="button" class="row" data-regimen="${r.id}"><span><span class="t">${esc(r.name)}</span><br><span class="s">${fmtShort(r.started_on)} – ${fmtShort(r.ended_on)}</span></span></button>`).join('');
  }
  if(w.type==='challenge'){
    const c=chOnly().filter(c=>dayDiff(c.started_on,TODAY)<c.days).sort((a,b)=>a.started_on<b.started_on?1:-1)[0]||chOnly()[0];
    if(!c)return `<div class="empty">No challenge running. Start one from Lifestyle.</div>`;
    return `<button type="button" class="rcard" data-challenge="${c.id}" style="background:transparent;padding:0">${challengeBlock(c)}</button>`;
    const s=challengeStats(c);
    return `<button type="button" class="rcard" data-challenge="${c.id}" style="background:var(--soft)"><span class="t" style="font-size:16px">${esc(c.title)}</span><span class="s">Day ${s.elapsed} of ${s.total} · ends ${fmtShort(s.end)}</span><div class="prog accent"><span style="width:${s.elapsed/s.total*100}%"></span></div>
      ${s.rules.map(r=>`<span class="s"><b style="color:var(--ink)">${r.hit} of ${r.periods}</b> ${esc(r.per==='day'?'days':r.per+'s')} · ${esc(r.label)}</span>`).join('')}</button>`;
  }
  if(w.type==='savedchart'){const c=D.charts.find(x=>x.id===w.chartId);if(c&&c.kind==='cycle')return `<div class="cyc small">${cycleChartBody(c,true)}</div>`;if(c&&c.kind==='month')return `<div class="cyc small">${monthBody(c,true)}</div>`;return c?`<div class="cbox" data-cbox="${c.id}" data-small></div><div class="legend">${chartLegend(c)}</div>`:`<div class="empty">This chart was deleted.</div>`}
  if(w.type==='labs'){
    const l=labsOnly().slice().sort(byDateDesc('date'))[0];if(!l)return `<div class="empty">No lab reports yet.</div>`;
    return `<button type="button" class="linkish" data-lab="${l.id}">${esc(l.lab)} · ${fmt(l.date)}</button><div class="list" style="margin-top:8px">${l.results.map(r=>`<div class="row" style="background:transparent;padding:4px 0;border-bottom:1px solid var(--line);border-radius:0"><span class="t" style="font-weight:600">${esc(r.marker)}</span><span class="mono">${esc(r.value)} <span class="s">${esc(r.unit)}</span> ${r.flag?`<span class="pill flag">${esc(r.flag)}</span>`:''}</span></div>`).join('')}</div>`;
  }
  if(w.type==='photos'){
    const ps=D.entries.filter(e=>e.photos.length&&e.details.series!=='body'&&inRegion(e)).sort(byDateDesc()).slice(0,6);
    return ps.length?`<div class="pgrid" style="grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">${ps.map(e=>`<button type="button" class="pcell" data-entry="${e.id}"><div class="pbox">${photoHTML(e.photos[0],e.title,e.occurred_at)}</div></button>`).join('')}</div>`:`<div class="empty">No photos yet.</div>`;
  }
  if(w.type==='suggestions'){return sugHTML()||`<div class="empty">Nothing new from your calendar.</div>`}
  if(false){
    const pend=D.suggestions.filter(s=>s.status==='pending');
    return pend.map(s=>`<div class="rcard" style="background:var(--accent-soft)"><span class="t">${esc(s.title)}</span><span class="s">${fmt(s.occurred_at)} · ${esc(s.found)}</span><span style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn-dark btn-sm" type="button" data-sug="${s.id}" data-a="accept">Add to timeline</button><button class="btn-ghost btn-sm" type="button" data-sug="${s.id}" data-a="dismiss">Dismiss</button></span></div>`).join('')||`<div class="empty">Nothing new from your calendar.</div>`;
  }
  if(w.type==='recent'){
    return D.entries.filter(inRegion).filter(e=>!(e.type==='photo'&&e.details.series==='body')&&e.occurred_at<=TODAY).sort(byDateDesc()).slice(0,5).map(e=>`<button type="button" class="row" data-entry="${e.id}"><span style="display:flex;gap:10px;align-items:center;min-width:0">${ico(e.type,1)}<span class="t">${esc(e.title)}</span></span><span class="s mono">${fmtShort(e.occurred_at)}</span></button>`).join('')||`<div class="empty">Nothing yet.</div>`;
  }
  if(w.type==='plan'){return plansFor(YEAR).map(p=>{const s=planStats(p),[st]=planStatus(p,s);return `<button type="button" class="row" data-tabgo="plan"><span style="display:flex;gap:10px;align-items:center;min-width:0">${donut(s.done/s.target,30,5,s.done>=s.target?'var(--accent)':'#4F5BF5')}<span style="min-width:0"><span class="t">${esc(p.title)}</span><br><span class="s">${esc(st)}</span></span></span><span class="mono s">${s.done}/${s.target}</span></button>`}).join('')||`<div class="empty">No plan yet.</div>`}
  if(w.type==='integrations'){
    const reading=D.hk&&Object.keys(D.hk).some(k=>(D.hk[k]||[]).length);return [['Apple Health','Connected on the phone; what is used is set there'],['Oura','Direct, v2'],['Garmin','Through Apple Health'],['Whoop','Through Apple Health'],['MyFitnessPal','Through Apple Health']].map(([n,s])=>n==='Apple Health'?`<button type="button" class="row" data-act="apple-health"><span><span class="t">${n}</span><br><span class="s">${s}</span></span><span class="pill src">${reading?'Reading':'Not connected'}</span></button>`:`<div class="row"><span><span class="t">${n}</span><br><span class="s">${s}</span></span><span class="pill src">Not connected</span></div>`).join('');
  }
  return '';
}
function widgetTitle(w){if(w.type==='quick')return quickTitle(w);if(w.type==='savedchart'){const c=D.charts.find(x=>x.id===w.chartId);return c?c.title:'Chart'}return (WIDGETS[w.type]||{label:''}).label}
function widgetSub(w){if(w.type==='savedchart'){const c=D.charts.find(x=>x.id===w.chartId);const s=c&&c.y1&&lineSeries(c.y1);const lp=lastVal(s);return lp?(s.monthly?`${fmtV(lp.v,s.unit)} this month`:`${fmtV(lp.v,s.unit)} · ${fmtShort(lp.d)}`):''}if(w.type==='concerns'){return `${D.concerns.filter(c=>c.status!=='resolved'&&(!V.region||c.regions.includes(V.region))).length} active`}return ''}
const FILTERED=new Set(['appointments','concerns','regimens','photos','recent']);
function renderWidgets(col){
  const ws=D.widgets[col];
  return `<div class="wzone" data-wcol="${col}">`+ws.map((w,i)=>{const f=FILTERED.has(w.type);
    const head=WIDGET_TAB[w.type]?`<button type="button" class="wlink" data-tabgo="${WIDGET_TAB[w.type]}"${w.chartId?` data-focus="${w.chartId}"`:''}>${esc(widgetTitle(w))}<span aria-hidden="true">↗</span></button>`:`<h2>${esc(widgetTitle(w))}</h2>`;
    return `<section class="card wcard${f?'':' global'}" data-wid="${w.id}">
    ${V.customizing?`<div class="wtools"><button type="button" class="grip" data-wdrag="${w.id}" aria-label="Drag to move ${esc(widgetTitle(w))}">${GRIP}</button><button type="button" data-wmove="${col}:${i}:-1" aria-label="Move up">↑</button><button type="button" data-wmove="${col}:${i}:1" aria-label="Move down">↓</button><button type="button" data-wdel="${col}:${i}" aria-label="Remove widget">✕</button></div>`:''}
    <div class="card-h"${V.customizing?' style="padding-right:128px"':''}>${head}<div style="display:flex;gap:8px;align-items:center"><span class="sub">${f&&V.region?`<span class="pill fpill">${esc(rl(V.region))}</span>`:esc(widgetSub(w))}</span>${w.type==='appointments'&&!V.customizing?`<div class="mwrap"><button type="button" class="dots" data-cmenu aria-label="Appointments options" aria-haspopup="menu">⋯</button><div class="cmenu" role="menu" hidden><button type="button" role="menuitemcheckbox" aria-checked="${w.showPast!==false}" class="${w.showPast!==false?'on':''}" data-wpast="${w.id}">${w.showPast!==false?'✓ ':''}Show past appointments</button></div></div>`:''}</div></div>
    <div class="list" data-clip="${w.type==='appointments'?4:5}" data-w="${w.id}">${widgetBody(w)}</div></section>`}).join('')+(V.customizing?`<button type="button" class="add-w" data-wadd="${col}">+ Add widget</button>`:'')+'</div>';
}
function clipLists(){document.querySelectorAll('[data-clip]').forEach(l=>{const lim=+l.dataset.clip,kids=[...l.children].filter(c=>!c.hasAttribute('data-sug')),n=kids.length;if(n<=lim)return;const open=V.expanded.has(l.dataset.w);
  if(!open)kids.slice(lim).forEach(c=>c.hidden=true);const btn=document.createElement('button');btn.type='button';btn.className='seemore';btn.dataset.seemore=l.dataset.w;btn.textContent=open?'Show less':`See all ${n}`;l.after(btn)})}
/* drag widgets between dashboard columns */
let wdrag=null;
document.addEventListener('pointerdown',e=>{const g=e.target.closest('[data-wdrag]');if(!g)return;e.preventDefault();
  const card=g.closest('.wcard'),r=card.getBoundingClientRect(),ph=document.createElement('div');ph.className='drop-ph';ph.style.height=r.height+'px';card.after(ph);
  card.classList.add('dragging');Object.assign(card.style,{width:r.width+'px',left:r.left+'px',top:r.top+'px'});wdrag={id:g.dataset.wdrag,card,ph,dx:e.clientX-r.left,dy:e.clientY-r.top}});
document.addEventListener('pointermove',e=>{if(!wdrag)return;const {card,ph}=wdrag;card.style.left=(e.clientX-wdrag.dx)+'px';card.style.top=(e.clientY-wdrag.dy)+'px';
  const zone=document.elementsFromPoint(e.clientX,e.clientY).map(el=>el.closest&&el.closest('.wzone')).find(Boolean);if(!zone)return;
  const before=[...zone.querySelectorAll(':scope>.wcard:not(.dragging)')].find(c=>{const bb=c.getBoundingClientRect();return e.clientY<bb.top+bb.height/2});
  zone.insertBefore(ph,before||zone.querySelector(':scope>.add-w'));
  if(e.clientY<60)window.scrollBy(0,-14);else if(e.clientY>innerHeight-60)window.scrollBy(0,14)});
document.addEventListener('pointerup',()=>{if(!wdrag)return;const {id,ph}=wdrag;wdrag=null;const zone=ph.closest('.wzone');
  if(zone){const idx=[...zone.children].filter(el=>(el.classList.contains('wcard')&&!el.classList.contains('dragging'))||el===ph).indexOf(ph);let w;
    ['left','right'].forEach(k=>{const i=D.widgets[k].findIndex(x=>x.id===id);if(i>=0)w=D.widgets[k].splice(i,1)[0]});
    if(w){D.widgets[zone.dataset.wcol].splice(idx,0,w);save()}}
  render()});

/* ---------- views ---------- */
const TABS=[['dashboard','Dashboard'],['timeline','History'],['appointments','Appointments'],['concerns','Concerns'],['routines','Lifestyle'],['plan','Plan'],['charts','Charts'],['labs','Reports'],['photos','Photos'],['reports','Summary']];
const NAVICON={concerns:'<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',plan:'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',dashboard:'<path d="M4 11.5 12 5l8 6.5V20H4z"/><path d="M10 20v-5h4v5"/>',timeline:'<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',appointments:'<rect x="4" y="5.5" width="16" height="14" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',charts:'<path d="M5 20V11M11 20V5M17 20v-7M3 20h18"/>',labs:'<path d="M9.5 3.5h5M10.5 3.5v6L5 18.5a1.5 1.5 0 0 0 1.3 2h11.4a1.5 1.5 0 0 0 1.3-2l-5.5-9v-6"/>',photos:'<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m20.5 16-4.5-4.5L6 19"/>',routines:'<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z"/><path d="M5 19 13 11"/>',reports:'<path d="M14 3.5H7a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3.5V8h4.5M9 13h6M9 16.5h6"/>'};
function renderNav(){$('#nav').innerHTML=TABS.map(([k,l])=>`<button type="button" data-tab="${k}" class="${V.tab===k?'on':''}"${V.tab===k?' aria-current="page"':''}><span class="nico"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${NAVICON[k]}</svg></span><span>${l}</span></button>`).join('');
  const on=$('#nav .on'),nav=$('#nav');if(on&&nav.scrollWidth>nav.clientWidth)nav.scrollLeft=on.offsetLeft-(nav.clientWidth-on.offsetWidth)/2}
function scopeChips(){let h='';if(V.region)h+=`<button type="button" class="scope-chip" data-clear="region">${esc(rl(V.region))}<i aria-label="Clear">✕</i></button>`;if(V.concern){const c=D.concerns.find(c=>c.id===V.concern);h+=`<button type="button" class="scope-chip" data-clear="concern">${esc(c?c.title:'Concern')}<i aria-label="Clear">✕</i></button>`}return h}

/* needs-you circles (phones): tap = preview card with actions; Dismiss hides the circle
   until the situation changes (each key includes what it's about, e.g. the period or last entry) */
let STORIES=[];
function storyItems(){
  const out=[],soon=addDays(TODAY,7),dis=(D.settings&&D.settings.dismissedStories)||{};
  const pend=D.suggestions.filter(x=>x.status==='pending');
  if(pend.length)out.push({key:'cal:'+pend.map(x=>x.id).sort().join(','),ico:'appointment',label:'Calendar',sub:`${pend.length} to review`,title:'Found on your calendar',
    body:()=>`<p class="story-p">${pend.length===1?'This event':'These events'} on your calendar ${pend.length===1?'looks':'look'} like health appointments. Add the ones you want on your record. Nothing is added until you choose Add.</p><div class="list">${pend.map(x=>`<div class="row"><span><span class="t">${esc(x.title)}</span><br><span class="s">${fmt(x.occurred_at)} · ${ago(x.occurred_at)}</span></span><span style="display:flex;gap:6px"><button type="button" class="btn-dark btn-sm" data-ssug="${x.id}" data-a="accept">Add</button><button type="button" class="btn-ghost btn-sm" data-ssug="${x.id}" data-a="skip">Not health</button></span></div>`).join('')}</div>`,
    actions:[['See Appointments',()=>{closeSheet();V.tab='appointments';render()}]]});
  D.entries.filter(e=>e.type==='appointment'&&e.details.status==='upcoming'&&e.occurred_at>=TODAY&&e.occurred_at<=soon).sort((p,q)=>p.occurred_at<q.occurred_at?-1:1).forEach(e=>{
    const d=e.details;out.push({key:'appt:'+e.id+':'+e.occurred_at,ico:'appointment',label:e.title,sub:ago(e.occurred_at),title:e.title,
      body:()=>`<p class="story-p">Upcoming ${esc((kindLabel(d.kind)||'appointment').toLowerCase())} appointment, ${ago(e.occurred_at)}.</p><dl class="kv"><dt>When</dt><dd>${fmt(e.occurred_at)}</dd>${d.provider?`<dt>With</dt><dd>${esc(d.provider)}${d.practice?` · ${esc(d.practice)}`:''}</dd>`:''}${d.reason?`<dt>For</dt><dd>${esc(d.reason)}</dd>`:''}</dl>`,
      actions:[['Record how it went',()=>openForm('appointment',{...e,details:{...d,status:'done'}})],['Follow-up',()=>openForm('observation',{parent_entry_id:e.id,regions:e.regions,concern_id:e.concern_id})],['Edit',()=>openForm('appointment',e)]]})});
  chOnly().forEach(c=>{const st=challengeStats(c);if(st.elapsed>=st.total||dayDiff(c.started_on,TODAY)<0)return;
    c.rules.forEach((r,ri)=>{const per=r.per==='day'?1:r.per==='week'?7:30,i=Math.floor(dayDiff(c.started_on,TODAY)/per),from=addDays(c.started_on,i*per),to=addDays(from,per-1);
      const hit=ruleHit(r,from,to);
      const when=r.per==='day'?'today':'this '+r.per;
      if(!hit)out.push({key:`ch:${c.id}:${ri}:${from}`,ico:'challenge',label:r.label,sub:when,title:c.title,
        body:()=>`<p class="story-p">No ${esc(r.label.toLowerCase())} logged ${when} yet.</p>${challengeBlock(c)}`,
        actions:[['Add it now',()=>r.kind==='regimen'?logToday(r.regimen):r.kind==='photo'?(needVault()||openForm('photo',{regions:[r.region],title:r.label})):openForm('measurement',{details:{metric:r.metric}})],['Open Plan',()=>{closeSheet();V.tab='plan';render()}]]})})});
  tracked().forEach(c=>{const due=dueMetrics(c);if(!due.length)return;const per=c.tracking.per||'week';
    out.push({key:`ck:${c.id}:${periodStart(per)}`,ico:'measurement',label:c.title,sub:'check-in due',title:c.title,
      body:()=>`<p class="story-p">Your ${per==='day'?'daily':per==='week'?'weekly':'monthly'} check-in: ${due.map(k=>esc(metric(k).l.toLowerCase())).join(', ')}.</p>`,
      actions:[['Check in now',()=>openCheckin([c.id])],['Open concern',()=>openConcern(c.id)]]})});
  D.concerns.filter(c=>c.status!=='resolved'&&!((c.tracking||{}).metrics||[]).length).forEach(c=>{const last=D.entries.filter(e=>e.concern_id===c.id).sort(byDateDesc())[0];const quiet=last?dayDiff(last.occurred_at,TODAY):dayDiff(c.started_on||TODAY,TODAY);
    if(quiet>=14)out.push({key:`cq:${c.id}:${last?last.id:'none'}`,ico:'observation',label:c.title,sub:`${quiet} days quiet`,title:c.title,
      body:()=>`<p class="story-p">Still marked active, but nothing has been logged for ${quiet} days.</p>${last?`<div class="sec">Last entry</div>${entryRow(last)}`:''}`,
      actions:[['Check in',()=>openForm('observation',{concern_id:c.id,regions:c.regions})],['Mark resolved',()=>{c.status='resolved';c.resolved_on=TODAY;save();closeSheet();render()}],['Open concern',()=>openConcern(c.id)]]})});
  illnesses().forEach(c=>{const e=openEpisode(c);if(!e||e.from>TODAY)return;const days=episodeDays(e),name=e.label||c.title;
    out.push({key:`sick:${c.id}:${e.from}`,ico:'illness',label:name,sub:'still sick?',title:name,body:()=>`<p class="story-p">${esc(name)} has been on for ${days} ${days===1?'day':'days'}, since ${fmt(e.from)}. Say when it ended, so the days get counted right.</p>`,
      actions:[['Better today',()=>{endEpisodeToday(c.id);closeSheet();render()}],['Ended another day',()=>openEpisodeSheet(c.id,episodesOf(c).indexOf(e))],['Open illness',()=>openConcern(c.id)]]})});
  if(typeof vaultState==='function'&&vaultState()==='locked')out.unshift({key:'vault:'+TODAY,ico:'lock',label:'Photos',sub:'locked',title:'Photos are locked on this device',
    body:()=>'<p class="story-p">Your photos and files are encrypted. Enter your photo passphrase once on this device to see them.</p>',actions:[['Unlock',()=>openVaultUnlock()]]});
  return out.filter(i=>!dis[i.key]);
}
function storiesHTML(){
  STORIES=storyItems();
  if(!STORIES.length)return '';
  const lockIco='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  return `<div class="stories" role="list" aria-label="Needs your attention">${STORIES.map((it,i)=>`<button type="button" class="story" role="listitem" data-story="${i}"><span class="ring"><span class="bub" style="color:var(--t-${it.ico==='lock'?'challenge':it.ico})">${it.ico==='lock'?lockIco:icon(it.ico)}</span></span><span class="sl">${esc(it.label)}</span><span class="ss">${esc(it.sub)}</span></button>`).join('')}</div>`;
}
function openStory(i){
  const it=STORIES[i];if(!it)return;
  openSheet(`<div class="sheet-h"><h3>${esc(it.title)}</h3><button class="x" type="button" aria-label="Close">✕</button></div>${it.body()}
   <div class="form-acts story-acts">${it.actions.map((x,j)=>`<button type="button" class="${j===0?'btn-accent':'btn-ghost'}" data-sact="${j}">${esc(x[0])}</button>`).join('')}<button type="button" class="btn-ghost" data-sact="dismiss" title="Hide this from the top row. Nothing is deleted.">Dismiss</button></div>
   <p class="story-hint">Dismiss only hides this from the row at the top. Nothing is deleted.</p>`);
  $('#overlay').querySelector('.sheet').addEventListener('click',ev=>{
    const sg=ev.target.closest('[data-ssug]');
    if(sg){const x=D.suggestions.find(y=>y.id===sg.dataset.ssug);if(!x)return;
      if(sg.dataset.a==='skip'){x.status='dismissed';save();render();const j=STORIES.findIndex(y=>y.key.startsWith('cal:'));j>=0?openStory(j):closeSheet()}
      else openForm('appointment',{title:x.title,occurred_at:x.occurred_at,details:{...x.details,status:'upcoming'},source:'calendar',fromSuggestion:x.id});return}
    const row=ev.target.closest('[data-entry]');if(row){openEntry(row.dataset.entry);return}
    const b=ev.target.closest('[data-sact]');if(!b)return;
    if(b.dataset.sact==='dismiss'){D.settings.dismissedStories=D.settings.dismissedStories||{};D.settings.dismissedStories[it.key]=TODAY;
      for(const [k,v] of Object.entries(D.settings.dismissedStories))if(dayDiff(v,TODAY)>90)delete D.settings.dismissedStories[k];
      save();closeSheet();render();return}
    it.actions[+b.dataset.sact][1]();
  });
}
function viewDashboard(){
  return `${storiesHTML()}<div class="page-h" style="margin-bottom:16px"><div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><h1>Dashboard</h1><div class="scope">${scopeChips()}</div>${V.region?`<span class="fhint">White widgets show ${esc(rl(V.region))} only. Tinted widgets always show everything.</span>`:''}</div>
    <button type="button" class="btn-ghost${V.customizing?' on':''}" data-act="customize">${V.customizing?'Done':'Customize'}</button></div>
  <div class="dash">
    <div class="wcol d-left">${renderWidgets('left')}</div>
    <section class="card d-body bodycard${V.editing?' editing-card':''}" aria-label="Body" id="bodyCard"${V.region&&V.bodyH?` style="min-height:${V.bodyH}px"`:''}>
      <div class="card-h"><h2 id="bodyTitle">${V.region?esc(rl(V.region)):'Your body'}</h2><span class="sub" id="bodySub"></span></div>
      <div class="stage-top" id="stageTop"></div>
      <div class="stage" id="stage"></div>
      <div class="stage-tools" id="stageTools"></div>
      <div class="scrub" id="scrub"></div>
      ${V.region?'':`<div class="bmetrics" id="bmetrics"></div><button type="button" class="hcard" data-act="health-card"><span><b>Health card</b><span>${esc(cardSummary())}</span></span><span aria-hidden="true">›</span></button>`}
    </section>
    <div class="wcol d-right">${renderWidgets('right')}</div>
  </div>`;
}
/* The body card. Regions sit on the body (front or back); tapping one opens its 4:5 canvas with its photos and its own
   points (the face's canvas is the head drawing); tapping a point opens that point's photos. Two levels, no more. The
   pencil edits the regions (on the body) or the points (on a canvas): click to add one, drag to move, click to rename or
   remove; Save keeps, Cancel puts every one back. Teeth keep their chart. */
const ICO_CAM='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
const ICO_ROT='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/></svg>';
const ICO_FIT='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
const ICO_PEN='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 4.5 19.5 9.5 9 20H4v-5z"/><path d="m12.5 6.5 5 5"/></svg>';
const ib=(act,label,svg,on)=>`<button type="button" class="ibtn${on?' on':''}" data-act="${act}" aria-label="${esc(label)}" title="${esc(label)}">${svg}</button>`;
const hotHTML=(p,active,grouped)=>`<button type="button" class="hot${active.has(p.region)?' has':''}${grouped?' grouped':''}" data-pt="${esc(p.id)}" style="left:${+p.x||0}%;top:${+p.y||0}%" aria-label="${esc(rl(p.region))}"><span class="hot-tip">${esc(rl(p.region))}</span></button>`;
let EDIT_SNAP=null;// the points as they were when editing began; Cancel puts them back
function paintBody(fromScrub){
  const st=$('#stage');if(!st)return;
  V.side=V.side||'front';
  const region=V.region,parent=region?parentOf(region):null,teethView=region==='teeth'&&V.mouthView!=='photos',canvas=region&&!parent&&!teethView;
  const fr=frames();if(V.frame==null||V.frame>=fr.length)V.frame=fr.length-1;
  const cur=fr[V.frame];
  const active=new Set(D.concerns.filter(c=>c.status!=='resolved').flatMap(c=>c.regions));
  const title=$('#bodyTitle');if(title)title.textContent=region?rl(region):'Your body';
  if(!fromScrub){
    st.className='stage'+(region?' region':'')+(teethView?' teethstage':'')+(V.editing?' editing':'')+(V.editing&&V.editGroup==='all'?' grouped':'');
    let html='',tools='',top='';
    if(teethView){html=teethSVG(false)}
    else if(region){
      html=cur?photoHTML(cur.photo,cur.entry.title,cur.date):region==='face'?faceSVG():`<div class="empty-stage">No photos of this area yet.</div>`;
      if(canvas)html+=D.points.filter(p=>p.parent===region).map(p=>hotHTML(p,active)).join('');
    }else{
      html=cur?photoHTML(cur.photo,'Body',cur.date):figureSVG(1,V.side);
      const pts=D.points.filter(p=>!p.parent&&(p.side||'front')===V.side);
      if(V.editing&&V.editGroup==='all'&&pts.length){
        // every region in one box: drag the box to move them together, the slider spreads or gathers them
        const padX=6,padY=3,x0=Math.min(...pts.map(p=>+p.x))-padX,x1=Math.max(...pts.map(p=>+p.x))+padX,y0=Math.min(...pts.map(p=>+p.y))-padY,y1=Math.max(...pts.map(p=>+p.y))+padY;
        V.gbox={x:x0,y:y0,w:x1-x0,h:y1-y0};
        html+=`<div class="gbox" id="gbox" style="left:${x0}%;top:${y0}%;width:${x1-x0}%;height:${y1-y0}%" aria-label="All the regions. Drag to move them together">${pts.map(p=>hotHTML({...p,x:(p.x-x0)/(x1-x0)*100,y:(p.y-y0)/(y1-y0)*100},active,true)).join('')}</div>`;
      }else html+=pts.map(p=>hotHTML(p,active)).join('');
    }
    st.innerHTML=html;
    // the row above the stage: camera, adjust, turn round, back; the pencil on the right
    const nPhotos=`${fr.length} photo${fr.length===1?'':'s'}`;
    if(V.editing){
      top=region?`<span class="s" style="font-weight:700">Editing the points of ${esc(rl(region))}</span>`:`<div class="seg sm">${[['one','One by one'],['all','All together']].map(([v,l])=>`<button type="button" data-egroup="${v}" class="${(V.editGroup||'one')===v?'on':''}">${l}</button>`).join('')}</div>`;
      tools=`<button type="button" class="btn-ghost btn-sm" data-act="edit-cancel">Cancel</button>${region?`<button type="button" class="btn-ghost btn-sm" data-act="add-point">+ Point</button>`:(V.editGroup||'one')==='one'?`<button type="button" class="btn-ghost btn-sm" data-act="add-point">+ Region</button>`:`<button type="button" class="btn-ghost btn-sm" data-act="snap">Snap to the drawing</button><label class="s" style="display:flex;gap:6px;align-items:center">Spread <input type="range" id="gScale" min="0.5" max="1.6" step="0.01" value="1" style="width:90px;margin:0"></label>`}<button type="button" class="btn-accent btn-sm" data-act="edit-save">Save</button>`;
      $('#bodySub').textContent=region?'Click the photo to add a point. Drag one to move it; click one to rename or remove it.':(V.editGroup||'one')==='one'?'Click the figure to add a region. Drag one to move it; click one to rename or remove it.':'Drag the box to move every region together; the slider spreads them out or gathers them in.';
    }else{
      const backLabel=parent?`← ${rl(parent)}`:'← Whole body';
      top=(region?`<button class="btn-dark btn-sm" type="button" data-act="back">${esc(backLabel)}</button>`:'')
        +ib('add-photo',region?'Add a photo of this area':fr.length?'Add a photo':'Replace the drawing with your own photo',ICO_CAM)
        +(cur&&cur.entry&&!teethView?ib('adjust','Adjust photo',ICO_FIT):'')
        +(!region?ib('rotate',V.side==='front'?'Turn round: the back':'Turn round: the front',ICO_ROT,V.side==='back'):'')
        +(region==='teeth'?`<div class="seg sm">${[['teeth','Teeth'],['photos','Photos']].map(([v,l])=>`<button type="button" data-mview="${v}" class="${(teethView?'teeth':'photos')===v?'on':''}">${l}</button>`).join('')}</div>`:'')
        +`<span style="flex:1"></span>`+(canvas||!region?ib('edit-points',region?'Edit the points':'Edit the regions',ICO_PEN):'');
      if(!region&&!fr.length)tools=`<button class="btn-ghost btn-sm" type="button" data-act="base">Use your own photo instead of the drawing</button>`;
      if(teethView){const n=Object.keys(teethData()).length;$('#bodySub').textContent=n?`${n} ${n===1?'tooth':'teeth'} noted`:'Click a tooth'}
      else if(canvas){const n=childRegions(region).length;$('#bodySub').textContent=n?`${nPhotos} · ${n} point${n===1?'':'s'}`:nPhotos}
      else $('#bodySub').textContent=region?nPhotos:cur?(cur.base?'Your photo':fmt(cur.date)):(V.side==='back'?'The back':'');
    }
    $('#stageTop').innerHTML=top;$('#stageTools').innerHTML=tools;
    const gs=$('#gScale');if(gs){gs.addEventListener('input',e=>{const g=$('#gbox');if(g)g.style.transform=`scale(${e.target.value})`});gs.addEventListener('change',e=>{commitGroup(+e.target.value,0,0)})}
    const bm=$('#bmetrics');
    if(bm){
      // the stored values, in kg and cm: showMeasure converts once; the unit beside the number switches the preference
      const one=k=>{const p=measurePoints(k),lp=p[p.length-1],m=metric(k);
        const delta=p.length>1&&k!=='height'?numIn(k,lp.v)-numIn(k,p[0].v):null;
        const ch=delta!=null?`${delta>0?'+':''}${delta.toFixed(1)} since ${fmtShort(p[0].d)}`:lp?`Recorded ${fmtShort(lp.d)}${lp.src?' · '+lp.src:''}`:'';
        const shown=lp?showMeasure(k,lp.v):null,sw=k==='weight'||k==='height';
        return `<div class="bm"><button type="button" class="bmlog" data-logm="${k}" title="Log a new ${esc(m.l.toLowerCase())}"><span class="lab">${esc(m.l)} <span class="plus">+</span></span></button><span class="val num">${shown?esc(shown.value):'–'}${sw?` <button type="button" class="unit-t" data-unit="${k}" title="Shown in ${esc(unitWord(k))}. Switch unit">${esc(unitWord(k))}</button>`:`<small>${esc(shown?shown.unit:m.u)}</small>`}</span><span class="foot">${lp?esc(ch):'Not recorded'}</span></div>`};
      bm.innerHTML=one('weight')+one('body_fat')+one('height');
    }
  }
  if(fromScrub&&cur){st.innerHTML=(region?photoHTML(cur.photo,cur.entry.title,cur.date):photoHTML(cur.photo,'Body',cur.date))+[...st.querySelectorAll('.hot,.gbox')].map(h=>h.outerHTML).join('');if(!region)$('#bodySub').textContent=cur.base?'Your photo':fmt(cur.date)}
  const sc=$('#scrub');
  if(teethView){sc.innerHTML=teethLegend();return}
  if(V.editing){sc.innerHTML='';return}
  if(!fr.length){sc.innerHTML=`<div class="scrub-meta">${region==='face'?'The drawing stands in until you add a photo of your face.':`The scrubber appears once you have ${region?'photos of this area':'body progress photos'}.`}</div>`;return}
  const n=fr.length,step=Math.max(1,Math.ceil(n/40));
  const ticks=fr.map((f,i)=>i%step===0||i===V.frame?`<span class="${i===V.frame?'on':''}"></span>`:'').join('');
  if(fromScrub){sc.querySelector('.scrub-date').textContent=cur.base?'Today':fmt(cur.date);sc.querySelector('.ticks').innerHTML=ticks;return}
  sc.innerHTML=`<div class="scrub-top"><span class="scrub-date">${cur.base?'Today':fmt(cur.date)}</span><span class="scrub-meta">${n} photo${n>1?'s':''} · ${fmtShort(fr[0].date)} – ${fmtShort(fr[n-1].date)}</span></div><div class="ticks" aria-hidden="true">${ticks}</div>
   <input type="range" id="scrubber" min="0" max="${n-1}" value="${V.frame}" step="1" aria-label="Scrub through photos by date">`;
  $('#scrubber').addEventListener('input',e=>{V.frame=+e.target.value;paintBody(true)});
  // the card keeps its body-mode height while a region is open, so the page never jumps
  if(!region){const card=$('#bodyCard');if(card)requestAnimationFrame(()=>{V.bodyH=card.offsetHeight})}
}
/* the group box was moved or scaled: every region on this side the same way, in figure % */
function commitGroup(f,tx,ty){
  const g=V.gbox;if(!g)return;const pts=D.points.filter(p=>!p.parent&&(p.side||'front')===V.side);
  const cx=g.x+g.w/2,cy=g.y+g.h/2;
  pts.forEach(q=>{q.x=+Math.max(0,Math.min(100,cx+tx+(q.x-cx)*f)).toFixed(1);q.y=+Math.max(0,Math.min(100,cy+ty+(q.y-cy)*f)).toFixed(1)});
  save();paintBody();
}
/* the regions back where the drawing has them, by area */
function snapGroup(){
  const defs=DEFAULT_POINTS_RAW.filter(([,,,s])=>(s||'front')===V.side),by=new Map();
  D.points.filter(p=>!p.parent&&(p.side||'front')===V.side).forEach(q=>{const l=by.get(q.region);if(l)l.push(q);else by.set(q.region,[q])});
  by.forEach((list,r)=>{const d=defs.filter(([rr])=>rr===r).sort((a,b)=>a[1]-b[1]);if(!d.length)return;list.sort((a,b)=>a.x-b.x).forEach((q,i)=>{const dd=d[Math.min(i,d.length-1)];q.x=dd[1];q.y=dd[2]})});
  save();paintBody();
}
/* a photo of what is in view: the title, area and series are filled in; a body photo is labelled by the side shown */
function addBodyPhoto(){
  if(needVault())return;
  const region=V.region,parent=region?parentOf(region):null,back=V.side==='back';
  const pre=!region?{title:back?'Whole body, from behind':'Whole body',regions:['whole_body'],details:{series:'body'},photoLabel:back?'Back':'Front'}
    :{regions:parent?[parent,region]:[region],details:region==='face'?{series:'face'}:{}};
  openForm('photo',pre);
}

function entryRow(e){
  const c=D.concerns.find(c=>c.id===e.concern_id);
  const st=e.type==='appointment'?(e.details.status==='upcoming'?'<span class="pill up">Upcoming</span>':e.details.status==='cancelled'?'<span class="pill mut">Cancelled</span>':''):'';
  const src=e.source!=='manual'?`<span class="pill src">from ${esc(e.source)}</span>`:'';
  const sub=e.type==='appointment'?[kindLabel(e.details.kind),e.details.provider].filter(Boolean).join(' · '):TYPES[e.type].label;
  return `<button type="button" class="entry" data-entry="${e.id}">${ico(e.type)}
   <span style="min-width:0"><span class="t">${esc(e.title)}</span><span class="m"><span>${esc(sub)}</span>${e.regions.filter(r=>r!=='whole_body').map(r=>`<span>· ${esc(rl(r))}</span>`).join('')}${c?`<span class="pill">${esc(c.title)}</span>`:''}${e.photos.length?`<span>· ${e.photos.length} photo${e.photos.length>1?'s':''}</span>`:''}${(e.files||[]).length?`<span>· ${e.files.length} file${e.files.length>1?'s':''}</span>`:''}${e.details.cost?`<span>· ${money(e.details.cost)}</span>`:''}${st}${src}</span></span>
   <span class="d mono">${fmtShort(e.occurred_at)}${e.details.time?`<br>${tfmt(e.details.time)}`:''}</span></button>`;
}
/* History: everything by date, three ways. A list (newest first, with what is coming up above it), a month calendar (entries
   as dots under the date, what spans time as bars across the weeks below them, thinner the more there are, with a +N on a day
   that has more than fit), and a bar timeline (a row per thing with a bar per stint, a row of dots per kind of entry). On
   both, the stretch of a bar still to come is faded: planned, not done. The filters by type, body area and concern apply to
   all three and sit behind the filter button. */
const HIST_FILTERS=[['all','All'],['photo','Photos'],['appointment','Appointments'],['measurement','Measurements'],['procedure','Procedures'],['observation','Observations'],['food_trial','Food trials'],['lab','Reports'],['reg','Regimens & diet']];
const SPAN_KIND={concern:'Concern',ill:'Illness',course:'Course of care',reg:'Regimen',ch:'Challenge'};
function historyItems(){
  const items=D.entries.map(e=>({kind:'entry',d:e.occurred_at,e}));
  D.labs.forEach(l=>items.push({kind:'lab',d:l.date,l}));
  D.regimens.forEach(r=>stintsOf(r).forEach(p=>{items.push({kind:'reg',d:p.from,r,edge:'start'});if(p.to&&p.to<=TODAY)items.push({kind:'reg',d:p.to,r,edge:'end'})}));
  D.challenges.forEach(c=>items.push({kind:'ch',d:c.started_on,c}));
  return items.filter(it=>{
    if(V.type==='all')return !(it.kind==='entry'&&((it.e.type==='photo'&&it.e.details.series==='body')||it.e.type==='measurement'));
    if(V.type==='lab')return it.kind==='lab';if(V.type==='reg')return it.kind==='reg'||it.kind==='ch';
    return it.kind==='entry'&&it.e.type===V.type;
  }).filter(it=>{
    if(V.region){const regs=it.kind==='entry'?it.e.regions:it.kind==='reg'?it.r.regions:['whole_body'];if(!regs.includes(V.region))return false}
    if(V.concern){if(it.kind==='entry')return it.e.concern_id===V.concern;if(it.kind==='reg')return it.r.concern_id===V.concern;return false}
    return true;
  }).sort((a,b)=>a.d<b.d?1:-1);
}
/* what spans time, under the current filters, earliest first; stints (or an illness's episodes) share a row and a legend entry */
function spansOf(){
  if(V.type!=='all'&&V.type!=='reg')return [];
  const okR=regs=>!V.region||regs.includes(V.region),okC=cid=>!V.concern||cid===V.concern,out=[];
  D.concerns.forEach(c=>{if(!okR(c.regions)||!okC(c.id))return;
    if(isIllness(c)){const col=colorOf(illnessColor(c),'#E08A7E');episodesOf(c).forEach((e,i)=>out.push({id:'c'+c.id+':'+i,group:'c'+c.id,kind:'ill',title:c.title,sub:e.label||'',from:e.from,to:e.to,color:col,go:`data-concern="${c.id}"`}));return}
    if(c.started_on)out.push({id:'c'+c.id,group:'c'+c.id,kind:'concern',title:c.title,sub:c.status==='resolved'?'Resolved':'Active',from:c.started_on,to:c.resolved_on,color:'var(--t-observation)',go:`data-concern="${c.id}"`})});
  D.courses.forEach(k=>{const c=D.concerns.find(x=>x.id===k.concern_id);if(okR(c?c.regions:[])&&okC(k.concern_id))out.push({id:'k'+k.id,group:'k'+k.id,kind:'course',title:k.title,sub:[k.provider,k.cadence].filter(Boolean).join(' · '),from:k.started_on,to:k.ended_on,color:colorOf(k.color,'#4F5BF5'),go:`data-kview="${k.id}"`})});
  D.regimens.forEach(r=>{if(okR(r.regions)&&okC(r.concern_id))stintsOf(r).forEach((p,i)=>out.push({id:'r'+r.id+':'+i,group:'r'+r.id,kind:'reg',title:r.name,sub:[r.dose,r.frequency].filter(Boolean).join(' · '),from:p.from,to:p.to,color:colorOf(r.color,regColor({})),go:`data-regimen="${r.id}"`}))});
  if(!V.region&&!V.concern)D.challenges.forEach(c=>{const {from,to}=expRange(c);out.push({id:'x'+c.id,group:'x'+c.id,kind:'ch',title:c.title,sub:'Challenge',from,to,color:'var(--accent)',go:`data-exp="${c.id}"`})});
  return out.sort((a,b)=>a.from<b.from?-1:1);
}
const dotColor=it=>`var(--t-${it.kind==='lab'?'lab':it.kind==='entry'?it.e.type:'regimen'})`;
const isPoint=it=>it.kind==='entry'||it.kind==='lab';
function itemRow(it){
  if(it.kind==='entry')return entryRow(it.e);
  if(it.kind==='lab'){const l=it.l,fl=l.results.filter(r=>r.flag).length,lab=isLab(l);return `<button type="button" class="entry" data-lab="${l.id}">${ico(lab?'lab':'report')}<span style="min-width:0"><span class="t">${esc(lab?`Lab report, ${l.lab}`:reportTitle(l))}</span><span class="m"><span>${esc(lab?`${l.results.length} results${fl?` · ${fl} flagged by the lab`:''}`:[kindName(reportKind(l)),l.lab].filter(Boolean).join(' · '))}</span>${l.file?`<span class="pill src">File</span>`:''}</span></span><span class="d mono">${fmtShort(it.d)}</span></button>`}
  if(it.kind==='reg'){const t=it.r.category==='diet'?'diet':'regimen',st=stintsOf(it.r);return `<button type="button" class="entry" data-regimen="${it.r.id}">${ico(t)}<span style="min-width:0"><span class="t">${it.edge==='start'?'Started':'Stopped'}: ${esc(it.r.name)}</span><span class="m"><span>${esc(catLabel(it.r.category))}</span>${it.r.dose?`<span>· ${esc(it.r.dose)}</span>`:''}${it.edge==='start'&&!it.r.ended_on&&st[st.length-1].from===it.d?'<span class="pill up">Ongoing</span>':''}</span></span><span class="d mono">${fmtShort(it.d)}</span></button>`}
  if(it.kind==='ch')return `<button type="button" class="entry" data-exp="${it.c.id}">${ico('challenge')}<span style="min-width:0"><span class="t">${expKind(it.c)==='challenge'?'Challenge started':'Experiment'}: ${esc(it.c.title)}</span><span class="m"><span>${it.c.days?it.c.days+' days':EXP_LABEL[expKind(it.c)]}</span></span></span><span class="d mono">${fmtShort(it.d)}</span></button>`;
}
function histFilters(hint){
  return `<div class="filters" style="margin-bottom:8px">${HIST_FILTERS.map(([k,l])=>`<button type="button" class="chip${V.type===k?' on':''}" data-type="${k}">${l}</button>`).join('')}</div><div class="scope">${scopeChips()}</div>${hint&&V.type==='all'?'<p class="s" style="font-size:12px;color:var(--muted);margin:8px 0 0">All leaves out measurements and body progress photos, as there are so many. Pick their chip to see them.</p>':''}`;
}
function viewTimeline(){
  const view=V.histView||'list',items=historyItems(),spans=spansOf(),filtered=V.type!=='all'||!!V.region||!!V.concern;
  const sub=view==='list'?`${items.length} items`:view==='month'?'Entries as dots, what spans time as bars':'What spans time, and when things happened';
  // the list in two: what is still to come (dated after today, or an appointment booked for today), then the past
  const isUp=it=>it.d>TODAY||(it.kind==='entry'&&it.e.type==='appointment'&&it.e.details.status==='upcoming'&&it.d>=TODAY);
  const up=items.filter(isUp).sort((a,b)=>a.d<b.d?-1:1),past=items.filter(it=>!isUp(it));
  const body=view==='list'?comingUp(up)+listView(past,'Past'):view==='month'?monthView(items,spans):barsView(items,spans);
  return `<div class="page-h" style="margin-bottom:16px"><div><h1>History</h1><span class="sub">${sub}</span></div>
   <div style="display:flex;gap:8px;align-items:center"><div class="seg">${[['list','List'],['month','Month'],['bars','Timeline']].map(([v,l])=>`<button type="button" data-hview="${v}" class="${view===v?'on':''}">${l}</button>`).join('')}</div><button type="button" class="ibtn${V.histFilters||filtered?' on':''}" data-act="hist-filters" aria-label="${V.histFilters?'Hide filters':filtered?'Filters, some set':'Filters'}" title="Filters">${ICO_FILTER}</button></div></div>
   ${V.histFilters?`<section class="card" style="margin-bottom:16px">${histFilters(true)}</section>`:''}<div style="display:flex;flex-direction:column;gap:16px">${body}</div>`;
}
const ICO_FILTER='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>';
/* what is still to come under the current filters, and what the calendar found, above the past. Always there for
   appointments (it holds the button to book one); for other filters only when something is dated ahead */
function comingUp(up){
  const appts=V.type==='all'||V.type==='appointment';
  if(!appts&&!up.length)return '';
  return `<section class="card"><div class="card-h"><h2>Coming up <span class="sub">${up.length||''}</span></h2>${appts?'<button type="button" class="btn-accent btn-sm" data-act="add-upcoming">+ Appointment</button>':''}</div>${appts&&sugHTML()?`<div class="rgrid" style="margin-bottom:10px">${sugHTML()}</div>`:''}${up.map(itemRow).join('')||'<div class="empty">Nothing booked.</div>'}</section>`;
}
function listView(items,title){let html='',cur='';
  items.forEach(it=>{const d=pd(it.d),k=`${MONTHS[d.getMonth()]} ${d.getFullYear()}`;if(k!==cur){html+=`<div class="month">${k}</div>`;cur=k}html+=itemRow(it)});
  return `<section class="card">${title?`<div class="card-h"><h2>${title} <span class="sub">${items.length||''}</span></h2></div>`:''}${html||'<div class="empty">Nothing here yet.</div>'}</section>`;
}
// ----- month -----
const LANES=4,BAR_TOP=38,BAR_MAX=5,BAR_MIN=2,BAR_GAP=2,CELL=66;
function monthView(items,spans){
  if(!V.histMonth)V.histMonth=TODAY.slice(0,7);
  const [y,m]=V.histMonth.split('-').map(Number),first=new Date(y,m-1,1),dim=new Date(y,m,0).getDate(),dow=(first.getDay()+6)%7,rows=Math.ceil((dow+dim)/7);
  const start=addDays(iso(first),-dow),end=addDays(start,rows*7-1);
  const byDay=new Map();items.forEach(it=>{if(isPoint(it)){const a=byDay.get(it.d)||[];a.push(it);byDay.set(it.d,a)}});
  // lanes for the bars, the same across the weeks: a span takes the first lane free after the one before it ends; only the first LANES are drawn
  const laneEnd=[],laneOf=new Map();
  spans.filter(s=>s.from<=end&&(s.to||TODAY)>=start).forEach(s=>{let l=laneEnd.findIndex(e=>e<s.from);if(l<0){l=laneEnd.length;laneEnd.push('')}laneEnd[l]=s.to||TODAY;laneOf.set(s.id,l)});
  const lanes=Math.min(LANES,laneEnd.length),bar=Math.max(BAR_MIN,Math.min(BAR_MAX,(CELL-BAR_TOP-3-(lanes-1)*BAR_GAP)/Math.max(1,lanes)));
  const crossing=d=>spans.filter(s=>laneOf.has(s.id)&&s.from<=d&&(s.to||TODAY)>=d);
  const thisMonth=TODAY.slice(0,7)===V.histMonth;
  let grid='';
  for(let r=0;r<rows;r++){const d0=addDays(start,r*7),d6=addDays(d0,6),tc=TODAY<d0?-1:TODAY>d6?7:dayDiff(d0,TODAY);
    let cells='',bars='';
    for(let c=0;c<7;c++){const d=addDays(d0,c),inM=d.slice(0,7)===V.histMonth,its=byDay.get(d)||[],isT=d===TODAY,more=crossing(d).filter(s=>laneOf.get(s.id)>=LANES).length;
      cells+=`<button type="button" class="hday${inM?'':' out'}${isT?' today':''}" data-hday="${d}" aria-label="${fmt(d)}, ${its.length} items${more?`, ${more} more bars`:''}"><span class="n">${+d.slice(8)}</span><span class="dots">${its.slice(0,4).map(it=>`<i style="background:${dotColor(it)}"></i>`).join('')}</span>${more?`<span class="more">+${more}</span>`:''}</button>`}
    spans.filter(s=>laneOf.has(s.id)&&laneOf.get(s.id)<LANES&&s.from<=d6&&(s.to||TODAY)>=d0).forEach(s=>{
      const c0=s.from>d0?dayDiff(d0,s.from):0,c1=(s.to||TODAY)<d6?dayDiff(d0,s.to||TODAY):6,l=laneOf.get(s.id),starts=s.from>=d0,ends=!!s.to&&s.to<=d6;
      const piece=(a,b,rl,rr,fut)=>`<span class="hbar" ${s.go} title="${esc(s.title)}${s.sub?' · '+esc(s.sub):''}${fut?' (planned)':''}" style="top:${BAR_TOP+l*(bar+BAR_GAP)}px;left:${a/7*100}%;width:${(b-a+1)/7*100}%;height:${bar}px;background:${s.color};opacity:${fut?.3:.8};border-radius:${rl?bar/2:0}px ${rr?bar/2:0}px ${rr?bar/2:0}px ${rl?bar/2:0}px"></span>`;
      if(c1<=tc)bars+=piece(c0,c1,starts,ends,false);else if(c0>tc)bars+=piece(c0,c1,starts,ends,true);else bars+=piece(c0,tc,starts,false,false)+piece(tc+1,c1,false,ends,true)});
    grid+=`<div class="hweek" style="height:${CELL}px">${cells}${bars}</div>`}
  const legend=laneOf.size?`<div class="legend" style="justify-content:flex-start">${spans.filter((s,i,all)=>laneOf.has(s.id)&&all.findIndex(x=>x.group===s.group&&laneOf.has(x.id))===i).map(s=>`<button type="button" class="lg lgbtn" ${s.go}><i class="bx" style="background:${s.color};height:5px;border-radius:3px;opacity:${laneOf.get(s.id)<LANES?1:.4}"></i>${esc(s.title)}</button>`).join('')}</div>`:'';
  return `<section class="card hmonth"><div class="hnav"><button type="button" class="dots" data-hmonth="-1" aria-label="Previous month">‹</button><b>${MONTHS[m-1]} ${y}</b>${thisMonth?'':`<button type="button" class="chip" data-hmonth="0">Today</button>`}<button type="button" class="dots" data-hmonth="1" aria-label="Next month">›</button></div>
   <div class="cdw hdw">${['M','T','W','T','F','S','S'].map(x=>`<span>${x}</span>`).join('')}</div>${grid}${legend}</section>`;
}
function openDay(d){
  const items=historyItems().filter(it=>isPoint(it)&&it.d===d),spans=spansOf().filter(s=>s.from<=d&&(s.to||TODAY)>=d);
  openSheet(`<div class="sheet-h"><h3>${fmt(d)}</h3><button class="x" type="button" aria-label="Close">✕</button></div>
   <div class="list">${items.map(itemRow).join('')}${spans.map(s=>`<button type="button" class="row" ${s.go}><span style="display:flex;gap:10px;align-items:center;min-width:0"><i class="dot" style="background:${s.color};width:10px;height:10px"></i><span><span class="t">${esc(s.title)}</span><br><span class="s">${SPAN_KIND[s.kind]}${s.sub?' · '+esc(s.sub):''}</span></span></span></button>`).join('')||'<div class="empty">Nothing on this day.</div>'}</div>
   <div class="form-acts" style="margin-top:14px;justify-content:flex-start"><button type="button" class="btn-accent btn-sm" id="dayAppt">+ Appointment</button><button type="button" class="btn-ghost btn-sm" id="dayObs">+ Observation</button></div>`);
  $('#dayAppt').addEventListener('click',()=>openForm('appointment',{occurred_at:d,details:{status:d>TODAY?'upcoming':'done'}}));
  $('#dayObs').addEventListener('click',()=>openForm('observation',{occurred_at:d}));
  $('#overlay').querySelector('.sheet').addEventListener('click',ev=>{const t=ev.target;const en=t.closest('[data-entry]'),lab=t.closest('[data-lab]'),rg=t.closest('[data-regimen]'),cn=t.closest('[data-concern]'),kv=t.closest('[data-kview]'),ex=t.closest('[data-exp]');
    if(en)openEntry(en.dataset.entry);else if(lab)openLab(lab.dataset.lab);else if(rg){const r=D.regimens.find(x=>x.id===rg.dataset.regimen);r&&openRegimen(r)}else if(cn)openConcern(cn.dataset.concern);else if(kv)openCourseSessions(kv.dataset.kview);else if(ex)openExperiment(ex.dataset.exp)});
}
// ----- bars -----
const PX=5,LBL=170,RH=32,HDR=26;
function barsView(items,spans){
  const pts=items.filter(isPoint),byType=new Map();
  pts.forEach(it=>{const k=it.kind==='lab'?'lab':it.e.type;const a=byType.get(k)||[];a.push(it);byType.set(k,a)});
  if(!spans.length&&!pts.length)return '<section class="card"><div class="empty">Nothing here yet.</div></section>';
  const ds=[TODAY,...spans.map(s=>s.from),...spans.map(s=>s.to||TODAY),...pts.map(it=>it.d)].sort();
  const from=addDays(ds[0],-10),to=addDays(ds[ds.length-1]>addDays(TODAY,30)?ds[ds.length-1]:addDays(TODAY,30),10);
  const X=d=>dayDiff(from,d)*PX,W=X(to);
  const months=[];for(let d=new Date(+from.slice(0,4),+from.slice(5,7),1);iso(d)<=to;d.setMonth(d.getMonth()+1))months.push({d:iso(d),l:`${MONTHS[d.getMonth()]}${d.getMonth()===0?' '+d.getFullYear():''}`});
  const groups=new Map();spans.forEach(s=>groups.set(s.group,[...(groups.get(s.group)||[]),s]));
  const TL=Object.fromEntries(HIST_FILTERS);
  const rows=[...['concern','ill','course','reg','ch'].flatMap(kind=>[...groups.values()].filter(ss=>ss[0].kind===kind).map(ss=>({k:'span',s:ss[0],ss}))),...[...byType.entries()].map(([type,its])=>({k:'pts',type,its}))];
  const H=HDR+rows.length*RH;
  const titles=rows.map(r=>`<${r.k==='span'?`button type="button" ${r.s.go}`:'div'} class="htitle" title="${esc(r.k==='span'?`${r.s.title} · ${SPAN_KIND[r.s.kind]}${r.s.sub?' · '+r.s.sub:''}`:TL[r.type]||r.type)}"><span class="t">${esc(r.k==='span'?r.s.title:TL[r.type]||r.type)}</span><span class="s">${esc(r.k==='span'?SPAN_KIND[r.s.kind]:String(r.its.length))}</span></${r.k==='span'?'button':'div'}>`).join('');
  const body=rows.map((r,i)=>`<div class="hrow" style="top:${HDR+i*RH}px;height:${RH}px">${r.k==='span'?r.ss.map(s=>{
      // the stretch still to come is faded; today's column counts as done
      const end=s.to||TODAY,x0=X(s.from),x2=X(end)+PX,xt=X(TODAY)+PX;
      const piece=(a,b,rl,rr,fut)=>`<button type="button" class="hspan" ${s.go} title="${esc(s.title)}${s.sub?' · '+esc(s.sub):''}${fut?' (planned)':''}" style="left:${a}px;width:${Math.max(fut?4:8,b-a)}px;background:${s.color};opacity:${fut?.3:.85};border-radius:${rl?9:0}px ${rr?(s.to?9:2):0}px ${rr?(s.to?9:2):0}px ${rl?9:0}px"></button>`;
      if(s.from>TODAY)return piece(x0,x2,true,true,true);if(!s.to||s.to<=TODAY)return piece(x0,x2,true,true,false);return piece(x0,xt,true,false,false)+piece(xt,x2,false,true,true)}).join('')
    :r.its.map(it=>`<button type="button" class="hdot" ${it.kind==='lab'?`data-lab="${it.l.id}"`:`data-entry="${it.e.id}"`} style="left:${X(it.d)-5}px;background:${dotColor(it)}" title="${esc(it.kind==='entry'?it.e.title:reportTitle(it.l))} · ${fmt(it.d)}"></button>`).join('')}</div>`).join('');
  return `<section class="card hbars"><div class="hbwrap"><div class="htitles" style="width:${LBL}px"><div style="height:${HDR}px"></div>${titles}</div>
   <div class="hscroll" id="hscroll" data-today="${Math.max(0,X(TODAY)-180)}"><div class="hplot" style="width:${W}px;height:${H}px">${months.map(mo=>`<div class="hmo" style="left:${X(mo.d)}px"><span>${mo.l}</span></div>`).join('')}<div class="hnow" style="left:${X(TODAY)}px"></div>${body}</div></div></div></section>`;
}
/* built charts */
const trunc=(s,n)=>s.length>n?s.slice(0,Math.max(1,Math.floor(n)-1))+'…':s;
const PALETTES=[
  ['Periwinkle',['#4F5BF5','#7480F7','#9EA6FA','#C6CBFC']],
  ['Sage',['#4F8A62','#78AA87','#A6C9AF','#D0E3D4']],
  ['Citrus',['var(--accent)','#B5DA4C','#D3EB8E','#EAF6C9']],
  ['Clay',['#C2693F','#D8916B','#E9B89B','#F5DCCD']],
  ['Plum',['#8556B5','#A684CE','#C7B0E3','#E5DAF2']],
  ['Ocean',['#1F7A8C','#4B9DAD','#86C1CC','#C3E1E6']],
  ['Graphite',['#2E333B','#5B6470','#8E97A3','#C4CAD2']]
];
const ACCENT_TOKEN='var(--accent)';
const ALL_COLORS=PALETTES.flatMap(p=>p[1]);
const DEFAULT_Y1='#4F5BF5',DEFAULT_Y2='#C2693F';
const LAYOUTS=[['stack','One column'],['two','Two columns'],['three','Three columns'],['top','One large, two columns below'],['side','Wide column, narrow column']];
const LAYOUT_DEF={stack:{top:false,cols:['1fr']},two:{top:false,cols:['1fr','1fr']},three:{top:false,cols:['1fr','1fr','1fr']},top:{top:true,cols:['1fr','1fr']},side:{top:false,cols:['2fr','1fr']}};
const zoneCount=k=>LAYOUT_DEF[k].cols.length+(LAYOUT_DEF[k].top?1:0);
const STYLES=[['line','Line'],['area','Area'],['column','Column'],['dots','Dots']];
const unitLabel=u=>u&&u.startsWith('/')?(u==='/10'?'rating 0–10':'rating 1–5'):u;
const regColor=r=>r.color||'#9EA6FA';
/* what a band id points at: a regimen, a course of care ("k:"), or an illness ("i:", a part per episode) */
const bandSrc=id=>{
  if(id.startsWith('i:')){const c=D.concerns.find(x=>x.id===id.slice(2));return c?{name:c.title,started_on:c.started_on||TODAY,ended_on:c.resolved_on,color:illnessColor(c),episodes:episodesOf(c)}:null}
  if(id.startsWith('k:')){const k=D.courses.find(x=>x.id===id.slice(2));return k?{name:k.title,started_on:k.started_on,ended_on:k.ended_on,color:k.color||'#86C1CC'}:null}
  const r=D.regimens.find(x=>x.id===id);return r?{name:r.name,started_on:r.started_on,ended_on:r.ended_on,color:r.color,regimen:r}:null};
function layoutIcon(k){const r=(x,y,w,h)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5"/>`;const m={stack:r(2,2,20,6)+r(2,10,20,6)+r(2,18,20,4),two:r(2,2,9,9)+r(13,2,9,9)+r(2,13,9,9)+r(13,13,9,9),three:r(2,2,5.5,9)+r(9.25,2,5.5,9)+r(16.5,2,5.5,9)+r(2,13,5.5,9)+r(9.25,13,5.5,9)+r(16.5,13,5.5,9),top:r(2,2,20,9)+r(2,13,9,9)+r(13,13,9,9),side:r(2,2,13,20)+r(17,2,5,9)+r(17,13,5,9)};return `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">${m[k]}</svg>`}
function paletteMenu(target,current){
  return `<div class="cmenu pal" role="menu" hidden>${PALETTES.map(([n,cs])=>`<div class="palrow"><span>${n}</span><div>${cs.map(col=>`<button type="button" class="sw${col===current?' on':''}" style="background:${col}" data-pick-color="${target}|${col}" aria-label="${n} ${col}"></button>`).join('')}</div></div>`).join('')}<div class="palrow hexrow"><span>Custom</span><div style="align-items:center"><input type="color" value="${current}" data-hexcolor="${target}" aria-label="Pick any colour"><input class="inp" value="${current}" maxlength="7" data-hextext aria-label="Hex colour"><button type="button" class="btn-dark btn-sm" data-hexapply="${target}">Use</button></div></div></div>`;
}
/* layout zones: which chart sits in which column */
function normalizeZones(){
  const n=zoneCount(D.chartLayout);
  if(!Array.isArray(D.chartZones)||D.chartZones.length!==n)return distributeZones(D.chartZones?D.chartZones.flat():D.charts.map(c=>c.id));
  const ids=new Set(D.charts.map(c=>c.id)),seen=new Set();
  D.chartZones=D.chartZones.map(z=>z.filter(id=>ids.has(id)&&!seen.has(id)&&seen.add(id)));
  D.charts.forEach(c=>{if(!seen.has(c.id)){const z=D.chartZones.reduce((bi,z,i,a)=>z.length<a[bi].length?i:bi,0);D.chartZones[z].push(c.id)}});
}
function distributeZones(order){
  const def=LAYOUT_DEF[D.chartLayout],n=zoneCount(D.chartLayout),ids=new Set(D.charts.map(c=>c.id));
  const list=[...new Set([...(order||[]).filter(id=>ids.has(id)),...D.charts.map(c=>c.id)])];
  D.chartZones=Array.from({length:n},()=>[]);
  list.forEach((id,i)=>{if(def.top){if(i===0)D.chartZones[0].push(id);else D.chartZones[1+((i-1)%def.cols.length)].push(id)}else D.chartZones[i%n].push(id)});
}
function chartRange(c){
  if(c.range==='custom'&&c.from&&c.to&&c.from<c.to)return [c.from,c.to];
  if(c.range==='all'){
    const ds=[];[c.y1,c.y2,...(c.y1More||[]),...(c.y2More||[])].forEach(id=>{const s=id&&getSeries(id);s&&s.points&&s.points.forEach(p=>ds.push(p.d))});
    c.bands.forEach(id=>{const r=bandSrc(id);r&&ds.push(r.started_on)});
    c.photos.forEach(rg=>D.entries.forEach(e=>{if(e.photos.length&&e.regions.includes(rg))ds.push(e.occurred_at)}));
    ds.sort();return [ds[0]&&ds[0]<TODAY?addDays(ds[0],-10):addDays(TODAY,-365),TODAY];
  }
  return [addDays(TODAY,-({'3m':91,'6m':182,'12m':365}[c.range]||365)),TODAY];
}
const swatchFor=(type,col)=>type==='column'?`<i class="bx" style="background:${col}"></i>`:`<i class="ln" style="border-color:${col}"></i>`;
/* a stored colour, validated: a hex or the accent token; anything else falls back */
const colorOf=(c,fb)=>isHex(c)||c===ACCENT_TOKEN?c:fb;
/* the colour of the i-th extra line on an axis: spread through the palette, away from the axis colours */
function extraColor(i,avoid){const pool=ALL_COLORS.filter(c=>!avoid.includes(c));return pool[(i*3)%pool.length]||ALL_COLORS[0]}
/* a fixed y range when both ends are numbers and in order */
const fixedRange=r=>r&&typeof r[0]==='number'&&typeof r[1]==='number'&&r[0]<r[1]?[r[0],r[1]]:null;
/* how many days of the range show at once when the chart scrolls */
const windowDays=(to,months)=>{const d=pd(to);d.setMonth(d.getMonth()-months);return Math.max(28,dayDiff(iso(d),to))};
const lineSeries=id=>{const s=id&&getSeries(id);return s&&s.kind==='line'?s:null};
const extraLines=ids=>(ids||[]).map(lineSeries).filter(Boolean);
function chartLegend(c){
  const it=[];const s1=lineSeries(c.y1),s2=lineSeries(c.y2),[from,to]=chartRange(c);
  // a count per month shows its total over the range instead of a unit
  const em=s=>s.monthly?`${s.points.filter(p=>p.d>=from&&p.d<=to).reduce((a,p)=>a+p.v,0)} ${s.unit} in range`:s.unit?unitLabel(s.unit):'';
  const swt=(s,type,col)=>swatchFor(s.monthly?'column':type,col);
  const col1=colorOf(c.y1Color,DEFAULT_Y1),col2=colorOf(c.y2Color,DEFAULT_Y2),avoid=[col1,col2],n1=(c.y1More||[]).length;
  if(s1)it.push(`<span class="lg">${swt(s1,c.y1Type,col1)}${esc(s1.label)}${em(s1)?` <em>${esc(em(s1))}</em>`:''}</span>`);
  if(s2)it.push(`<span class="lg">${swt(s2,c.y2Type,col2)}${esc(s2.label)} <em>${esc(em(s2)?em(s2)+' · ':'')}right</em></span>`);
  (c.y1More||[]).forEach((id,i)=>{const s=lineSeries(id);if(s)it.push(`<span class="lg">${swt(s,'line',extraColor(i,avoid))}${esc(s.label)}${em(s)?` <em>${esc(em(s))}</em>`:''}</span>`)});
  (c.y2More||[]).forEach((id,i)=>{const s=lineSeries(id);if(s)it.push(`<span class="lg">${swt(s,'line',extraColor(n1+i,avoid))}${esc(s.label)} <em>${esc(em(s)?em(s)+' · ':'')}right</em></span>`)});
  c.bands.forEach(id=>{const r=bandSrc(id);if(r)it.push(`<span class="lg"><i class="bx soft" style="background:${colorOf(r.color,regColor({}))}"></i>${esc(r.name)}</span>`)});
  (c.sessions||[]).forEach(id=>{const k=D.courses.find(x=>x.id===id);if(k)it.push(`<span class="lg"><i class="bx" style="background:var(--ink);border-radius:50%;width:8px;height:8px"></i>${esc(k.title)} instances</span>`)});
  if(c.bands.includes('cycle'))it.push(`<span class="lg"><i class="bx soft" style="background:#E05A7E"></i>Periods</span>`);
  if((c.markers||[]).length)it.push(`<span class="lg"><i class="ln" style="border-top-style:dashed;border-color:var(--muted)"></i>${esc(c.markers.map(k=>(MARKERS.find(m=>m[0]===k)||[,k])[1]).join(', '))}</span>`);
  c.photos.forEach(rg=>it.push(`<span class="lg"><i class="bx" style="background:var(--t-photo);border-radius:50%"></i>${esc(rl(rg))} photos</span>`));
  if(c.scroll)it.push(`<span class="lg"><em>⇆ scroll back in time · hover to read</em></span>`);
  return it.join('');
}
function smoothPath(p){
  if(p.length<3)return p.map((q,i)=>(i?'L':'M')+q[0].toFixed(1)+' '+q[1].toFixed(1)).join(' ');
  const n=p.length,dx=[],m=[],t=[];
  for(let i=0;i<n-1;i++){dx[i]=p[i+1][0]-p[i][0];m[i]=dx[i]?(p[i+1][1]-p[i][1])/dx[i]:0}
  t[0]=m[0];t[n-1]=m[n-2];for(let i=1;i<n-1;i++)t[i]=m[i-1]*m[i]<=0?0:(m[i-1]+m[i])/2;
  for(let i=0;i<n-1;i++){if(m[i]===0){t[i]=0;t[i+1]=0;continue}const a=t[i]/m[i],b=t[i+1]/m[i],h=a*a+b*b;if(h>9){const s=3/Math.sqrt(h);t[i]=s*a*m[i];t[i+1]=s*b*m[i]}}
  let d=`M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`;
  for(let i=0;i<n-1;i++){const h=dx[i]/3;d+=` C${(p[i][0]+h).toFixed(1)} ${(p[i][1]+t[i]*h).toFixed(1)} ${(p[i+1][0]-h).toFixed(1)} ${(p[i+1][1]-t[i+1]*h).toFixed(1)} ${p[i+1][0].toFixed(1)} ${p[i+1][1].toFixed(1)}`}
  return d;
}
/* Values over time, the same maths as the phone: up to two axes (line / area / column / dots, 7-day average; a count per
   month as a column over the month, stacked with the other counts on its axis), more lines sharing an axis's scale, period
   bands in lanes (a part per stint, an illness's episodes), entry markers, photo and instance markers along the bottom, a
   readout on hover. The axis columns stay fixed and the plot sits in a sideways scroller: when the chart scrolls, the range
   is how far back the data goes and the window how much shows at once, and the plot opens at today. A fixed y range clips
   the series to it. No trend lines between layers, no statistics. */
function drawChart(box,c,opts={}){
  const W=Math.max(240,Math.floor(box.clientWidth||400));
  const H=opts.h||Math.round(Math.min(420,Math.max(210,W*0.42)));
  const L1=lineSeries(c.y1),L2=lineSeries(c.y2),X1=extraLines(c.y1More),X2=extraLines(c.y2More),sessions=c.sessions||[];
  if(!L1&&!L2&&!c.bands.length&&!c.photos.length&&!sessions.length){box.innerHTML='<div class="empty">Pick something to chart.</div>';return}
  const [from,to]=chartRange(c),a=pd(from).getTime(),b=pd(to).getTime();
  const PS=c.photos.length||sessions.length?22:0,T=8,AX=22,ph=H-T-AX-PS;
  const col1=colorOf(c.y1Color,DEFAULT_Y1),col2=colorOf(c.y2Color,DEFAULT_Y2),gid='g'+c.id.replace(/\W/g,'');
  // periods: soft blocks, overlapping ones split into lanes
  const segs=c.bands.flatMap(id=>{if(id==='cycle')return cyclePeriods().map(p=>{const f=p.start>from?p.start:from,t=p.end<to?p.end:to;return f<=t?{f,t,label:'Period',col:'#E05A7E',rid:null}:null}).filter(Boolean);
    const r=bandSrc(id);if(!r)return [];
    const parts=r.regimen?regParts(r.regimen):r.episodes?r.episodes.map(e=>({from:e.from,to:e.to||TODAY,label:e.label||r.name})):[{from:r.started_on,to:r.ended_on||TODAY,label:r.name}];
    return parts.map(pt=>{const f=pt.from>from?pt.from:from,t=pt.to<to?pt.to:to;return f<=t?{f,t,label:pt.label,col:colorOf(r.color,regColor({})),rid:r.regimen?id:null}:null}).filter(Boolean)}).sort((p,q)=>p.f<q.f?-1:1);
  const lanes=[];segs.forEach(s=>{let k=lanes.findIndex(end=>end<s.f);if(k<0){k=lanes.length;lanes.push(s.t)}else lanes[k]=s.t;s.lane=k});
  const lh=ph/Math.max(1,lanes.length);
  const inRange=s=>s.points.filter(p=>p.d>=from&&p.d<=to);
  const stackOf=(s,extra)=>[...(s&&s.monthly?[s]:[]),...extra.filter(e=>e.monthly)];
  const scale=(s,type,extra=[],fixed=null)=>{const pts=inRange(s);let all=[...pts,...extra.flatMap(inRange)];const stack=stackOf(s,extra);
    if(stack.length>1){const sums={};stack.forEach(m=>inRange(m).forEach(p=>{sums[p.d]=(sums[p.d]||0)+p.v}));all=[...all,...Object.entries(sums).map(([d,v])=>({d,v}))]}
    if(!all.length)return null;
    const isTime=s.mkind==='time'||s.mkind==='time_night'||s.mkind==='duration';
    if(fixed){const [lo,hi]=fixed,st=isTime?(hi-lo>240?60:30):Math.max(niceStep(hi-lo,4),s.step||0);return {pts,lo,hi,st,y:v=>T+(1-(v-lo)/(hi-lo))*ph,monthly:s.monthly}}
    let lo=Math.min(...all.map(p=>p.v)),hi=Math.max(...all.map(p=>p.v));const rs=s.scale||{lo:1,hi:5};
    if(type==='column'||s.monthly){lo=0;if(s.rating)hi=Math.max(hi,rs.hi)}else if(s.rating){lo=Math.min(lo,rs.lo);hi=Math.max(hi,rs.hi)}
    else{// room above and below: a tenth of the range, at least two steps, and a tenth of the value when there is no range at all
      const range=hi-lo,pad=Math.max(range*0.1,(s.step||0)*2,range<1e-9?Math.max(Math.abs(hi)*0.1,0.5):0);lo-=pad;hi+=pad}
    const st=isTime?(hi-lo>240?60:30):Math.max(niceStep(Math.max(hi-lo,s.rating?rs.hi-rs.lo:0.5),4),s.step||0);
    lo=Math.floor(lo/st)*st;hi=Math.ceil(hi/st)*st;if(hi===lo)hi=lo+st;return {pts,lo,hi,st,y:v=>T+(1-(v-lo)/(hi-lo))*ph,monthly:s.monthly}};
  const A1=L1&&scale(L1,c.y1Type,X1,fixedRange(c.y1Range)),A2=L2&&scale(L2,c.y2Type,X2,fixedRange(c.y2Range)),G0=A1||A2;
  const onAxis=(A,s)=>({...A,pts:inRange(s),monthly:s.monthly});
  const xcol=i=>extraColor(i,[col1,col2]);
  // axis labels: the whole number (63.5, not a clipped ".5"); the unit is in the legend. Times keep their own format
  const fmtAx=(s,v)=>(s.mkind==='time'||s.mkind==='time_night'||s.mkind==='duration')&&s.fmt?s.fmt(v):String(+v.toFixed(2));
  const axW=(s,A)=>{let n=0;for(let v=A.lo;v<=A.hi+1e-9;v+=A.st)n=Math.max(n,fmtAx(s,v).length);return Math.max(40,Math.round(n*6.6+14))};
  const L=A1?axW(L1,A1):10,R=A2?axW(L2,A2):10,pw=Math.max(1,W-L-R);
  // the plot: as wide as the scroller when the chart fits, wider when it scrolls
  const totalDays=Math.max(1,dayDiff(from,to)),visDays=c.scroll?Math.min(totalDays,windowDays(to,c.window||3)):totalDays;
  const PW=Math.max(pw,Math.round(pw*totalDays/visDays)),scrolls=PW>pw+1;
  const x=d=>(pd(d).getTime()-a)/(b-a)*PW;
  const both=!!(A1&&A2&&c.y1Type==='column'&&c.y2Type==='column');
  const colW=A=>{const xs=A.pts.map(p=>x(p.d)).sort((p,q)=>p-q);let gap=PW;for(let i=1;i<xs.length;i++)gap=Math.min(gap,xs[i]-xs[i-1]);return Math.max(4,Math.min(28,gap*(both?0.36:0.56)))};
  const roll=pts=>pts.map(p=>{const f=addDays(p.d,-6),win=pts.filter(q=>q.d>=f&&q.d<=p.d);return {d:p.d,v:avg(win.map(q=>q.v)),flag:p.flag}});
  let plot='',series='',left='',right='';
  segs.forEach(s=>{const x1=x(s.f),x2=Math.max(x1+3,x(s.t)),y=T+s.lane*lh+2;
    plot+=`<rect x="${x1}" y="${y}" width="${x2-x1}" height="${Math.max(1,lh-4)}" rx="8" fill="${s.col}" fill-opacity=".2"/>`;
    if(s.rid)logsOf(s.rid,s.f,s.t).forEach(l=>{plot+=`<rect x="${x(l.on_date)-1}" y="${y+lh-13}" width="2.2" height="7" rx="1.1" fill="${s.col}"/>`});
    if(x2-x1>50&&lh>20)plot+=`<text class="bl" x="${x1+9}" y="${y+15}">${esc(trunc(s.label,(x2-x1-16)/6))}</text>`});
  if(G0&&c.grid)for(let v=G0.lo;v<=G0.hi+1e-9;v+=G0.st)plot+=`<line x1="0" x2="${PW}" y1="${G0.y(v)}" y2="${G0.y(v)}" class="gl"/>`;
  if(A1)for(let v=A1.lo;v<=A1.hi+1e-9;v+=A1.st)left+=`<text x="${L-8}" y="${A1.y(v)+3.5}" text-anchor="end">${esc(fmtAx(L1,v))}</text>`;
  if(A2)for(let v=A2.lo;v<=A2.hi+1e-9;v+=A2.st)right+=`<text x="8" y="${A2.y(v)+3.5}">${esc(fmtAx(L2,v))}</text>`;
  const drawCols=(A,col,shift)=>{const bw=colW(A),r=Math.min(7,bw/2),base=A.y(A.lo);
    A.pts.forEach(p=>{const cx=x(p.d)+shift*bw*0.55,y=A.y(p.v),h=Math.max(0,base-y),x0=cx-bw/2;
      series+=h>r?`<path d="M${x0} ${base}V${y+r}Q${x0} ${y} ${x0+r} ${y}H${x0+bw-r}Q${x0+bw} ${y} ${x0+bw} ${y+r}V${base}Z" fill="${col}"/>`:`<rect x="${x0}" y="${y}" width="${bw}" height="${h}" fill="${col}"/>`;
      if(A.pts.length<=14&&bw>=14)series+=`<text x="${cx}" y="${y-6}" text-anchor="middle" class="vl">${+(+p.v).toFixed(1)}</text>`;
      if(p.flag)series+=`<text x="${cx}" y="${y-(A.pts.length<=14&&bw>=14?18:6)}" text-anchor="middle" class="vl" style="fill:${col}">${esc(p.flag)}</text>`})};
  // counts per month as columns over their month, stacked in order; the total sits on top
  const drawMonthly=(A,stack)=>{const months=[...new Set(stack.flatMap(s=>s.pts.map(p=>p.d)))].sort();
    months.forEach(d=>{const n=pd(d),x0=Math.max(0,x(d)),x1=Math.min(PW,x(iso(new Date(n.getFullYear(),n.getMonth()+1,1)))),w=x1-x0,bw=Math.max(3,w*0.72),cx=(x0+x1)/2;let acc=0;
      stack.forEach((s,si)=>{const p=s.pts.find(q=>q.d===d);if(!p||!p.v)return;const y1=A.y(acc+p.v),y0=A.y(acc),hh=Math.max(1,y0-y1),last=!stack.slice(si+1).some(o=>(o.pts.find(q=>q.d===d)||{v:0}).v);
        series+=`<rect x="${cx-bw/2}" y="${y1}" width="${bw}" height="${hh}" fill="${s.col}" rx="${last?Math.min(3,bw/3):0}"/>`;acc+=p.v});
      if(acc&&w>=22)series+=`<text x="${cx}" y="${A.y(acc)-5}" text-anchor="middle" class="vl">${acc}</text>`})};
  const drawLine=(A,col,type,g,av)=>{const src=av?roll(A.pts):A.pts;const xy=src.map(p=>[x(p.d),A.y(p.v)]);if(!xy.length)return;
    if(type==='dots'){// a scatter: each reading on its own, no line between them
      xy.forEach((p,j)=>{series+=`<circle cx="${p[0]}" cy="${p[1]}" r="3.6" fill="${col}" stroke="var(--card)" stroke-width="1.2"/>`;const f=A.pts[j]&&A.pts[j].flag;if(f)series+=`<text x="${p[0]}" y="${p[1]-9}" text-anchor="middle" class="vl" style="fill:${col}">${esc(f)}</text>`});return}
    const d=smoothPath(xy);
    if(av)series+=A.pts.map(p=>`<circle cx="${x(p.d)}" cy="${A.y(p.v)}" r="2.2" fill="${col}" fill-opacity=".28"/>`).join('');
    if(type==='area'&&xy.length>1)series+=`<path d="${d} L${xy[xy.length-1][0].toFixed(1)} ${T+ph} L${xy[0][0].toFixed(1)} ${T+ph} Z" fill="url(#${g})"/>`;
    if(xy.length>1)series+=`<path d="${d}" fill="none" stroke="${col}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
    if(!av&&xy.length<=26*Math.max(1,PW/pw))series+=xy.slice(0,-1).map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="2.6" fill="var(--card)" stroke="${col}" stroke-width="1.5"/>`).join('');
    const l=xy[xy.length-1];series+=`<circle cx="${l[0]}" cy="${l[1]}" r="5" fill="${col}" stroke="var(--card)" stroke-width="2"/>`;
    A.pts.forEach((p,j)=>{if(p.flag&&!av)series+=`<text x="${xy[j][0]}" y="${xy[j][1]-9}" text-anchor="middle" class="vl" style="fill:${col}">${esc(p.flag)}</text>`})};
  // an axis's counts per month stack as columns over their month, whatever style is picked; the rest draw as set
  const monthlyStack=(A,main,mainCol,extra,off)=>[...(main&&main.monthly?[{pts:inRange(main),col:mainCol}]:[]),...extra.map((s,i)=>({s,i})).filter(({s})=>s.monthly).map(({s,i})=>({pts:inRange(s),col:xcol(off+i)}))];
  if(A1){const st=monthlyStack(A1,L1,col1,X1,0);if(st.length)drawMonthly(A1,st)}
  if(A2){const st=monthlyStack(A2,L2,col2,X2,X1.length);if(st.length)drawMonthly(A2,st)}
  if(A1&&!L1.monthly&&c.y1Type==='column')drawCols(A1,col1,both?-1:0);
  if(A2&&!L2.monthly&&c.y2Type==='column')drawCols(A2,col2,both?1:0);
  if(A2&&!L2.monthly&&c.y2Type!=='column')drawLine(A2,col2,c.y2Type||'line',gid+'b',c.y2Avg);
  if(A1&&!L1.monthly&&c.y1Type!=='column')drawLine(A1,col1,c.y1Type||'line',gid+'a',c.y1Avg);
  if(A1)X1.forEach((s,i)=>{if(s.monthly)return;const A=onAxis(A1,s);if(A.pts.length)drawLine(A,xcol(i),'line',gid+'x')});
  if(A2)X2.forEach((s,i)=>{if(s.monthly)return;const A=onAxis(A2,s);if(A.pts.length)drawLine(A,xcol(X1.length+i),'line',gid+'x')});
  // the axis lines: the baseline across the plot, the left and right axes on their columns
  if(c.axes!==false&&G0){plot+=`<line x1="0" x2="${PW}" y1="${T+ph}" y2="${T+ph}" class="axl"/>`;if(A1)left+=`<line x1="${L-0.5}" x2="${L-0.5}" y1="${T}" y2="${T+ph}" class="axl"/>`;if(A2)right+=`<line x1="0.5" x2="0.5" y1="${T}" y2="${T+ph}" class="axl"/>`}
  const missing=[L1&&!A1?L1.label:null,L2&&!A2?L2.label:null].filter(Boolean);
  if(missing.length)plot+=`<text x="${Math.max(0,PW-pw)+8}" y="${T+ph-8}">No ${esc(missing.join(' or ').toLowerCase())} values in this range</text>`;
  // event markers: dashed lines on the day something happened
  const evs=(c.markers||[]).length?D.entries.filter(e=>c.markers.includes(e.type)&&e.occurred_at>=from&&e.occurred_at<=to):[];
  evs.forEach(e=>{const xx=x(e.occurred_at);plot+=`<line x1="${xx}" x2="${xx}" y1="${T}" y2="${T+ph}" stroke="var(--ink)" stroke-opacity=".38" stroke-dasharray="3 3"/><circle cx="${xx}" cy="${T+2}" r="2.5" fill="var(--ink)" fill-opacity=".5"/>`});
  // month labels: thinned by how many days a pixel-width of the plot holds
  const days=(b-a)/864e5,perPx=days/PW,step=perPx>2.2?6:perPx>1.15?3:perPx>0.55?2:1,s0=pd(from);let mi=0;
  for(let d=new Date(s0.getFullYear(),s0.getMonth()+1,1);d.getTime()<=b;d=new Date(d.getFullYear(),d.getMonth()+1,1),mi++){
    if(mi%step)continue;plot+=`<text x="${x(iso(d))}" y="${H-5}" text-anchor="middle">${MONTHS[d.getMonth()]}${d.getMonth()===0||mi===0?` ${String(d.getFullYear()).slice(2)}`:''}</text>`}
  // photo and instance markers with hover preview
  let marks='';c.photos.forEach(rg=>D.entries.filter(e=>e.photos.length&&e.regions.includes(rg)&&e.details.series!=='body'&&e.occurred_at>=from&&e.occurred_at<=to).forEach(e=>{
    marks+=`<button type="button" class="phm" data-entry="${e.id}" style="left:${x(e.occurred_at)}px;top:${T+ph+6}px" aria-label="${esc(e.title)}, ${fmt(e.occurred_at)}"><span class="phprev"><span class="pv">${photoHTML(e.photos[0],e.title,e.occurred_at)}</span><b>${esc(e.title)}</b><span>${fmt(e.occurred_at)}</span></span></button>`}));
  sessions.forEach(kid=>appts().filter(e=>e.details.course_id===kid&&e.details.status==='done'&&e.occurred_at>=from&&e.occurred_at<=to).forEach(e=>{const r=readingFor(e.id),M=r&&metric(r.details.metric);
    marks+=`<button type="button" class="phm sess-m" data-entry="${e.id}" style="left:${x(e.occurred_at)}px;top:${T+ph+9}px" aria-label="${esc(e.title)}, ${fmt(e.occurred_at)}"><span class="phprev txt"><b>${esc(e.title)}</b><span>${fmt(e.occurred_at)}</span>${e.details.what_was_done?`<i>${esc(e.details.what_was_done)}</i>`:''}${r?`<i>${esc(M.l)}: ${fmtV(r.details.value,M.u)}</i>`:''}${e.details.cost?`<i>${money(e.details.cost)}</i>`:''}</span></button>`}));
  const defs=`<linearGradient id="${gid}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col1}" stop-opacity=".28"/><stop offset="1" stop-color="${col1}" stop-opacity="0"/></linearGradient><linearGradient id="${gid}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col2}" stop-opacity=".28"/><stop offset="1" stop-color="${col2}" stop-opacity="0"/></linearGradient><clipPath id="${gid}c"><rect x="0" y="0" width="${PW}" height="${T+ph+1}"/></clipPath>`;
  box.innerHTML=`<div class="cwrap${scrolls?' scrolls':''}" style="height:${H}px"><svg class="chartsvg" width="${L}" height="${H}" viewBox="0 0 ${L} ${H}" aria-hidden="true">${left}</svg>
   <div class="cscroll" style="width:${pw}px"><div class="cplot" style="width:${PW}px;height:${H}px"><svg class="chartsvg" width="${PW}" height="${H}" viewBox="0 0 ${PW} ${H}" role="img" aria-label="${esc(c.title)}"><defs>${defs}</defs>${plot}<g clip-path="url(#${gid}c)">${series}</g><line class="cur" x1="0" x2="0" y1="${T}" y2="${T+ph}" visibility="hidden"/></svg>${marks}</div></div>
   <svg class="chartsvg" width="${R}" height="${H}" viewBox="0 0 ${R} ${H}" aria-hidden="true">${right}</svg><div class="ctip" hidden></div></div>`;
  const wrap=box.querySelector('.cwrap'),sc=wrap.querySelector('.cscroll'),cp=wrap.querySelector('.cplot'),cur=wrap.querySelector('.cur'),tip=wrap.querySelector('.ctip');
  if(scrolls)sc.scrollLeft=PW-pw;// opens at today
  // hover readout
  const near=A=>d=>{if(!A)return null;if(A.monthly)return A.pts.find(p=>p.d.slice(0,7)===d.slice(0,7))||null;let best=null,bd=Infinity;A.pts.forEach(p=>{const dd=Math.abs(pd(p.d)-pd(d));if(dd<bd){bd=dd;best=p}});return bd<=(b-a)*visDays/totalDays/10?best:null};
  const when=(s,p,d)=>s.monthly?` · ${monthLabel(p.d)}`:p.d!==d?` · ${fmtShort(p.d)}`:'';
  const val=(s,p)=>`${esc(s.label)} ${s.fmt?s.fmt(p.v):fmtV(p.v,s.unit)}`;
  cp.addEventListener('pointermove',ev=>{
    if(ev.target.closest('.phm')){tip.hidden=true;cur.setAttribute('visibility','hidden');return}
    const r=cp.getBoundingClientRect(),px=ev.clientX-r.left;if(px<0||px>PW){cur.setAttribute('visibility','hidden');tip.hidden=true;return}
    const d=iso(new Date(a+px/PW*(b-a)));cur.setAttribute('x1',px);cur.setAttribute('x2',px);cur.setAttribute('visibility','visible');
    const lines=[`<b>${fmt(d)}</b>`],p1=near(A1)(d),p2=near(A2)(d);
    if(p1)lines.push(`<span>${swatchFor(L1.monthly?'column':c.y1Type,col1)}${val(L1,p1)}${when(L1,p1,d)}${p1.src?` · ${esc(p1.src)}`:''}</span>`);
    if(p2)lines.push(`<span>${swatchFor(L2.monthly?'column':c.y2Type,col2)}${val(L2,p2)}${when(L2,p2,d)}${p2.src?` · ${esc(p2.src)}`:''}</span>`);
    [...X1.map((s,i)=>({s,A:A1,i})),...X2.map((s,i)=>({s,A:A2,i:X1.length+i}))].forEach(({s,A,i})=>{const p=A?near(onAxis(A,s))(d):null;if(p)lines.push(`<span>${swatchFor(s.monthly?'column':'line',xcol(i))}${val(s,p)}${when(s,p,d)}${p.src?` · ${esc(p.src)}`:''}</span>`)});
    if(c.bands.includes('cycle')){const cd=cycleDayOf(d);if(cd)lines.push(`<span><i class="bx" style="background:#E05A7E"></i>Cycle day ${cd}</span>`)}
    evs.filter(e=>e.occurred_at===d).forEach(e=>lines.push(`<span>▸ ${esc(e.title)}</span>`));
    segs.filter(s=>s.f<=d&&s.t>=d&&s.label!=='Period').forEach(s=>lines.push(`<span><i class="bx" style="background:${s.col}"></i>${esc(s.label)}</span>`));
    tip.innerHTML=lines.join('');tip.hidden=false;const vx=L+px-(scrolls?sc.scrollLeft:0),tw=tip.offsetWidth;tip.style.left=Math.max(4,vx+12+tw>W?vx-12-tw:vx+12)+'px';tip.style.top=(T+4)+'px'});
  cp.addEventListener('pointerleave',()=>{cur.setAttribute('visibility','hidden');tip.hidden=true});
}
/* one regimen a day at a time on a calendar: ticked days filled in its colour, running-but-unticked days a ring, days outside
   its stints plain, days to come faded. Click a day to tick it, again to untick (a manual regimen_logs row). */
function monthBody(c,small){
  const r=D.regimens.find(x=>x.id===c.reg);if(!r)return `<div class="empty">Pick a regimen to show.</div>`;
  const col=colorOf(r.color,regColor({})),n=small?1:(+c.months||1),Td=pd(TODAY);
  const months=[...Array(n)].map((_,i)=>{const d=new Date(Td.getFullYear(),Td.getMonth()-(n-1-i),1);return [d.getFullYear(),d.getMonth()]});
  const logged=new Set(logsOf(r.id).map(l=>l.on_date));
  let run=0,hit=0;for(let d=TODAY.slice(0,8)+'01';d<=TODAY;d=addDays(d,1))if(regimenActive(r,d)){run++;if(logged.has(d))hit++}
  const grid=(y,m)=>{const first=new Date(y,m,1),lead=(first.getDay()+6)%7,days=new Date(y,m+1,0).getDate();let cells='';
    for(let i=0;i<lead;i++)cells+='<span></span>';
    for(let k=1;k<=days;k++){const ds=iso(new Date(y,m,k)),on=logged.has(ds),running=regimenActive(r,ds),fut=ds>TODAY,isT=ds===TODAY;
      cells+=`<button type="button" class="cday rday${isT?' today':''}${fut?' future':''}${!running&&!on?' off':''}${running&&!on&&!fut?' ring':''}" data-rtickday="${r.id}:${ds}"${fut?' disabled':''} style="${on?`background:${col};color:#fff`:running&&!on&&!fut?`box-shadow:inset 0 0 0 1.5px ${col}`:''}" aria-label="${fmt(ds)}, ${on?'ticked':running?'not ticked':'not running'}${fut?', to come':''}">${k}</button>`}
    return `<div class="cmonth"><div class="cmh">${MONTHS[m]} ${y}</div><div class="cdw">${['M','T','W','T','F','S','S'].map(x=>`<span>${x}</span>`).join('')}</div><div class="cgrid2">${cells}</div></div>`};
  const stats=small?'':`<div class="cstats" style="grid-template-columns:repeat(2,minmax(0,1fr))"><div><b>${hit} of ${run}</b><span>days this month so far</span></div><div><b>${run?Math.round(hit/run*100)+'%':'–'}</b><span>${esc(r.name)}</span></div></div>`;
  const legend=small?'':`<div class="legend"><span class="lg"><i class="bx" style="background:${col};border-radius:50%"></i>Ticked</span><span class="lg"><i class="bx" style="border:1.5px solid ${col};background:transparent;border-radius:50%"></i>Running, not ticked</span><span class="lg"><em>Click a day to tick it, again to untick.</em></span></div>`;
  return `${stats}<div class="cmonths">${months.map(([y,m])=>grid(y,m)).join('')}</div>${legend}`;
}
function monthBuilder(c){const regs=D.regimens.filter(r=>r.category!=='diet').sort((a,b)=>a.started_on<b.started_on?1:-1);
  return `<div class="builder"><div class="brow"><span>Title</span><input class="inp" data-cb="title" value="${esc(c.title)}" aria-label="Chart title" style="width:100%;max-width:420px"></div>
  <div class="brow"><span>Regimen</span>${regs.length?`<select class="inp" data-cb="reg" aria-label="Regimen"><option value="">Pick a regimen</option>${regs.map(r=>`<option value="${r.id}"${c.reg===r.id?' selected':''}>${esc(r.name)}</option>`).join('')}</select>`:'<span class="empty">Nothing in Lifestyle yet. Add a regimen there first.</span>'}</div>
  <div class="brow"><span>Show</span><div class="chips">${[1,3,6].map(n=>`<button type="button" class="chip${(+c.months||1)===n?' on':''}" data-cym="${n}">${n} month${n>1?'s':''}</button>`).join('')}</div></div>
  <div class="brow"><span></span><div><button type="button" class="btn-accent" data-cact="done:${c.id}">Done</button></div></div></div>`}
function seriesGroups(){const groups={};seriesList().filter(s=>lineSeries(s.id)).forEach(s=>(groups[s.group]=groups[s.group]||[]).push(s));return groups}
function seriesOptions(sel,disabled,none,attr){const groups=seriesGroups();
  return `<option value="">${none}</option>`+Object.entries(groups).map(([g,ss])=>`<optgroup label="${esc(g)}">${ss.map(s=>`<option value="${esc(s.id)}"${s.id===sel?' selected':''}${disabled.includes(s.id)?' disabled':''}>${esc(s.label)}</option>`).join('')}</optgroup>`).join('')}
/* one axis of the builder: the data, its style, average, colour, range, and more lines sharing its scale */
function axisBlock(c,k,label){
  const sel=c[k],type=c[k+'Type']||'line',col=colorOf(c[k+'Color'],k==='y1'?DEFAULT_Y1:DEFAULT_Y2),other=k==='y1'?c.y2:c.y1;
  const selS=lineSeries(sel),monthly=!!(selS&&selS.monthly),more=c[k+'More']||[],used=[c.y1,c.y2,...(c.y1More||[]),...(c.y2More||[])].filter(Boolean);
  const avoid=[colorOf(c.y1Color,DEFAULT_Y1),colorOf(c.y2Color,DEFAULT_Y2)],range=c[k+'Range'];
  return `<div class="axisb"><div class="brow"><span>${label}${k==='y2'?` <button type="button" class="btn-ghost btn-sm" data-cbrmright>Remove</button>`:''}</span><div class="axis-ctl"><select class="inp" data-cb="${k}" aria-label="${label}">${seriesOptions(sel,other?[other]:[],'Nothing')}</select></div></div>
   ${sel?`<div class="brow"><span>Style</span><div class="axis-ctl">${monthly?'<span class="chip on">Columns by month</span>':`<div class="seg" role="radiogroup" aria-label="${label} style">${STYLES.map(([s,l])=>`<button type="button" role="radio" aria-checked="${type===s}" class="${type===s?'on':''}" data-cbtype="${k}|${s}">${l}</button>`).join('')}</div>`}
    ${type!=='column'&&type!=='dots'&&!monthly?`<button type="button" class="chip${c[k+'Avg']?' on':''}" data-cbavg="${k}">7-day average</button>`:''}<div class="mwrap"><button type="button" class="swbtn" data-cmenu style="background:${col}" aria-label="${label} colour" aria-haspopup="menu"></button>${paletteMenu(k,col)}</div></div></div>
   <div class="brow"><span>Range</span><div class="axis-ctl"><div class="seg sm" role="radiogroup" aria-label="${label} range"><button type="button" role="radio" aria-checked="${!range}" class="${range?'':'on'}" data-cbrange2="${k}|auto">Auto</button><button type="button" role="radio" aria-checked="${!!range}" class="${range?'on':''}" data-cbrange2="${k}|set">Set</button></div>
    ${range?`<input type="number" step="any" class="inp" style="width:84px" placeholder="Min" value="${range[0]??''}" data-cbmin="${k}" aria-label="Minimum"><span class="empty">to</span><input type="number" step="any" class="inp" style="width:84px" placeholder="Max" value="${range[1]??''}" data-cbmax="${k}" aria-label="Maximum">${fixedRange(range)?'':'<span class="empty">Both ends, low to high</span>'}`:''}</div></div>
   <div class="brow"><span>More lines</span><div class="axis-ctl" style="flex-direction:column;align-items:flex-start;gap:6px">${more.length?`<div class="chips">${more.map((id,i)=>{const s=lineSeries(id);return `<button type="button" class="chip on" data-cbrmmore="${k}|${esc(id)}" title="Remove"><i class="dot" style="background:${extraColor(k==='y1'?i:(c.y1More||[]).length+i,avoid)}"></i>${esc(s?s.label:id)} ✕</button>`}).join('')}</div>`:''}
    <select class="inp" data-cbmore="${k}" aria-label="Add another line on this axis">${seriesOptions('',used,'Add another line on this axis…')}</select><span class="s" style="font-size:12px;color:var(--muted)">For things on one scale, like two 1–5 ratings. They share this axis and get their own colours.</span></div></div>`:''}</div>`;
}
function builderHTML(c){
  const regs=D.regimens.slice().sort((p,q)=>p.started_on<q.started_on?-1:1),ills=illnesses();
  const phRegs=[...new Set(D.entries.filter(e=>e.photos.length&&e.details.series!=='body').flatMap(e=>e.regions))];
  const right=!!(c.y2||(c.y2More||[]).length||V.rightOpen===c.id);
  const seg2=(label,on,attr)=>`<div class="seg" role="radiogroup" aria-label="${label}"><button type="button" role="radio" aria-checked="${!on}" class="${on?'':'on'}" data-${attr}="0">Off</button><button type="button" role="radio" aria-checked="${on}" class="${on?'on':''}" data-${attr}="1">On</button></div>`;
  return `<div class="builder">
   <div class="brow"><span>Title</span><input class="inp" data-cb="title" value="${esc(c.title)}" aria-label="Chart title" style="width:100%;max-width:420px"></div>
   <div class="bsec">Y axis</div>${axisBlock(c,'y1','Left axis')}${right?axisBlock(c,'y2','Right axis'):`<div class="brow"><span></span><div><button type="button" class="btn-ghost btn-sm" data-cbaddright>+ Add right axis</button></div></div>`}
   <div class="bsec">X axis</div>
   <div class="brow"><span>Range</span><div class="chips">${[['3m','3 months'],['6m','6 months'],['12m','12 months'],['all','All'],['custom','Custom']].map(([k,l])=>`<button type="button" class="chip${c.range===k?' on':''}" data-cbrange="${k}">${l}</button>`).join('')}${c.range==='custom'?`<input type="date" class="inp" data-cb="from" value="${esc(c.from)}" aria-label="Start date"><span class="empty">to</span><input type="date" class="inp" data-cb="to" value="${esc(c.to)}" aria-label="End date">`:''}</div></div>
   <div class="brow"><span>Width</span><div class="axis-ctl"><div class="seg sm" role="radiogroup" aria-label="Fit or scroll"><button type="button" role="radio" aria-checked="${!c.scroll}" class="${c.scroll?'':'on'}" data-cbscroll="0">Fit</button><button type="button" role="radio" aria-checked="${!!c.scroll}" class="${c.scroll?'on':''}" data-cbscroll="1">Scroll</button></div>${c.scroll?`<span class="s" style="font-size:12px;color:var(--muted)">Viewport size</span><div class="chips">${[1,3,6].map(n=>`<button type="button" class="chip sm${(c.window||3)===n?' on':''}" data-cbwin="${n}">${n} month${n>1?'s':''}</button>`).join('')}</div>`:''}</div></div>
   <div class="bsec">Additions</div>
   <div class="brow"><span>Periods</span><div class="chips">${regs.map(r=>`<button type="button" class="chip${c.bands.includes(r.id)?' on':''}" data-cbband="${r.id}"><i class="dot" style="background:${colorOf(r.color,regColor({}))}"></i>${esc(r.name)}</button>`).join('')+cycleChip(c)+D.courses.map(k=>`<button type="button" class="chip${c.bands.includes('k:'+k.id)?' on':''}" data-cbband="k:${k.id}"><i class="dot" style="background:${colorOf(k.color,'#86C1CC')}"></i>${esc(k.title)} (course)</button>`).join('')+ills.map(ic=>`<button type="button" class="chip${c.bands.includes('i:'+ic.id)?' on':''}" data-cbband="i:${ic.id}"><i class="dot" style="background:${colorOf(illnessColor(ic),'#E08A7E')}"></i>${esc(ic.title)} (illness)</button>`).join('')||'<span class="empty">Nothing in Lifestyle yet</span>'}</div></div>
   ${D.courses.length?`<div class="brow"><span>Instances</span><div class="chips">${D.courses.map(k=>`<button type="button" class="chip${(c.sessions||[]).includes(k.id)?' on':''}" data-cbsess="${k.id}">${esc(k.title)}</button>`).join('')}</div></div>`:''}
   <div class="brow"><span>Markers</span><div class="chips">${MARKERS.map(([k,l])=>`<button type="button" class="chip${(c.markers||[]).includes(k)?' on':''}" data-cbmk="${k}">${l}</button>`).join('')}</div></div>
   <div class="brow"><span>Photos</span><div class="chips">${phRegs.map(r=>`<button type="button" class="chip${c.photos.includes(r)?' on':''}" data-cbph="${r}">${esc(rl(r))}</button>`).join('')||'<span class="empty">No photos yet</span>'}</div></div>
   <div class="bsec">Design</div>
   <div class="brow"><span>Axis lines</span><div>${seg2('Axis lines',c.axes!==false,'cbaxes')}</div></div>
   <div class="brow"><span>Gridlines</span><div>${seg2('Gridlines',!!c.grid,'cbgrid')}</div></div>
   <div class="brow"><span></span><div><button type="button" class="btn-accent" data-cact="done:${c.id}">Done</button></div></div></div>`;
}
const onDashboard=id=>[...D.widgets.left,...D.widgets.right].some(w=>w.type==='savedchart'&&w.chartId===id);
const GRIP='<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>';
function chartCard(c){
  const ed=V.editChart===c.id,n=zoneCount(D.chartLayout);
  return `<section class="card ccard${ed?' editing':''}" data-cid="${c.id}">
   <div class="card-h">${ed?'':`<button type="button" class="grip" data-drag="${c.id}" aria-label="Drag to move ${esc(c.title)}">${GRIP}</button>`}<h2 data-ctitle style="flex:1;min-width:0">${esc(c.title)}</h2><div class="mwrap"><button type="button" class="dots" data-cmenu aria-label="Chart options" aria-haspopup="menu">⋯</button>
    <div class="cmenu" role="menu" hidden><button type="button" role="menuitem" data-cact="edit:${c.id}">Edit chart</button><button type="button" role="menuitem" data-cact="dash:${c.id}">${onDashboard(c.id)?'Remove from dashboard':'Add to dashboard'}</button>${n>1?`<button type="button" role="menuitem" data-cact="prev:${c.id}">Move to previous column</button><button type="button" role="menuitem" data-cact="next:${c.id}">Move to next column</button>`:''}<button type="button" role="menuitem" data-cact="dup:${c.id}">Duplicate</button><button type="button" role="menuitem" data-cact="del:${c.id}">Delete chart</button></div></div></div>
   ${ed?(c.kind==='cycle'?cycleBuilder(c):c.kind==='month'?monthBuilder(c):builderHTML(c)):''}${c.kind==='cycle'?`<div class="cyc">${cycleChartBody(c)}</div>`:c.kind==='month'?`<div class="cyc">${monthBody(c)}</div>`:`<div class="cbox" data-cbox="${c.id}"></div><div class="legend">${chartLegend(c)}</div>`}</section>`;
}
function viewCharts(){
  normalizeZones();
  const def=LAYOUT_DEF[D.chartLayout],byId=id=>D.charts.find(c=>c.id===id);
  const zone=(ids,i)=>`<div class="czone" data-zone="${i}">${ids.filter(id=>id!==V.editChart).map(id=>chartCard(byId(id))).join('')||'<div class="zone-empty">Drag a chart here</div>'}</div>`;
  const edit=V.editChart&&byId(V.editChart);
  return `<div class="page-h" style="margin-bottom:16px"><div><h1>Charts</h1><span class="sub">Your values over time, with counts by month alongside; a regimen or your cycle on a calendar.</span></div>
   <div style="display:flex;gap:8px;align-items:center"><div class="mwrap"><button type="button" class="btn-ghost" data-cmenu aria-label="Change layout" aria-haspopup="menu" style="padding:5px 10px;display:grid;place-items:center">${layoutIcon(D.chartLayout)}</button>
    <div class="cmenu lmenu" role="menu" hidden>${LAYOUTS.map(([k,l])=>`<button type="button" role="menuitemradio" aria-checked="${D.chartLayout===k}" data-layout="${k}" class="${D.chartLayout===k?'on':''}">${layoutIcon(k)}<span>${l}</span></button>`).join('')}</div></div>
    <button type="button" class="btn-accent" data-act="add-chart">+ Add chart</button></div></div>
   ${edit?`<div style="margin-bottom:16px">${chartCard(edit)}</div>`:''}
   ${D.charts.length?`<div class="czones">${def.top?`<div class="ztop">${zone(D.chartZones[0],0)}</div>`:''}<div class="zcols" style="grid-template-columns:${def.cols.map(f=>`minmax(0,${f})`).join(' ')}">${def.cols.map((f,i)=>zone(D.chartZones[i+(def.top?1:0)],i+(def.top?1:0))).join('')}</div></div>`:'<section class="card"><div class="empty">No charts yet. Use + Add chart to build one.</div></section>'}
   <p class="disclaim">Charts line your records up by date. They don't calculate relationships between them or explain them. Bring anything you notice to your doctor.</p>`;
}
function paintCharts(){document.querySelectorAll('[data-cbox]').forEach(b=>{const c=D.charts.find(x=>x.id===b.dataset.cbox);if(c)drawChart(b,c,{h:b.hasAttribute('data-small')?200:0})})}
function newChart(o={}){const c={id:'ch-'+uid(),title:'New chart',y1:'m:weight',y1Type:'line',y1Color:DEFAULT_Y1,y2:null,y2Type:'line',y2Color:DEFAULT_Y2,bands:[],photos:[],range:'12m',from:addDays(TODAY,-180),to:TODAY,...o};D.charts.unshift(c);normalizeZones();D.chartZones.forEach(z=>{const i=z.indexOf(c.id);if(i>=0)z.splice(i,1)});D.chartZones[0].unshift(c.id);V.editChart=c.id;save();return c}
function moveChart(id,zone,index){D.chartZones.forEach(z=>{const i=z.indexOf(id);if(i>=0)z.splice(i,1)});const z=D.chartZones[zone];z.splice(Math.min(index,z.length),0,id);save()}
/* drag between columns (pointer events, works with mouse and touch) */
let cdrag=null;
document.addEventListener('pointerdown',e=>{
  const g=e.target.closest('[data-drag]');if(!g)return;e.preventDefault();
  const card=g.closest('.ccard'),r=card.getBoundingClientRect();
  const ph=document.createElement('div');ph.className='drop-ph';ph.style.height=r.height+'px';card.after(ph);
  card.classList.add('dragging');Object.assign(card.style,{width:r.width+'px',left:r.left+'px',top:r.top+'px'});
  cdrag={id:g.dataset.drag,card,ph,dx:e.clientX-r.left,dy:e.clientY-r.top};
});
document.addEventListener('pointermove',e=>{
  if(!cdrag)return;const {card,ph}=cdrag;card.style.left=(e.clientX-cdrag.dx)+'px';card.style.top=(e.clientY-cdrag.dy)+'px';
  const zone=document.elementsFromPoint(e.clientX,e.clientY).map(el=>el.closest&&el.closest('.czone')).find(Boolean);if(!zone)return;
  const cards=[...zone.querySelectorAll(':scope>.ccard:not(.dragging)')];const before=cards.find(c=>{const b=c.getBoundingClientRect();return e.clientY<b.top+b.height/2});
  const empty=zone.querySelector('.zone-empty');if(empty)empty.hidden=true;
  before?zone.insertBefore(ph,before):zone.appendChild(ph);
  if(e.clientY<60)window.scrollBy(0,-14);else if(e.clientY>innerHeight-60)window.scrollBy(0,14);
});
document.addEventListener('pointerup',()=>{
  if(!cdrag)return;const {id,ph}=cdrag;cdrag=null;const zone=ph.closest('.czone');
  if(zone){const idx=[...zone.children].filter(el=>el.classList.contains('ccard')&&!el.classList.contains('dragging')||el===ph).indexOf(ph);moveChart(id,+zone.dataset.zone,idx)}
  render();
});

/* appointments */
const YEAR=String(pd(TODAY).getFullYear());
const money=n=>'$'+Math.round(+n||0).toLocaleString();
const appts=()=>D.entries.filter(e=>e.type==='appointment');
const asc=(a,b)=>a.occurred_at<b.occurred_at?-1:1;
const readingFor=id=>D.entries.find(e=>e.type==='measurement'&&e.details.from_appt===id);
function planStats(p){
  const ap=appts().filter(e=>e.details.plan_id===p.id);
  return {done:ap.filter(e=>e.details.status==='done'&&e.occurred_at.startsWith(String(p.year))).length,target:+p.per_year||1,
    last:ap.filter(e=>e.details.status==='done').sort(byDateDesc())[0],next:ap.filter(e=>e.details.status==='upcoming'&&e.occurred_at>=TODAY).sort(asc)[0]};
}
function courseStats(k){
  const ss=appts().filter(e=>e.details.course_id===k.id);const done=ss.filter(e=>e.details.status==='done').sort(asc);
  return {done,next:ss.filter(e=>e.details.status==='upcoming').sort(asc)[0],spent:done.reduce((n,e)=>n+(+e.details.cost||0),0)};
}
function planStatus(p,s){return s.done>=s.target?[`Done for ${p.year}`,'mut']:s.next?[`Booked ${fmtShort(s.next.occurred_at)}`,'up']:+p.year<+YEAR?['Not done','']:['Not booked yet','']}
const plansFor=y=>D.plans.filter(p=>+p.year===+y);
function planCard(p){
  const s=planStats(p),[st,cl]=planStatus(p,s);
  return `<div class="rcard"><div class="donut-w" style="gap:14px">${donut(s.done/s.target,66,8,s.done>=s.target?'var(--accent)':'#4F5BF5',`<b style="font-size:16px">${s.done}/${s.target}</b>`)}
   <div class="rules" style="gap:3px"><span class="t">${esc(p.title)}</span><span class="s">${esc(kindLabel(p.kind)||'')} · ${+p.per_year>1?`${p.per_year}× a year`:'once a year'}</span><span class="s">${s.last?`Last: ${fmt(s.last.occurred_at)}`:'Nothing logged yet'}</span><span><span class="pill ${cl}">${st}</span></span></div></div>
   ${p.notes?`<span class="s">${esc(p.notes)}</span>`:''}
   <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px"><button type="button" class="btn-ghost btn-sm" data-plog="${p.id}">Log or book</button><button type="button" class="btn-ghost btn-sm" data-pedit="${p.id}">Edit</button></div></div>`;
}
function courseCard(k){
  const s=courseStats(k),m=k.metric&&D.metrics[k.metric];
  return `<section class="card"><div class="card-h" style="align-items:flex-start"><div style="min-width:0"><h2>${esc(k.title)}</h2><span class="sub">${esc([k.provider,k.practice].filter(Boolean).join(' · '))}</span></div><span class="pill ${k.ended_on?'mut':'up'}">${k.ended_on?'Ended '+fmtShort(k.ended_on):'Ongoing'}</span></div>
   <div class="kstats"><div><b>${s.done.length}</b><span>sessions</span></div><div><b>${money(s.spent)}</b><span>spent</span></div><div><b>${esc(k.cadence||'–')}</b><span>since ${fmt(k.started_on)}</span></div><div><b>${s.next?fmtShort(s.next.occurred_at):'–'}</b><span>next session</span></div></div>
   ${m?`<div class="cbox" data-kbox="${k.id}" style="margin-top:14px"></div><div class="legend"><span class="lg"><i class="ln" style="border-color:#4F5BF5"></i>${esc(m.l)} <em>${esc(unitLabel(m.u))} · your reading at each session</em></span></div>`:''}
   ${k.notes?`<p class="s" style="margin:10px 0 0;font-size:12.5px;color:var(--muted)">${esc(k.notes)}</p>`:''}
   <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button type="button" class="btn-accent btn-sm" data-klog="${k.id}">+ Log session</button><button type="button" class="btn-ghost btn-sm" data-kview="${k.id}">All sessions</button><button type="button" class="btn-ghost btn-sm" data-kchart="${k.id}">Chart it</button><button type="button" class="btn-ghost btn-sm" data-kedit="${k.id}">Edit</button></div></section>`;
}
function viewAppointments(){
  const yr=appts().filter(e=>e.details.status==='done'&&e.occurred_at.startsWith(YEAR));
  const up=appts().filter(e=>e.details.status==='upcoming'&&e.occurred_at>=TODAY).sort(asc);
  const kinds=[...new Set(appts().map(e=>e.details.kind))];
  const hist=appts().filter(e=>e.details.status!=='upcoming'&&(V.apptKind==='all'||e.details.kind===V.apptKind)).sort(byDateDesc());
  return `<div class="page-h" style="margin-bottom:16px"><div><h1>Appointments</h1><span class="sub">${yr.length} visits and check-ins in ${YEAR} · ${money(yr.reduce((n,e)=>n+(+e.details.cost||0),0))} recorded</span></div>
   <span style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn-ghost" data-act="add-plan">+ Plan item</button><button type="button" class="btn-ghost" data-act="add-course">+ Course of care</button><button type="button" class="btn-accent" data-act="add-appt">+ Appointment</button></span></div>
  <div style="display:flex;flex-direction:column;gap:16px">
   <div><div class="page-h" style="margin:6px 0 12px"><h2 style="font-size:17px;font-weight:800">Courses of care</h2><span class="sub">Recurring treatment: what was done each time, what it cost, and your own reading</span></div>
    <div class="kgrid">${D.courses.map(courseCard).join('')||'<section class="card"><div class="empty">No courses yet. Use + Course of care for something like physio every three weeks.</div></section>'}</div></div>
   ${sugHTML()?`<section class="card"><div class="card-h"><h2>From your calendar</h2><span class="sub">Not on your record until you add them</span></div><div class="rgrid">${sugHTML()}</div></section>`:''}
   <section class="card"><div class="card-h"><h2>Upcoming</h2><span class="sub">${up.length}</span></div>${up.map(entryRow).join('')||'<div class="empty">Nothing booked.</div>'}</section>
   <section class="card"><div class="card-h"><h2>History</h2><span class="sub">${hist.length}</span></div><div class="filters"><button type="button" class="chip${V.apptKind==='all'?' on':''}" data-akind="all">All</button>${kinds.map(k=>`<button type="button" class="chip${V.apptKind===k?' on':''}" data-akind="${k}">${esc(kindLabel(k)||k)}</button>`).join('')}</div><div data-clip="10" data-w="hist">${hist.map(entryRow).join('')||'<div class="empty">Nothing yet.</div>'}</div></section>
  </div>`;
}
let kro;function paintCourses(){if(window.ResizeObserver){kro&&kro.disconnect();kro=new ResizeObserver(()=>{clearTimeout(kro._t);kro._t=setTimeout(()=>{document.querySelectorAll("[data-kbox]").forEach(b=>{if(b._w!==b.clientWidth){b._w=b.clientWidth;drawCourse(b)}})},60)});document.querySelectorAll("[data-kbox]").forEach(b=>kro.observe(b))}document.querySelectorAll("[data-kbox]").forEach(b=>{b._w=b.clientWidth;drawCourse(b)})}
function drawCourse(b){{const k=D.courses.find(x=>x.id===b.dataset.kbox);if(!k||!k.metric)return;
  drawChart(b,{id:'k'+k.id,title:k.title,y1:'m:'+k.metric,y1Type:'line',y1Color:'#4F5BF5',y2:null,bands:[],photos:[],range:'custom',from:addDays(k.started_on,-10),to:k.ended_on||TODAY,grid:false},{h:190})}}
function logForCourse(k,status='done'){const c=D.concerns.find(x=>x.id===k.concern_id);openForm('appointment',{title:k.title,regions:c?c.regions:[],concern_id:k.concern_id,details:{kind:k.kind,status,provider:k.provider,practice:k.practice,course_id:k.id,cost:k.cost}})}
function openCourseSessions(id){
  const k=D.courses.find(x=>x.id===id);if(!k)return;const s=courseStats(k),m=k.metric&&D.metrics[k.metric];
  openSheet(`<div class="sheet-h"><h3>${ico('appointment')}${esc(k.title)}</h3><button class="x" type="button" aria-label="Close">✕</button></div>
   <div class="kstats" style="margin-bottom:12px"><div><b>${s.done.length}</b><span>sessions</span></div><div><b>${money(s.spent)}</b><span>spent</span></div><div><b>${esc(k.cadence||'–')}</b><span>since ${fmtShort(k.started_on)}</span></div></div>
   <div class="list">${s.done.slice().reverse().map(e=>{const r=readingFor(e.id);return `<button type="button" class="sess" data-entry="${e.id}"><span class="sess-h"><b>${fmt(e.occurred_at)}</b><span>${r&&m?`${esc(m.l)} ${fmtV(r.details.value,m.u)}`:''}${e.details.cost?` · ${money(e.details.cost)}`:''}</span></span>${e.details.what_was_done?`<span class="s">${esc(e.details.what_was_done)}</span>`:''}${e.details.what_they_said?`<span class="s">They said: ${esc(e.details.what_they_said)}</span>`:''}</button>`}).join('')||'<div class="empty">No sessions logged yet.</div>'}</div>
   <div class="form-acts" style="margin-top:14px"><span></span><button type="button" class="btn-accent" id="kLog">+ Log session</button></div>`);
  $('#kLog').addEventListener('click',()=>logForCourse(k));
  $('#overlay').querySelector('.sheet').addEventListener('click',e=>{const r=e.target.closest('[data-entry]');if(r)openEntry(r.dataset.entry)});
}
const kindLabel=k=>KIND_LABEL[k]||(((D&&D.settings)||{}).customKinds||{})[k]||(k?String(k):'');
const kindOptions=sel=>Object.entries({...KIND_LABEL,...(D.settings.customKinds||{})}).map(([k,l])=>`<option value="${esc(k)}"${k===sel?' selected':''}>${esc(l)}</option>`).join('')+'<option value="__kindnew">+ Add your own…</option>';
document.addEventListener('change',e=>{const sel=e.target;if(sel.tagName!=='SELECT'||sel.value!=='__kindnew')return;if(sel.nextElementSibling&&sel.nextElementSibling.classList.contains('kindnew'))return;
  const prev=[...sel.options].find(o=>o.defaultSelected)||sel.options[0];sel.insertAdjacentHTML('afterend','<input class="kindnew" placeholder="Name it, like Naturopath or Optometrist" aria-label="New kind" style="margin-top:6px">');const inp=sel.nextElementSibling;inp.focus();
  const done=()=>{const name=inp.value.trim();inp.remove();if(!name){sel.value=prev.value;return}const ex=Object.entries({...KIND_LABEL,...(D.settings.customKinds||{})}).find(([,l])=>l.toLowerCase()===name.toLowerCase());
    let id=ex?ex[0]:'k-'+(name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||uid());if(!ex){D.settings.customKinds={...(D.settings.customKinds||{}),[id]:name};save();sel.querySelector('option[value="__kindnew"]').insertAdjacentHTML('beforebegin',`<option value="${esc(id)}">${esc(name)}</option>`)}sel.value=id};
  inp.addEventListener('keydown',ev=>{if(ev.key==='Enter'){ev.preventDefault();inp.blur()}if(ev.key==='Escape'){inp.value='';inp.blur()}});let fin=false;const once=()=>{if(!fin){fin=true;done()}};inp.addEventListener('blur',once);inp.addEventListener('change',once)});
document.addEventListener('submit',e=>{e.target.querySelectorAll('.kindnew').forEach(i=>i.dispatchEvent(new Event('change')))},true);
document.addEventListener('submit',e=>{if(e.target.id!=='ceForm')return;e.preventDefault();const c=D.concerns.find(x=>x.id===V.concernPage);if(!c)return;const t=$('#ce_t').value.trim();if(!t)return;c.title=t;if(!isIllness(c)&&$('#ce_s'))c.started_on=$('#ce_s').value||c.started_on;c.notes=$('#ce_n').value;V.concEdit=false;save();render()});
function openPlan(pre={}){
  openSheet(`<div class="sheet-h"><h3>${ico('appointment')}${pre.id?'Edit plan item':'Plan item'}</h3><button class="x" type="button" aria-label="Close">✕</button></div>
  <form class="form" id="plForm" novalidate><div class="f"><label for="pl_t">What</label><input id="pl_t" value="${esc(pre.title||'')}" placeholder="Annual physical, DEXA scan, my fitness test"></div>
   <div class="f2"><div class="f"><label for="pl_k">Kind</label><select id="pl_k">${kindOptions(pre.kind||'doctor')}</select></div><div class="f"><label for="pl_y">Year</label><input id="pl_y" type="number" min="2000" max="2100" value="${esc(pre.year||V.planYear)}"></div><div class="f"><label for="pl_n">Times a year</label><input id="pl_n" type="number" min="1" max="52" value="${esc(pre.per_year||1)}"></div></div>
   <div class="f"><label for="pl_c">Category</label><select id="pl_c">${planCats().map(c=>`<option value="${esc(c.id)}"${(pre.category??planCats()[0].id)===c.id?' selected':''}>${esc(c.name)}</option>`).join('')}<option value=""${pre.category===''?' selected':''}>Other</option></select></div>
   <div class="f"><label for="pl_notes">Notes</label><textarea id="pl_notes" placeholder="What it involves">${esc(pre.notes||'')}</textarea></div>
   <div class="form-acts"><span>${pre.id?'<button type="button" class="btn-ghost" id="plDel">Delete</button>':''}</span><button type="submit" class="btn-accent">Save</button></div><div class="err" id="plErr"></div></form>`);
  if(pre.id)$('#plDel').addEventListener('click',()=>{D.plans=D.plans.filter(p=>p.id!==pre.id);save();closeSheet();render()});
  $('#plForm').addEventListener('submit',e=>{e.preventDefault();const t=$('#pl_t').value.trim();if(!t){$('#plErr').textContent='Name the plan item.';return}
    const p={id:pre.id||'p-'+uid(),title:t,kind:$('#pl_k').value,per_year:Math.max(1,+$('#pl_n').value||1),year:+$('#pl_y').value||V.planYear,notes:$('#pl_notes').value,category:$('#pl_c').value};const i=D.plans.findIndex(x=>x.id===p.id);if(i>=0)D.plans[i]=p;else D.plans.push(p);save();closeSheet();render()});
}
function openCourseForm(pre={}){
  openSheet(`<div class="sheet-h"><h3>${ico('appointment')}${pre.id?'Edit course of care':'Course of care'}</h3><button class="x" type="button" aria-label="Close">✕</button></div>
  <form class="form" id="kForm" novalidate><div class="f"><label for="k_t">Name</label><input id="k_t" value="${esc(pre.title||'')}" placeholder="Physio, right knee"></div>
   <div class="f2"><div class="f"><label for="k_k">Kind</label><select id="k_k">${kindOptions(pre.kind||'physio')}</select></div><div class="f"><label for="k_c">How often</label><input id="k_c" value="${esc(pre.cadence||'')}" placeholder="Every 3 weeks"></div>
    <div class="f"><label for="k_p">Provider</label><input id="k_p" value="${esc(pre.provider||'')}"></div><div class="f"><label for="k_pr">Practice</label><input id="k_pr" value="${esc(pre.practice||'')}"></div>
    <div class="f"><label for="k_s">Started</label><input id="k_s" type="date" value="${esc(pre.started_on||TODAY)}"></div><div class="f"><label for="k_e">Ended (blank if ongoing)</label><input id="k_e" type="date" value="${esc(pre.ended_on||'')}"></div>
    <div class="f"><label for="k_cost">Cost per session</label><input id="k_cost" type="number" step="any" value="${esc(pre.cost||'')}" placeholder="95"></div>
    <div class="f"><label for="f_concern">Concern</label>${concernSelect(pre.concern_id)}</div></div>
   <div class="f" id="newConcernWrap" hidden><label for="f_newconcern">New concern name</label><input id="f_newconcern"></div>
   <div class="f"><label for="k_m">Your reading at each session (optional)</label><select id="k_m"><option value="">None</option>${Object.entries(D.metrics).map(([k,m])=>`<option value="${k}"${k===pre.metric?' selected':''}>${esc(m.l)} (${esc(m.rating?'rating 1–5':m.u)})</option>`).join('')}<option value="__new">New rating…</option></select><span class="s" style="font-size:12px;color:var(--muted)">Something you can judge yourself each visit, like pain 1–5 or pain-free running distance. It's what lets you see over time whether anything changed.</span></div>
   <div class="f" id="kNewWrap" hidden><label for="k_nm">Name the rating</label><input id="k_nm" placeholder="Knee pain"></div>
   <div class="f"><label for="k_notes">Notes</label><textarea id="k_notes" placeholder="What you hope to get out of it">${esc(pre.notes||'')}</textarea></div>
   <div class="form-acts"><span>${pre.id?'<button type="button" class="btn-ghost" id="kDel">Delete</button>':''}</span><button type="submit" class="btn-accent">Save</button></div><div class="err" id="kErr"></div></form>`);
  $('#f_concern').addEventListener('change',e=>{$('#newConcernWrap').hidden=e.target.value!=='__new'});
  $('#k_m').addEventListener('change',e=>{$('#kNewWrap').hidden=e.target.value!=='__new'});
  if(pre.id)$('#kDel').addEventListener('click',()=>{D.courses=D.courses.filter(k=>k.id!==pre.id);save();closeSheet();render()});
  $('#kForm').addEventListener('submit',e=>{e.preventDefault();const t=$('#k_t').value.trim(),err=m=>{$('#kErr').textContent=m};if(!t)return err('Name the course.');
    const from=$('#k_s').value||TODAY,to=$('#k_e').value||null;if(to&&to<from)return err('The end date is before the start date.');
    let met=$('#k_m').value;if(met==='__new'){const n=$('#k_nm').value.trim();if(!n)return err('Name the rating.');met='x_'+uid();D.metrics[met]={l:n,u:'/5',rating:true}}
    const c=resolveConcern($('#f_concern').value,new Set(),from);if(c.err)return err(c.err);
    const k={id:pre.id||'k-'+uid(),title:t,kind:$('#k_k').value,provider:$('#k_p').value.trim(),practice:$('#k_pr').value.trim(),cadence:$('#k_c').value.trim(),started_on:from,ended_on:to,concern_id:c.id,metric:met||null,cost:$('#k_cost').value?+$('#k_cost').value:null,notes:$('#k_notes').value};
    const i=D.courses.findIndex(x=>x.id===k.id);if(i>=0)D.courses[i]=k;else D.courses.push(k);save();closeSheet();render()});
}

/* labs */
/* photos */
function viewPhotos(){
  const ps=D.entries.filter(e=>e.photos.length);
  const regs=[...new Set(ps.flatMap(e=>e.details.series==='body'?['__body']:e.regions))];
  const f=V.photoRegion;
  const shown=ps.filter(e=>f==='all'||(f==='__body'?e.details.series==='body':e.regions.includes(f)&&e.details.series!=='body')).sort(byDateDesc());
  return `<div class="page-h" style="margin-bottom:16px"><h1>Photos</h1><span class="sub">${shown.length} shown</span></div>
  <section class="card"><div class="filters"><button type="button" class="chip${f==='all'?' on':''}" data-pr="all">All</button>${regs.map(r=>`<button type="button" class="chip${f===r?' on':''}" data-pr="${r}">${r==='__body'?'Body progress':esc(rl(r))}</button>`).join('')}</div>
  <div class="pgrid">${shown.map(e=>`<button type="button" class="pcell" data-entry="${e.id}"><div class="pbox">${photoHTML(e.photos[0],e.title,e.occurred_at)}</div><b>${esc(e.title)}</b><span>${fmt(e.occurred_at)}</span></button>`).join('')}</div></section>`;
}

/* routines */
/* Lifestyle: the current diet, the active regimens, and the Archive of everything stopped (diets too), with a toggle by kind
   and a search. Each card has its colour bar, its stints, its photos and its adherence line; an archived one can be started
   again, which adds a stint to the same record. */
const LIFE_INFO='Your diet is how you eat, in your own words, for a stretch of time. One at a time: setting a new one ends the last. Nutrition numbers can come from MyFitnessPal through Apple Health.\n\nA regimen is anything you do on a schedule: a supplement, a medication, a skin or hair product, an activity. Several can run at once, and each keeps its own record of the days you ticked it off.';
const infoBtn=(title,text)=>`<button type="button" class="ibtn ibtn-sm" data-info="${esc(title)}" data-text="${esc(text)}" aria-label="About ${esc(title)}" title="About ${esc(title)}">i</button>`;
const plusBtn=(act,label)=>`<button type="button" class="ibtn ibtn-sm" data-act="${act}" aria-label="${esc(label)}" title="${esc(label)}">+</button>`;
function regCard(r,archived){const col=regColor(r);
  return `<div class="rcard lcard" style="border-left:4px solid ${col}"><button type="button" class="rlink" data-regimen="${r.id}"><span style="display:flex;gap:10px;align-items:center"><i class="dot" style="background:${col};width:12px;height:12px"></i><span class="t">${esc(r.name)}</span></span><span class="s">${esc(catLabel(r.category))}${r.dose?` · ${esc(r.dose)}`:''}${r.frequency?` · ${esc(r.frequency)}`:''}</span>${stintsOf(r).map(p=>`<span class="s">${fmtShort(p.from)} – ${p.to?fmtShort(p.to):'ongoing'} · ${span(p.from,p.to)}</span>`).join('')}</button>
   ${(r.photos||[]).length?`<div class="thumbs">${r.photos.map((p,i)=>`<button type="button" class="thumb" style="width:56px;height:56px;border:0;padding:0" data-rphoto="${r.id}:${i}" aria-label="Photo of the product">${photoHTML(p,r.name)}</button>`).join('')}</div>`:''}
   ${regAdhHTML(r)}${archived?`<div><button type="button" class="btn-ghost btn-sm" data-again="${r.id}">Start again</button></div>`:''}</div>`}
function viewRoutines(){
  const current=r=>!regimenStopped(r);// a future stop date keeps it where it is until then
  const diets=D.regimens.filter(r=>r.category==='diet'&&current(r)).sort((a,b)=>a.started_on<b.started_on?1:-1);
  const act=D.regimens.filter(r=>r.category!=='diet'&&current(r));
  const past=D.regimens.filter(r=>!current(r)).sort((a,b)=>(a.ended_on||'')<(b.ended_on||'')?1:-1);
  const kind=V.archKind||'all',needle=(V.archQ||'').trim().toLowerCase();
  const shown=past.filter(r=>(kind==='all'||(kind==='diet')===(r.category==='diet'))&&(!needle||[r.name,r.dose,r.frequency,r.notes,catLabel(r.category)].join(' ').toLowerCase().includes(needle)));
  return `<div class="page-h" style="margin-bottom:16px"><h1>Lifestyle</h1>${infoBtn('Diet and regimens',LIFE_INFO)}</div>
  <div style="display:flex;flex-direction:column;gap:16px">
  <section class="card"><div class="card-h"><h2>Diet</h2>${plusBtn('add-diet','Set a diet')}</div><div class="rgrid">${diets.map(r=>regCard(r)).join('')||'<div class="empty">No current diet.</div>'}</div></section>
  <section class="card"><div class="card-h"><h2>Active regimens <span class="sub">${act.length}</span></h2>${plusBtn('add-regimen','Add a regimen')}</div><div class="rgrid">${act.map(r=>regCard(r)).join('')||'<div class="empty">Nothing active.</div>'}</div></section>
  <section class="card"><div class="card-h"><h2>Archive <span class="sub">${past.length}</span></h2></div>
   ${past.length?`<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:12px"><div class="seg sm">${[['all','All'],['diet','Diets'],['reg','Regimens']].map(([v,l])=>`<button type="button" data-arch="${v}" class="${kind===v?'on':''}">${l}</button>`).join('')}</div><input class="inp" id="archQ" value="${esc(V.archQ||'')}" placeholder="Find by name, dose or notes" style="flex:1;max-width:320px"></div>`:''}
   <div class="rgrid">${shown.map(r=>regCard(r,true)).join('')||`<div class="empty">${past.length?'Nothing matches.':'Nothing stopped yet.'}</div>`}</div></section></div>`;
}

/* reports */
function viewReports(){
  const opts=`<option value="all">Everything</option><optgroup label="Body area">${Object.entries(REG()).map(([k,l])=>`<option value="r:${k}">${esc(l)}</option>`).join('')}</optgroup><optgroup label="Concern">${D.concerns.map(c=>`<option value="c:${c.id}">${esc(c.title)}</option>`).join('')}</optgroup>`;
  return `<div class="page-h" style="margin-bottom:16px"><h1>Summary</h1><span class="sub">Pull your own records together, for yourself or to bring to an appointment</span></div>
  <div style="display:flex;flex-direction:column;gap:16px">
  <section class="card"><div class="card-h"><h2>Visit summary</h2><span class="sub">Everything recorded about one area or concern, in date order</span></div>
   <form class="form" id="repForm"><div class="f2"><div class="f"><label for="rep_focus">Focus</label><select id="rep_focus">${opts}</select></div><div class="f"><label for="rep_from">From</label><input id="rep_from" type="date" value="${addDays(TODAY,-365)}"></div><div class="f"><label for="rep_to">To</label><input id="rep_to" type="date" value="${TODAY}"></div></div><div><button class="btn-accent" type="submit">Build summary</button></div></form>
   <div id="repOut" class="summary"></div></section>
  <section class="card"><div class="card-h"><h2>Export your data</h2><span class="sub">CSV, for a spreadsheet or your own analysis</span></div>
   <div class="chips" style="margin-bottom:10px">${[['entries','Entries'],['labs','Lab results'],['regimens','Regimens & diet']].map(([k,l],i)=>`<button type="button" class="chip${i===0?' on':''}" data-csv="${k}">${l}</button>`).join('')}</div>
   <textarea class="csv" id="csvOut" readonly aria-label="CSV export"></textarea><div style="margin-top:8px;display:flex;gap:8px;align-items:center"><button type="button" class="btn-dark" data-act="copy-csv">Copy CSV</button><span class="s" id="copyMsg" style="font-size:12px;color:var(--muted)"></span></div></section></div>`;
}
const csvq=v=>{const s=String(v??'');return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s};
function buildCSV(k){
  let rows;
  if(k==='entries')rows=[['date','type','title','body_areas','concern','metric','value','notes'],...D.entries.slice().sort((a,b)=>a.occurred_at<b.occurred_at?-1:1).map(e=>[e.occurred_at,e.type,e.title,e.regions.map(rl).join('; '),(D.concerns.find(c=>c.id===e.concern_id)||{}).title||'',e.details.metric||'',e.details.value??'',e.notes])];
  else if(k==='labs')rows=[['date','lab','marker','value','unit','lab_range','lab_flag'],...labsOnly().flatMap(l=>l.results.map(r=>[l.date,l.lab,r.marker,r.value,r.unit,r.range,r.flag]))];
  else rows=[['name','category','dose','frequency','started_on','ended_on','notes'],...D.regimens.map(r=>[r.name,catLabel(r.category),r.dose||'',r.frequency||'',r.started_on,r.ended_on||'',r.notes||''])];
  return rows.map(r=>r.map(csvq).join(',')).join('\n');
}
function buildSummary(focus,from,to){
  const inF=(regs,cid)=>focus==='all'||(focus.startsWith('r:')?regs.includes(focus.slice(2)):cid===focus.slice(2));
  const es=D.entries.filter(e=>e.occurred_at>=from&&e.occurred_at<=to&&inF(e.regions,e.concern_id)&&!(e.details.series==='body')).sort((a,b)=>a.occurred_at<b.occurred_at?-1:1);
  const rs=D.regimens.filter(r=>r.started_on<=to&&(!r.ended_on||r.ended_on>=from)&&inF(r.regions,r.concern_id));
  const ls=focus==='all'||focus==='r:whole_body'?labsOnly().filter(l=>l.date>=from&&l.date<=to):[];
  const title=focus==='all'?'Everything':focus.startsWith('r:')?rl(focus.slice(2)):(D.concerns.find(c=>c.id===focus.slice(2))||{}).title;
  const grp=t=>es.filter(e=>e.type===t);
  const li=e=>`<li><b>${fmt(e.occurred_at)}</b> · ${esc(e.title)}${e.details.what_they_said?` — “${esc(e.details.what_they_said)}”`:''}${e.notes?` (${esc(e.notes)})`:''}</li>`;
  return `<h3 style="margin-top:18px;font-size:17px">${esc(title)} · ${fmt(from)} – ${fmt(to)}</h3>
   ${rs.length?`<h4>Regimens and diet in this period</h4><ul>${rs.map(r=>`<li>${esc(r.name)}${r.dose?`, ${esc(r.dose)}`:''} · ${fmtShort(r.started_on)} – ${r.ended_on?fmtShort(r.ended_on):'ongoing'}</li>`).join('')}</ul>`:''}
   ${grp('appointment').length?`<h4>Appointments</h4><ul>${grp('appointment').map(li).join('')}</ul>`:''}
   ${grp('procedure').length?`<h4>Procedures</h4><ul>${grp('procedure').map(li).join('')}</ul>`:''}
   ${grp('observation').length?`<h4>Observations</h4><ul>${grp('observation').map(li).join('')}</ul>`:''}
   ${grp('measurement').length?`<h4>Measurements</h4><ul>${grp('measurement').map(li).join('')}</ul>`:''}
   ${ls.length?`<h4>Lab results</h4><ul>${ls.map(l=>`<li><b>${fmt(l.date)}</b> · ${l.results.map(r=>`${esc(r.marker)} ${esc(r.value)} ${esc(r.unit)}${r.flag?` (${esc(r.flag)})`:''}`).join(', ')}</li>`).join('')}</ul>`:''}
   ${grp('photo').length?`<h4>Photos</h4><div class="thumbs">${grp('photo').map(e=>`<div class="thumb" style="width:90px;height:110px">${photoHTML(e.photos[0],e.title,e.occurred_at)}</div>`).join('')}</div>`:''}
   ${!es.length&&!rs.length&&!ls.length?'<div class="empty">Nothing recorded for this focus and period.</div>':''}`;
}

/* ---------- render ---------- */
function render(){
  renderNav();
  const vb=$('#vaultBar');if(vb)vb.innerHTML=vaultBar();
  const v=$('#view');
  v.innerHTML={dashboard:viewDashboard,timeline:viewTimeline,appointments:viewAppointments,concerns:viewConcerns,plan:viewPlan,charts:viewCharts,labs:viewLabs,photos:viewPhotos,routines:viewRoutines,reports:viewReports}[V.tab]();
  if(V.tab==='dashboard')paintBody();
  if(V.tab==='dashboard'||V.tab==='charts')paintCharts();
  if(V.tab==='appointments')paintCourses();
  const hs=$('#hscroll');if(hs)hs.scrollLeft=+hs.dataset.today;
  clipLists();
  if(V.tab==='reports'){$('#csvOut').value=buildCSV('entries');$('#repForm').addEventListener('submit',e=>{e.preventDefault();$('#repOut').innerHTML=buildSummary($('#rep_focus').value,$('#rep_from').value,$('#rep_to').value)})}
}
function setRegion(r){V.region=r;V.concern=null;V.frame=null;V.editing=false;EDIT_SNAP=null;render();window.scrollTo({top:0,behavior:'smooth'})}

/* ---------- point editing: drag a region or point; drag the group box ---------- */
let drag=null,gdrag=null;
document.addEventListener('pointerdown',e=>{
  const g=e.target.closest('#gbox');if(g&&V.editing){const b=$('#stage').getBoundingClientRect();gdrag={el:g,x0:e.clientX,y0:e.clientY,bw:b.width,bh:b.height,dx:0,dy:0};g.setPointerCapture(e.pointerId);e.preventDefault();return}
  const h=e.target.closest('.hot');if(!h||!V.editing||h.classList.contains('grouped'))return;drag={id:h.dataset.pt,el:h,x0:e.clientX,y0:e.clientY,moved:false};h.setPointerCapture(e.pointerId);e.preventDefault()});
document.addEventListener('pointermove',e=>{
  if(gdrag){gdrag.dx=e.clientX-gdrag.x0;gdrag.dy=e.clientY-gdrag.y0;const s=$('#gScale');gdrag.el.style.transform=`translate(${gdrag.dx}px,${gdrag.dy}px) scale(${s?s.value:1})`;return}
  if(!drag)return;if(Math.hypot(e.clientX-drag.x0,e.clientY-drag.y0)>4)drag.moved=true;if(!drag.moved)return;const b=$('#stage').getBoundingClientRect();
  const x=Math.min(100,Math.max(0,(e.clientX-b.left)/b.width*100)),y=Math.min(100,Math.max(0,(e.clientY-b.top)/b.height*100));const p=D.points.find(p=>p.id===drag.id);p.x=+x.toFixed(1);p.y=+y.toFixed(1);drag.el.style.left=x+'%';drag.el.style.top=y+'%'});
document.addEventListener('pointerup',()=>{
  if(gdrag){const g=gdrag;gdrag=null;const s=$('#gScale');commitGroup(s?+s.value:1,g.dx/g.bw*100,g.dy/g.bh*100);return}
  if(!drag)return;const d=drag;drag=null;if(d.moved)save();else openPoint(d.id)});
/* a new region on the body (this side) or a new point on the canvas being viewed, at x,y in % */
function addPointAt(x,y){if(!V.editing)return;const pt=V.region?{x,y,parent:V.region}:{x,y,...(V.side==='back'?{side:'back'}:{})};
  openPointForm(V.region?'Add a point':'Add a region',null,r=>{D.points.push({id:uid(),region:r,...pt})})}
/* name a point, move it to another area, or remove it. A new name on a built-in area makes a custom area; on a custom area it renames it */
function openPointForm(title,val,onSave,onRemove){
  const regs=REG();let region=val||'__new';
  openSheet(`<div class="sheet-h"><h3>${esc(title)}</h3><button class="x" type="button" aria-label="Close">✕</button></div>
   <form class="form" id="ptForm" novalidate><div class="f"><label for="pt_name">Name</label><input id="pt_name" value="${esc(val?regs[val]||'':'')}" placeholder="Left shoulder mole"><span class="s" id="ptHint" style="font-size:12px;color:var(--muted)"></span></div>
   <div class="f"><label for="pt_reg">Or pick an area</label><select id="pt_reg">${Object.entries(regs).map(([k,l])=>`<option value="${k}"${k===region?' selected':''}>${esc(l)}</option>`).join('')}<option value="__new"${region==='__new'?' selected':''}>New area…</option></select></div>
   <div class="form-acts"><span>${onRemove?'<button type="button" class="btn-ghost" id="ptDel">Remove point</button>':''}</span><button class="btn-accent" type="submit">Save</button></div><div class="err" id="ptErr"></div></form>`);
  const hint=()=>{$('#ptHint').textContent=region==='__new'?'':region.startsWith('cr-')?'Change it to rename this area.':'Change it and the point gets its own area with that name.'};hint();
  $('#pt_reg').addEventListener('change',e=>{region=e.target.value;$('#pt_name').value=region==='__new'?'':regs[region]||'';hint()});
  if(onRemove)$('#ptDel').addEventListener('click',()=>{onRemove();save();closeSheet();render()});
  $('#ptForm').addEventListener('submit',e=>{e.preventDefault();let r=region;const n=$('#pt_name').value.trim(),slug=()=>'cr-'+(n.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||uid());
    if(r==='__new'){if(!n){$('#ptErr').textContent='Name the area.';return}r=slug();D.customRegions[r]=n}
    else if(n&&n!==regs[r]){if(r.startsWith('cr-'))D.customRegions[r]=n;else{r=slug();D.customRegions[r]=n}}
    onSave(r);save();closeSheet();render()});
}
function openPoint(id){const p=D.points.find(p=>p.id===id);if(!p)return;openPointForm('Point: '+rl(p.region),p.region,r=>{p.region=r},()=>{D.points=D.points.filter(x=>x.id!==id)})}

/* ---------- sheets ---------- */
function openSheet(html){const up=$('#overlay').firstChild?'':' up';$('#overlay').innerHTML=`<div class="scrim${up}" id="scrim"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`;const f=$('#overlay').querySelector('input:not([type=file]),select,textarea');f&&f.focus()}
function closeSheet(){$('#overlay').innerHTML=''}
/* a second layer over a sheet (adjust a photo, a lightbox): the sheet underneath keeps everything typed in it */
function openModal(html){$('#overlay').insertAdjacentHTML('beforeend',`<div class="scrim scrim2 up" data-modal><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`)}
function closeModal(){const m=[...document.querySelectorAll('[data-modal]')].pop();if(m)m.remove()}
$('#overlay').addEventListener('click',e=>{const m=e.target.closest('[data-modal]');if(m){if(e.target===m||e.target.closest('.x'))closeModal();return}if(e.target.id==='scrim'||e.target.closest('.x'))closeSheet()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(document.querySelector('[data-modal]'))closeModal();else closeSheet()}});
function shrink(file){return new Promise(res=>{const r=new FileReader();r.onload=()=>{const img=new Image();img.onload=()=>{const s=Math.min(1,1600/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*s);c.height=Math.round(img.height*s);c.getContext('2d').drawImage(img,0,0,c.width,c.height);try{res(c.toDataURL('image/jpeg',.84))}catch(e){res(null)}};img.onerror=()=>res(null);img.src=r.result};r.onerror=()=>res(null);r.readAsDataURL(file)})}

function openAdd(pre={}){
  const once=[['photo'],['appointment'],['measurement'],['procedure'],['observation'],['food_trial']];
  openSheet(`<div class="sheet-h"><h3>Add</h3><button class="x" type="button" aria-label="Close">✕</button></div>
  ${tracked().length?`<button type="button" class="ckbtn" data-pick="checkin">${ico('measurement')}<span><b>Check in</b><span>${esc(tracked().map(c=>c.title).join(', '))}</span></span></button>`:''}
  <div class="sec">Something that happened</div><div class="types">${once.map(([k])=>`<button type="button" class="type" data-pick="${k}">${ico(k)}<b>${TYPES[k].label}</b><span>${TYPES[k].hint}</span></button>`).join('')}<button type="button" class="type" data-pick="illness">${ico('illness')}<b>Illness</b><span>A cold, a bug, a flare-up: when it started, when it ended</span></button><button type="button" class="type" data-pick="cycle">${ico('cycle')}<b>Cycle day</b><span>Period flow, spotting, symptoms</span></button></div>
  <div class="sec">Something over time</div><div class="types">
   <button type="button" class="type" data-pick="regimen">${ico('regimen')}<b>Regimen</b><span>Something you take or do regularly: supplements, meds, skin care, yoga</span></button>
   <button type="button" class="type" data-pick="diet">${ico('diet')}<b>Diet</b><span>How you're eating, in your own words</span></button>
   <button type="button" class="type" data-pick="challenge">${ico('challenge')}<b>Challenge</b><span>Something for a set time with check-ins, phases to compare, or before and after a change</span></button>
   <button type="button" class="type" data-pick="concern">${ico('observation')}<b>Concern</b><span>Something you're keeping an eye on, with its own check-ins</span></button></div>
  <div class="sec">A document</div><div class="types"><button type="button" class="type" data-pick="lab">${ico('lab')}<b>Lab report</b><span>Bloodwork PDF and its results, as printed</span></button><button type="button" class="type" data-pick="report">${ico('report')}<b>Other report</b><span>A prescription, a scan, a letter: the file and its values</span></button></div>`);
  $('#overlay').querySelectorAll('[data-pick]').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.pick;
    if(k==='checkin')openCheckin();else if(k==='cycle'){if(!D.settings.cycle_on){D.settings.cycle_on=true;save()}openCycleDay()}else if(k==='concern')openConcernNew();else if(k==='regimen')openRegimen({});else if(k==='diet')openRegimen({category:'diet'});else if(k==='challenge')openNewExperiment();else if(k==='lab')openLabForm();else if(k==='report')openLabForm('prescription');else if(k==='illness')openIllnessNew();else openForm(k,pre)}));
}
const metricOptLabel=(k,m)=>`${m.l} (${k==='weight'||k==='height'?unitWord(k):m.rating?unitLabel(m.u):m.u})`;
function fieldHTML(f,val,ctx){
  const id='f_'+f.k,v=val??'';let inp;
  if(f.t==='metric')inp=`<select id="${id}" name="${f.k}">${Object.entries(D.metrics).map(([k,m])=>`<option value="${k}"${v===k?' selected':''}>${esc(metricOptLabel(k,m))}</option>`).join('')}<option value="__new">New measure…</option></select>`;
  else if(f.t==='provider'){const cur=(ctx||{}).provider_id||'',ps=providersOf().filter(p=>!p.archived||p.id===cur);
    inp=`${ps.length?`<select id="f_provider_id" name="provider_id"><option value="">Someone else</option>${ps.map(p=>`<option value="${esc(p.id)}"${p.id===cur?' selected':''}>${esc(p.name)}</option>`).join('')}</select>`:''}<input id="${id}" name="${f.k}" type="text" value="${esc(v)}" placeholder="${esc(f.p||'')}"${cur&&ps.length?' hidden':''}>`}
  else if(f.t==='plan')inp=`<select id="${id}" name="${f.k}"><option value="">No</option>${D.plans.slice().sort((a,b)=>b.year-a.year).map(p=>`<option value="${p.id}"${v===p.id?' selected':''}>${esc(p.title)} (${p.year})</option>`).join('')}</select>`;
  else if(f.t==='course')inp=`<select id="${id}" name="${f.k}"><option value="">No</option>${D.courses.map(k=>`<option value="${k.id}"${v===k.id?' selected':''}>${esc(k.title)}</option>`).join('')}</select>`;
  else if(f.t==='kind')inp=`<select id="${id}" name="${f.k}">${kindOptions(v||'doctor')}</select>`;
  else if(f.t==='select')inp=`<select id="${id}" name="${f.k}">${f.o.map(([ov,ol])=>`<option value="${esc(ov)}"${String(v)===ov?' selected':''}>${esc(ol)}</option>`).join('')}</select>`;
  else if(f.t==='area')inp=`<textarea id="${id}" name="${f.k}">${esc(v)}</textarea>`;
  else inp=`<input id="${id}" name="${f.k}" type="${f.t==='number'?'number':f.t==='date'?'date':'text'}" ${f.t==='number'?'step="any"':''} value="${esc(v)}" placeholder="${esc(f.p||'')}">`;
  return `<div class="f"${f.only?` data-only="${f.only}"${(ctx||{}).kind!==f.only?' hidden':''}`:''}${f.full?' style="grid-column:1/-1"':''}><label for="${id}">${esc(f.l)}</label>${inp}</div>`;
}
/* the regions of the body as chips; a chosen region's points come up under it. A point goes with its region */
function regionChips(regs){const R=REG(),top=topRegions(regs),open=top.filter(k=>{const c=childRegions(k);return c.length&&(regs.has(k)||c.some(x=>regs.has(x)))});
  return `<div class="regpick" id="regChips"><div class="chips">${top.map(k=>`<button type="button" class="chip${regs.has(k)?' on':''}" data-reg="${k}">${esc(R[k]||k)}</button>`).join('')}</div>${open.map(k=>`<div class="chips subchips"><span class="s">${esc(R[k]||k)} ›</span>${childRegions(k).map(c=>`<button type="button" class="chip sm${regs.has(c)?' on':''}" data-reg="${c}" data-parent="${k}">${esc(R[c]||c)}</button>`).join('')}</div>`).join('')}</div>`}
const concernSelect=sel=>`<select id="f_concern" name="concern"><option value="">None</option>${D.concerns.map(c=>`<option value="${c.id}"${sel===c.id?' selected':''}>${esc(c.title)}${c.status==='resolved'?' (resolved)':''}</option>`).join('')}<option value="__new">Start a new concern…</option></select>`;
function wireRegions(regs,onChange){const box=$('#regChips');if(!box)return;box.addEventListener('click',e=>{const b=e.target.closest('[data-reg]');if(!b)return;const k=b.dataset.reg;
  if(regs.has(k)){regs.delete(k);childRegions(k).forEach(c=>regs.delete(c))}else{regs.add(k);if(b.dataset.parent)regs.add(b.dataset.parent)}
  box.outerHTML=regionChips(regs);wireRegions(regs,onChange);if(onChange)onChange(regs)})}
function resolveConcern(val,regs,date){if(val!=='__new')return {id:val||null};const n=$('#f_newconcern').value.trim();if(!n)return {err:'Name the new concern.'};const id='c-'+uid();D.concerns.push({id,title:n,regions:[...regs],started_on:date,resolved_on:null,status:'active'});return {id}}

function openForm(type,pre={}){
  const T=TYPES[type],d=pre.details||{},regs=new Set(pre.regions||(V.region?[V.region]:[]));
  // photos already on the entry (when editing) and the ones being added: each with a label (Front, Back…) and an adjust button
  const kept=(pre.id?pre.photos||[]:[]).map(p=>({...p})),pending=[],pfiles=[],keptFiles=[...(pre.files||[])];
  const units=unitPref();
  openSheet(`<div class="sheet-h"><h3>${ico(type)}${T.label}</h3><button class="x" type="button" aria-label="Close">✕</button></div>
  <form class="form" id="entryForm" novalidate>
    ${type==='measurement'?'':`<div class="f"><label for="f_title">Title</label><input id="f_title" name="title" value="${esc(pre.title||'')}" placeholder="${type==='appointment'?'Dental cleaning':type==='photo'?'Left cheek, morning':'Short description'}"></div>`}
    <div class="f2"><div class="f"><label for="f_date">Date</label><input id="f_date" name="occurred_at" type="date" value="${esc(pre.occurred_at||TODAY)}"></div><div class="f"><label for="f_time">Time (optional)</label><input id="f_time" type="time" value="${esc(d.time||'')}"></div>${type==='observation'?`<div class="f"><label for="f_end_d">Ended (optional)</label><input id="f_end_d" type="date" value="${esc(d.end_date||'')}"></div><div class="f"><label for="f_end_t">End time</label><input id="f_end_t" type="time" value="${esc(d.end_time||'')}"></div>`:''}${T.fields.map(f=>fieldHTML(f,d[f.k],d)).join('')}</div>
    ${type==='measurement'?`<div class="f" id="valWrap"></div>`:''}
    ${type==='appointment'?`<div class="f" id="readingWrap" hidden><label for="f_reading" id="readingLab"></label><input id="f_reading" type="number" step="any" value="${esc((pre.id&&readingFor(pre.id)||{details:{}}).details.value??'')}"></div>`:''}
    ${type==='measurement'?`<div class="f2" id="newMetric" hidden><div class="f"><label for="nm_l">Name the measure</label><input id="nm_l" placeholder="e.g. Waist, bedtime, lump size"></div><div class="f"><label for="nm_k">It's…</label><select id="nm_k">${KIND_OPTS.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></div><div class="f" id="nmUWrap"><label for="nm_u">Unit</label><input id="nm_u" placeholder="cm, kg, mm"></div><div class="f" id="nmSWrap" hidden><label for="nm_s">Scale</label><select id="nm_s">${RATING_SCALES.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select><span class="s" style="font-size:12px;color:var(--muted)">Fixed once chosen: start a new measure to change it.</span></div></div>`:''}
    ${type==='measurement'?'':`<div class="f"><span class="l">Body areas</span>${regionChips(regs)}</div>`}
    <div class="f"><label for="f_concern">Concern</label>${concernSelect(pre.concern_id)}</div>
    <div class="f" id="newConcernWrap" hidden><label for="f_newconcern">New concern name</label><input id="f_newconcern" placeholder="e.g. Eczema, inner elbow"></div>
    ${type==='measurement'?'':`<div class="f"><label for="f_photos">Photos or files</label><input id="f_photos" type="file" accept="image/*,application/pdf,.pdf,.doc,.docx,.csv,.txt" multiple><span class="s" style="font-size:12px;color:var(--muted)">Photos and files are encrypted on this device before they go to your private storage. Under each photo, name what it is of (Front, Back…) and adjust how it sits.</span><div class="thumbs" id="thumbs"></div></div>`}
    <div class="f"><label for="f_notes">Notes</label><textarea id="f_notes" name="notes">${esc(pre.notes||'')}</textarea></div>
    <div class="form-acts"><button type="button" class="btn-ghost" id="backBtn">← Back</button><button type="submit" class="btn-accent">Save</button></div><div class="err" id="formErr"></div>
  </form>`);
  const F=$('#entryForm');
  wireRegions(regs,r=>{if(type==='photo'){const s=$('#f_series');if(s&&(s.value||'none')==='none'){if(r.has('whole_body'))s.value='body';else if(r.has('face'))s.value='face'}}});
  $('#f_concern').addEventListener('change',e=>{$('#newConcernWrap').hidden=e.target.value!=='__new'});
  if(type==='appointment'){
    const sync=()=>{const k=D.courses.find(x=>x.id===$('#f_course_id').value),m=k&&k.metric&&D.metrics[k.metric];$('#readingWrap').hidden=!m;if(m)$('#readingLab').textContent=`Your ${m.l.toLowerCase()} today (${m.rating?unitLabel(m.u):m.u})`};sync();
    $('#f_course_id').addEventListener('change',()=>{const k=D.courses.find(x=>x.id===$('#f_course_id').value);if(k){if(!$('#f_cost').value&&k.cost)$('#f_cost').value=k.cost;if(!$('#f_provider').value)$('#f_provider').value=k.provider||''}sync()});
    const ps=$('#f_provider_id');if(ps)ps.addEventListener('change',()=>{const p=providerOf(ps.value);$('#f_provider').hidden=!!p;if(p){$('#f_provider').value=p.name;if(p.practice)$('#f_practice').value=p.practice}else $('#f_provider').value=''});
  }
  // the measure: weight and height take the preferred unit, with a toggle that converts what has been typed; feet and inches for height
  if(type==='measurement'){
    const drawVal=()=>{const mk=$('#f_metric').value,isNew=mk==='__new',kd=isNew?$('#nm_k').value:mkind(mk),u=unitPref();$('#newMetric').hidden=!isNew;$('#nmUWrap').hidden=kd!=='number';$('#nmSWrap').hidden=kd!=='rating';
      const v0=mk===d.metric?d.value:null,unit=isNew?(kd==='rating'?$('#nm_s').value:''):metric(mk).u;
      if(mk==='weight'||mk==='height'){const lb=mk==='weight'&&u.weight==='lb',ft=mk==='height'&&u.height==='ft';
        const tog=`<div class="seg sm" id="unitSeg">${(mk==='weight'?[['kg','kg'],['lb','lb']]:[['cm','cm'],['ft','ft in']]).map(([x,l])=>`<button type="button" data-u="${x}" class="${(mk==='weight'?u.weight:u.height)===x?'on':''}">${l}</button>`).join('')}</div>`;
        const c=ft&&v0!=null?ftInFromCm(+v0):null;
        $('#valWrap').innerHTML=ft?`<span class="l">Value</span><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><input id="f_ft" type="number" step="1" min="0" value="${c?c.ft:''}" style="width:80px" aria-label="Feet"> ft <input id="f_in" type="number" step="any" min="0" value="${c?c.inch:''}" style="width:80px" aria-label="Inches"> in ${tog}</div>`
          :`<label for="f_val">Value (${lb?'lb':mk==='weight'?'kg':'cm'})</label><div style="display:flex;gap:8px;align-items:center"><input id="f_val" type="number" step="any" value="${v0!=null?(lb?lbFromKg(+v0):v0):''}" style="flex:1">${tog}</div>`;
        $('#unitSeg').addEventListener('click',e=>{const b=e.target.closest('[data-u]');if(!b)return;const nu=b.dataset.u,cur=readMeasure(mk);setUnit(mk,nu);save();drawVal();
          // switching the unit converts what has been typed so nothing is lost
          if(cur!=null){if(mk==='weight')$('#f_val').value=nu==='lb'?lbFromKg(cur):cur;else if(nu==='ft'){const q=ftInFromCm(cur);$('#f_ft').value=q.ft;$('#f_in').value=q.inch}else $('#f_val').value=cur}})}
      else $('#valWrap').innerHTML=valHTML(kd,v0,'f','Value',unit)};
    // what has been typed, as the stored unit (kg or cm)
    const readMeasure=mk=>{const u=unitPref();if(mk==='height'&&u.height==='ft'){const ft=$('#f_ft'),inch=$('#f_in');if(!ft||(ft.value.trim()===''&&inch.value.trim()===''))return null;return cmFromFtIn(+ft.value||0,+inch.value||0)}const el=$('#f_val');if(!el||el.value.trim()==='')return null;const n=+el.value;if(isNaN(n))return null;return mk==='weight'&&u.weight==='lb'?kgFromLb(n):n};
    drawVal();$('#f_metric').addEventListener('change',drawVal);$('#nm_k').addEventListener('change',drawVal);$('#nm_s').addEventListener('change',drawVal);
    F._readMeasure=readMeasure;
  }
  $('#backBtn').addEventListener('click',()=>openAdd(pre));
  const thumbs=()=>{const box=$('#thumbs');if(!box)return;
    const cell=(p,list,i)=>`<div class="pthumb"><button type="button" class="thumb" data-padj="${list}:${i}" title="Adjust how it sits">${photoHTML(p,'Photo')}</button><input class="plab" data-plab="${list}:${i}" value="${esc(p.label||'')}" placeholder="Label…" aria-label="What this photo is of"><button type="button" class="rm" data-prm="${list}:${i}" aria-label="Remove photo">✕</button></div>`;
    box.innerHTML=kept.map((p,i)=>cell(p,'k',i)).join('')+pending.map((p,i)=>cell(p,'n',i)).join('')+keptFiles.map((f,i)=>`<span class="fchip">${FILE_ICON}${esc(f.name)}<button type="button" class="rm" data-frm="k:${i}" aria-label="Remove file">✕</button></span>`).join('')+pfiles.map((f,i)=>`<span class="fchip">${FILE_ICON}${esc(f.name)}<button type="button" class="rm" data-frm="n:${i}" aria-label="Remove file">✕</button></span>`).join('')};
  const fp=$('#f_photos');
  if(fp){
    fp.addEventListener('click',e=>{if(!vaultReady()){e.preventDefault();$('#formErr').textContent='Turn on photo encryption first: Security, at the bottom of the page.'}});
    fp.addEventListener('change',async e=>{for(const f of e.target.files){if(f.type.startsWith('image/')){const src=await shrink(f);if(src)pending.push({src,...(pre.photoLabel?{label:pre.photoLabel}:{})})}else pfiles.push({name:f.name,size:f.size,blob:f})}thumbs();fp.value=''});
    thumbs();
    $('#thumbs').addEventListener('input',e=>{const el=e.target.closest('[data-plab]');if(!el)return;const [l,i]=el.dataset.plab.split(':'),p=(l==='k'?kept:pending)[+i];const v=el.value.trim();if(v)p.label=v;else delete p.label});
    $('#thumbs').addEventListener('click',e=>{const a=e.target.closest('[data-padj]'),r=e.target.closest('[data-prm]'),fr=e.target.closest('[data-frm]');
      if(r){const [l,i]=r.dataset.prm.split(':');(l==='k'?kept:pending).splice(+i,1);thumbs();return}
      if(fr){const [l,i]=fr.dataset.frm.split(':');(l==='k'?keptFiles:pfiles).splice(+i,1);thumbs();return}
      if(a){const [l,i]=a.dataset.padj.split(':'),p=(l==='k'?kept:pending)[+i],ser=$('#f_series')?$('#f_series').value:'';
        openAdjust(p,ser==='body'?'body':ser==='face'?'face':null,fit=>{if(fit)p.fit=fit;else delete p.fit;thumbs()})}});
  }
  if(type==='appointment')$('#f_kind').addEventListener('change',e=>document.querySelectorAll('#entryForm [data-only]').forEach(x=>x.hidden=x.dataset.only!==e.target.value));
  F.addEventListener('submit',e=>{
    e.preventDefault();const fd=new FormData(F),det={},err=m=>{$('#formErr').textContent=m};
    T.fields.forEach(f=>{const v=fd.get(f.k);if(v!==null&&v!=='')det[f.k]=f.t==='number'?+v:v});
    if(type==='appointment'){const pid=fd.get('provider_id');if(pid)det.provider_id=pid;else delete det.provider_id}
    let title=(fd.get('title')||'').trim();
    if(type==='measurement'){
      const kd=det.metric==='__new'?$('#nm_k').value:mkind(det.metric);let v;
      if(det.metric==='weight'||det.metric==='height'){v=F._readMeasure(det.metric)}else v=readVal(kd,'f');
      if(v==null||isNaN(v))return err('Enter a value.');
      if(det.metric==='__new'){const l=$('#nm_l').value.trim();if(!l)return err('Name the new measure.');const k='x_'+uid();D.metrics[k]=kd==='rating'?{l,u:$('#nm_s').value,kind:'rating',rating:true}:{l,u:kd==='number'?$('#nm_u').value.trim():'',kind:kd};det.metric=k}
      det.value=v;title=`${metric(det.metric).l} ${fmtM(det.metric,v)}`;if(!regs.size)regs.add('whole_body');
    }
    if(!title&&type==='food_trial'&&det.food)title='Reintroduced '+det.food.toLowerCase();
    if(!title)return err('Give it a short title.');
    const tm=$('#f_time').value;if(tm)det.time=tm;
    if(type==='observation'){const ed=$('#f_end_d').value,et=$('#f_end_t').value;if(ed||et){const sd=fd.get('occurred_at')||TODAY;if((ed||sd)<sd||((ed||sd)===sd&&et&&tm&&et<tm))return err('The end is before the start.');det.end_date=ed||sd;if(et)det.end_time=et}}
    const c=resolveConcern(fd.get('concern'),regs,fd.get('occurred_at'));if(c.err)return err(c.err);
    const entry={id:pre.id||uid(),type,occurred_at:fd.get('occurred_at')||TODAY,title,notes:fd.get('notes')||'',regions:[...regs],concern_id:c.id,parent_entry_id:pre.parent_entry_id||null,details:det,source:pre.source||'manual',photos:[...(pre.id?kept:(pre.photos||[])),...pending],files:[...keptFiles,...pfiles]};
    const i=D.entries.findIndex(x=>x.id===entry.id);if(i>=0)D.entries[i]=entry;else D.entries.push(entry);
    if(type==='appointment'){const k=D.courses.find(x=>x.id===det.course_id),rv=$('#f_reading').value,old=readingFor(entry.id);
      if(k&&k.metric&&rv!==''&&!isNaN(+rv)){const M=metric(k.metric),m={id:old?old.id:uid(),type:'measurement',occurred_at:entry.occurred_at,title:`${M.l} ${fmtV(+rv,M.u)}`,notes:'',regions:entry.regions.length?entry.regions:['whole_body'],concern_id:entry.concern_id,parent_entry_id:null,details:{metric:k.metric,value:+rv,from_appt:entry.id},source:'manual',photos:[]};if(old)Object.assign(old,m);else D.entries.push(m)}}
    if(pre.fromSuggestion){const s=D.suggestions.find(s=>s.id===pre.fromSuggestion);if(s)s.status='accepted'}
    save();closeSheet();V.frame=null;render();
  });
}
/* the regimen / diet form. Its stints (started, stopped, started again) are edited here; `again` opens a stopped one with a
   new open stint from today already added. Photos of the product sit under the log; right-click one to remove it. */
function openRegimen(pre,opts={}){
  const used=new Set(D.regimens.map(r=>r.color));let pick=pre.color||ALL_COLORS.filter((c,i)=>i%4>=1).find(c=>!used.has(c))||ALL_COLORS[1];
  const diet=pre.category==='diet',regs=new Set(pre.regions||(diet?['whole_body']:V.region?[V.region]:[])),again=!!opts.again;
  const stints=[...(pre.started_on?stintsOf(pre).map(p=>({...p})):[{from:TODAY,to:null}]),...(again?[{from:TODAY,to:null}]:[])];
  const photos=(pre.photos||[]).map(p=>({...p}));
  const stintsHTML=()=>stints.length===1?`<div class="f"><label for="st_from0">Started</label><input id="st_from0" type="date" data-stf="0" value="${esc(stints[0].from)}"></div><div class="f"><label for="st_to0">Stopped (leave blank if ongoing)</label><input id="st_to0" type="date" data-stt="0" value="${esc(stints[0].to||'')}"></div>`
    :`<div class="f" style="grid-column:1/-1"><span class="l">Stints</span><span class="s" style="font-size:12px;color:var(--muted)">Each time it was started and stopped. Stop the last one, or start it again below.</span><div class="list" id="stRows">${stints.map((p,i)=>`<div class="crow strow"><input type="date" data-stf="${i}" value="${esc(p.from)}" aria-label="Started"><input type="date" data-stt="${i}" value="${esc(p.to||'')}" aria-label="Stopped, blank if ongoing"><button type="button" class="rm" data-strm="${i}" aria-label="Remove this stint">✕</button></div>`).join('')}</div></div>`;
  const againBtn=()=>stints.every(p=>p.to)?`<div id="stAgain"><button type="button" class="btn-ghost btn-sm" id="stAgainBtn">+ Start again</button></div>`:'<div id="stAgain"></div>';
  const photosHTML=()=>photos.map((p,i)=>`<button type="button" class="thumb" style="width:72px;height:72px;border:0;padding:0" data-rpv="${i}" title="Click to see it, right-click to remove">${photoHTML(p,'Photo')}</button>`).join('');
  openSheet(`<div class="sheet-h"><h3>${ico(diet?'diet':'regimen')}${again?'Start again':`${pre.id?'Edit ':''}${diet?'Diet':'Regimen'}`}</h3><button class="x" type="button" aria-label="Close">✕</button></div>
  <form class="form" id="regForm" novalidate>${pre.id&&!diet?`<div>${remindBtn('regimen',pre.id)}</div>`:''}
   ${again?`<p class="story-p" style="margin:0">A new stint, from the start date you pick. Its earlier stints, its log and its colour stay with it, and it comes back to Active.</p>`:''}
   <div class="f"><label for="rg_name">${diet?'Describe the diet':'Name'}</label><input id="rg_name" value="${esc(pre.name||'')}" placeholder="${diet?'Mediterranean, or no alcohol':'Magnesium glycinate, morning stretches'}"></div>
   <div class="f2">${diet?'':`<div class="f"><label for="rg_cat">Kind</label><select id="rg_cat">${REG_CATS.map(([k,l])=>`<option value="${k}"${pre.category===k?' selected':''}>${l}</option>`).join('')}</select></div>
    <div class="f"><label for="rg_dose">Dose or amount</label><input id="rg_dose" value="${esc(pre.dose||'')}" placeholder="50 mg"></div>
    <div class="f"><label for="rg_freq">How often</label><input id="rg_freq" value="${esc(pre.frequency||'')}" placeholder="Daily, 3× a week"></div>`}
    <div id="stWrap" style="display:contents">${stintsHTML()}</div></div>${againBtn()}
   ${diet?'':`<div class="f"><span class="l">Body areas</span>${regionChips(regs)}</div><div class="f"><label for="f_concern">Concern</label>${concernSelect(pre.concern_id)}</div><div class="f" id="newConcernWrap" hidden><label for="f_newconcern">New concern name</label><input id="f_newconcern"></div>`}
   ${diet?'':`<div class="f2"><div class="f"><label for="rg_tc">Aim for (optional)</label><div style="display:flex;gap:8px"><input id="rg_tc" type="number" min="1" step="1" value="${esc((pre.target||{}).count||'')}" placeholder="2" style="width:80px"><select id="rg_tp">${['day','week','month'].map(v=>`<option value="${v}"${((pre.target||{}).per||'week')===v?' selected':''}>per ${v}</option>`).join('')}</select></div></div>
    <div class="f"><label for="rg_ms">Counts as done when</label><select id="rg_ms">${SOURCES.map(([v,l])=>`<option value="${v}"${((pre.match||{}).source||'manual')===v?' selected':''}>${l}</option>`).join('')}</select></div>
    <div class="f" id="rgMaWrap"${((pre.match||{}).source||'manual')==='manual'?' hidden':''}><label for="rg_ma">Of type</label><input id="rg_ma" value="${esc((pre.match||{}).activity||'')}" placeholder="Yoga, Run, Swim"></div></div>
    <p class="s" id="rgMaHint" style="font-size:12px;color:var(--muted);margin:0"${((pre.match||{}).source||'manual')==='manual'?' hidden':''}>This ticks itself off once that app is connected. Until then, tick it off yourself.</p>
    ${pre.id?`<div class="f"><label for="rg_chg">If you changed the dose or how often, the change started</label><input id="rg_chg" type="date" value="${TODAY}"></div>`:''}`}
   ${pre.id&&!diet&&(pre.changes||[]).length?`<div class="sec">Dose history</div><div class="list">${pre.changes.slice().sort((a,b)=>a.on<b.on?1:-1).map(c=>`<div class="row"><span><span class="t">${fmt(c.on)}</span><br><span class="s">${esc(c.prev_dose||'–')} → ${esc(c.dose||'–')}${c.frequency!==c.prev_frequency?` · ${esc(c.prev_frequency||'–')} → ${esc(c.frequency||'–')}`:''}</span></span></div>`).join('')}</div>`:''}
   ${pre.id&&!diet?`<div class="sec">Logged</div><div class="list" id="rgLogs">${logsOf(pre.id).slice(0,12).map(l=>`<div class="row"><span class="t">${fmt(l.on_date)}${l.source!=='manual'?` <span class="pill src">${esc(l.source)}</span>`:''}</span><button type="button" class="btn-ghost btn-sm" data-dellog="${l.id}">Remove</button></div>`).join('')||'<div class="empty">Nothing logged yet.</div>'}</div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><input type="date" id="rg_logd" class="inp" value="${TODAY}" aria-label="Day to log"><button type="button" class="btn-ghost btn-sm" id="rgLogAdd">+ Log this day</button></div>`:''}
   <div class="f"><label for="rg_ph">${diet?'Photos':'Photos of the product'}</label>${diet?'':'<span class="s" style="font-size:12px;color:var(--muted)">The pack, the label, the dose: for the record.</span>'}<input id="rg_ph" type="file" accept="image/*" multiple><div class="thumbs" id="rgThumbs">${photosHTML()}</div>${photos.length?'<span class="s" style="font-size:12px;color:var(--muted)">Right-click a photo to remove it.</span>':''}</div>
   <div class="f"><span class="l">Colour on charts</span><div class="list" id="rgCols"><div class="palrow hexrow" style="justify-content:flex-start;border:0;padding:0;margin:0 0 4px"><span style="width:80px">Custom</span><div style="align-items:center"><input type="color" id="rgHex" value="${pick}" aria-label="Pick any colour"><input class="inp" id="rgHexT" value="${pick}" maxlength="7" aria-label="Hex colour"></div></div>${PALETTES.map(([n,cs])=>`<div class="palrow" style="justify-content:flex-start"><span style="width:80px">${n}</span><div>${cs.map(col=>`<button type="button" class="sw${col===pick?' on':''}" style="background:${col}" data-rgcol="${col}" aria-label="${n} ${col}"></button>`).join('')}</div></div>`).join('')}</div></div>
   <div class="f"><label for="rg_notes">Notes</label><textarea id="rg_notes">${esc(pre.notes||'')}</textarea></div>
   ${diet&&(!pre.id||again)?`<div class="s" style="font-size:12px;color:var(--muted)">If another diet is current, it will be marked as stopped the day before this one starts.</div>`:''}
   <div class="form-acts"><span>${pre.id?'<button type="button" class="btn-ghost" id="rgDel">Delete</button>':''}</span><button type="submit" class="btn-accent">Save</button></div><div class="err" id="rgErr"></div></form>`);
  if(!diet){wireRegions(regs);$('#f_concern').addEventListener('change',e=>{$('#newConcernWrap').hidden=e.target.value!=='__new'})}
  // stints: typed dates land in the list; remove a row; start again adds an open stint from today
  const F=$('#regForm');
  const redrawStints=()=>{$('#stWrap').innerHTML=stintsHTML();$('#stAgain').outerHTML=againBtn();wireAgain()};
  const wireAgain=()=>{const b=$('#stAgainBtn');if(b)b.addEventListener('click',()=>{stints.push({from:TODAY,to:null});redrawStints()})};wireAgain();
  F.addEventListener('input',e=>{const f=e.target.closest('[data-stf]'),t=e.target.closest('[data-stt]');if(f)stints[+f.dataset.stf].from=f.value;if(t)stints[+t.dataset.stt].to=t.value||null});
  F.addEventListener('change',e=>{if(e.target.closest('[data-stt]')){$('#stAgain').outerHTML=againBtn();wireAgain()}});
  F.addEventListener('click',e=>{const r=e.target.closest('[data-strm]');if(r){stints.splice(+r.dataset.strm,1);if(!stints.length)stints.push({from:TODAY,to:null});redrawStints()}});
  // photos of the product
  $('#rg_ph').addEventListener('click',e=>{if(!vaultReady()){e.preventDefault();$('#rgErr').textContent='Turn on photo encryption first: Security, at the bottom of the page.'}});
  $('#rg_ph').addEventListener('change',async e=>{for(const f of e.target.files){if(f.type.startsWith('image/')){const src=await shrink(f);if(src)photos.push({src})}}$('#rgThumbs').innerHTML=photosHTML();e.target.value=''});
  $('#rgThumbs').addEventListener('click',e=>{const b=e.target.closest('[data-rpv]');if(b)openLightbox(photos[+b.dataset.rpv])});
  $('#rgThumbs').addEventListener('contextmenu',e=>{const b=e.target.closest('[data-rpv]');if(!b)return;e.preventDefault();photos.splice(+b.dataset.rpv,1);$('#rgThumbs').innerHTML=photosHTML()});
  $('#rgCols').addEventListener('click',e=>{const b=e.target.closest('[data-rgcol]');if(!b)return;pick=b.dataset.rgcol;$('#rgHex').value=pick;$('#rgHexT').value=pick;$('#rgCols').querySelectorAll('.sw').forEach(x=>x.classList.toggle('on',x===b))});
  const setHex=v=>{pick=v;$('#rgCols').querySelectorAll('.sw').forEach(x=>x.classList.toggle('on',x.dataset.rgcol===v))};
  $('#rgHex').addEventListener('input',e=>{$('#rgHexT').value=e.target.value;setHex(e.target.value)});
  $('#rgHexT').addEventListener('input',e=>{const v=e.target.value.trim();if(/^#[0-9a-f]{6}$/i.test(v)){$('#rgHex').value=v;setHex(v)}});
  if(!diet){$('#rg_ms').addEventListener('change',e=>{const man=e.target.value==='manual';$('#rgMaWrap').hidden=man;$('#rgMaHint').hidden=man})}
  if(pre.id&&!diet){
    $('#rgLogs').addEventListener('click',e=>{const b=e.target.closest('[data-dellog]');if(!b)return;D.regLogs=D.regLogs.filter(l=>l.id!==b.dataset.dellog);save();render();openRegimen(D.regimens.find(r=>r.id===pre.id))});
    $('#rgLogAdd').addEventListener('click',()=>{D.regLogs.push({id:'rl-'+uid(),regimen_id:pre.id,on_date:$('#rg_logd').value||TODAY,time:null,source:'manual',note:''});save();render();openRegimen(D.regimens.find(r=>r.id===pre.id))});
  }
  if(pre.id)$('#rgDel').addEventListener('click',()=>{D.regimens=D.regimens.filter(r=>r.id!==pre.id);D.regLogs=(D.regLogs||[]).filter(l=>l.regimen_id!==pre.id);save();closeSheet();render()});
  $('#regForm').addEventListener('submit',e=>{e.preventDefault();const err=m=>{$('#rgErr').textContent=m};const name=$('#rg_name').value.trim();if(!name)return err(diet?'Describe the diet.':'Give it a name.');
    if(stints.some(p=>!p.from))return err('Each stint needs a start date.');
    if(stints.some(p=>p.to&&p.to<p.from))return err('A stop date is before its start date.');
    const ss=stints.map(p=>({from:p.from,to:p.to||null})).sort((a,b)=>a.from<b.from?-1:1);
    for(let i=0;i+1<ss.length;i++)if(!ss[i].to||ss[i].to>=ss[i+1].from)return err('The stints overlap: stop one before the next starts.');
    const from=ss[0].from;
    let cid=pre.concern_id||null;if(!diet){const c=resolveConcern($('#f_concern').value,regs,from);if(c.err)return err(c.err);cid=c.id}
    const nd=diet?'':$('#rg_dose').value.trim(),nf=diet?'':$('#rg_freq').value.trim(),changes=[...(pre.changes||[])];
    if(pre.id&&!diet&&(nd!==(pre.dose||'')||nf!==(pre.frequency||''))){changes.push({on:$('#rg_chg').value||TODAY,dose:nd,frequency:nf,prev_dose:pre.dose||'',prev_frequency:pre.frequency||''});changes.sort((a,b)=>a.on<b.on?-1:1)}
    const tc=diet?0:+$('#rg_tc').value,target=tc>0?{count:tc,per:$('#rg_tp').value}:null;
    const ms=diet?'manual':$('#rg_ms').value,match=diet||ms==='manual'?{source:'manual'}:{source:ms,activity:$('#rg_ma').value.trim()};
    const r={id:pre.id||'r-'+uid(),name,category:diet?'diet':$('#rg_cat').value,dose:nd,frequency:nf,started_on:from,ended_on:null,regions:[...regs],concern_id:cid,notes:$('#rg_notes').value,color:pick,target,match,changes,...(photos.length?{photos}:{})};
    setStints(r,ss);
    // one diet at a time: another diet still open when this one's open stint starts is stopped the day before
    const open=diet?ss.find(p=>!p.to):null;
    if(open)D.regimens.forEach(x=>{if(x.id===r.id||x.category!=='diet'||regimenStopped(x,open.from))return;const xs=stintsOf(x),last=xs[xs.length-1];if(!last.to&&last.from<open.from)setStints(x,[...xs.slice(0,-1),{from:last.from,to:addDays(open.from,-1)}])});
    const i=D.regimens.findIndex(x=>x.id===r.id);if(i>=0)D.regimens[i]=r;else D.regimens.push(r);save();closeSheet();render()});
}
function openChallenge(pre={}){
  const rs=D.regimens.filter(r=>r.category!=='diet'&&(regimenActive(r)||(pre.regimen_ids||[]).includes(r.id)));
  const rules=pre.rules||[];let nRows=Math.max(2,rules.length);
  const rv=r=>!r?'':r.kind==='photo'?'p:'+r.region:r.kind==='regimen'?'g:'+r.regimen:'m:'+r.metric;
  const opt=(v,cur,l)=>`<option value="${v}"${v===cur?' selected':''}>${esc(l)}</option>`;
  const ruleRow=i=>{const r=rules[i],v=rv(r),per=r?r.per:'week';
    return `<div class="f2" style="grid-template-columns:minmax(0,1.4fr) minmax(0,1fr)"><div class="f"><label for="cr_w${i}">Check-in ${i+1}</label><select id="cr_w${i}" data-crw="${i}"><option value="">None</option><optgroup label="Photo of">${Object.entries(REG()).map(([k,l])=>opt('p:'+k,v,l+' photo')).join('')}</optgroup><optgroup label="Measurement">${Object.entries(D.metrics).map(([k,m])=>opt('m:'+k,v,m.l)).join('')}</optgroup><optgroup label="Logged from Lifestyle">${rs.map(r=>opt('g:'+r.id,v,r.name)).join('')}</optgroup></select></div><div class="f"><label for="cr_p${i}">How often</label><select id="cr_p${i}">${['day','week','month'].map(p=>opt(p,per,PER_LABEL[p])).join('')}</select></div></div>`};
  const sel=new Set(pre.regimen_ids||[]);
  openSheet(`<div class="sheet-h"><h3>${ico('challenge')}${pre.id?'Edit challenge':'Start a challenge'}</h3><button class="x" type="button" aria-label="Close">✕</button></div>
  <form class="form" id="chForm" novalidate><div class="f"><label for="ch_t">Name</label><input id="ch_t" value="${esc(pre.title||'')}" placeholder="90 days of iron"></div>
   <div class="f2"><div class="f"><label for="ch_s">Starts</label><input id="ch_s" type="date" value="${esc(pre.started_on||TODAY)}"></div><div class="f"><label for="ch_d">Length in days</label><input id="ch_d" type="number" min="1" max="730" step="1" value="${esc(pre.days||90)}" list="chLens"><datalist id="chLens"><option value="14"><option value="30"><option value="60"><option value="90"><option value="180"><option value="365"></datalist></div></div>
   ${rs.length?`<div class="f"><span class="l">Regimens that are part of it</span><div class="chips" id="chRegs">${rs.map(r=>`<button type="button" class="chip${sel.has(r.id)?' on':''}" data-chr="${r.id}">${esc(r.name)}</button>`).join('')}</div></div>`:''}
   <div id="chRules">${Array.from({length:nRows},(_,i)=>ruleRow(i)).join('')}</div><button type="button" class="btn-ghost btn-sm" id="chAddRule" style="align-self:flex-start">+ Check-in</button>
   <div class="f"><label for="ch_n">Notes (optional)</label><textarea id="ch_n" placeholder="Why you're doing it, what you're watching for">${esc(pre.notes||'')}</textarea></div>
   <div class="form-acts"><span></span><button type="submit" class="btn-accent">${pre.id?'Save':'Start'}</button></div><div class="err" id="chErr"></div></form>`);
  const cr=$('#chRegs');cr&&cr.addEventListener('click',e=>{const b=e.target.closest('[data-chr]');if(!b)return;sel.has(b.dataset.chr)?sel.delete(b.dataset.chr):sel.add(b.dataset.chr);b.classList.toggle('on')});
  $('#chAddRule').addEventListener('click',()=>{$('#chRules').insertAdjacentHTML('beforeend',ruleRow(nRows));nRows++});
  $('#chForm').addEventListener('submit',e=>{e.preventDefault();const t=$('#ch_t').value.trim();if(!t){$('#chErr').textContent='Name the challenge.';return}
    if(!(+$('#ch_d').value>0)){$('#chErr').textContent='Set a length in days.';return}
    const rules=[...document.querySelectorAll('[data-crw]')].map(s=>{const i=s.dataset.crw,w=s.value;if(!w)return null;const per=$('#cr_p'+i).value;const [k,v]=w.split(':');
      return k==='p'?{label:`${rl(v)} photo`,kind:'photo',region:v,per}:k==='g'?{label:(D.regimens.find(r=>r.id===v)||{}).name||'Regimen',kind:'regimen',regimen:v,per}:{label:metric(v).l,kind:'metric',metric:v,per}}).filter(Boolean);
    upsertExp({...pre,id:pre.id||'ch-'+uid(),kind:'challenge',title:t,started_on:$('#ch_s').value||TODAY,days:+$('#ch_d').value,regimen_ids:[...sel],rules,notes:$('#ch_n').value.trim(),config:pre.config||{}})});
}
/* ---------- Concerns tab, laid out like Lifestyle: General, Illnesses, the Archive with a search, and courses of care tied to
   nothing. A page per concern; an illness page shows its episodes. ---------- */
const CONCERN_INFO='A concern is something you are keeping an eye on: a mole, hair thinning, knee pain. It sits on a place on the body and has one stretch, from when you noticed it until you mark it resolved.\n\nAn illness comes in bouts: a cold, a stomach bug, a flare-up. One record per kind (Viral, Bacterial, or a condition of your own, like Lupus), an episode each time, so you can see how often and how long.\n\nA course of care is recurring treatment for one of these: physio, laser sessions, a specialist. Add it from the concern\'s or illness\'s page, and it lives there.';
function openConcern(id){closeSheet();V.tab='concerns';V.concernPage=id;V.exp=null;V.customizing=false;render();window.scrollTo({top:0})}
function concernCard(c){
  const ill=isIllness(c),col=ill?colorOf(illnessColor(c),'var(--t-illness)'):'var(--t-observation)';
  const n=D.entries.filter(e=>e.concern_id===c.id).length,ks=D.courses.filter(k=>k.concern_id===c.id).length,bits=xs=>xs.filter(Boolean).join(' · ');
  let l1='',l2='';
  if(ill){const eps=episodesOf(c),last=eps[eps.length-1],days=sickDaysThisYear(c);l1=bits([`${eps.length} ${eps.length===1?'episode':'episodes'}`,`${days} ${days===1?'day':'days'} this year`,c.regions.map(rl).join(', ')]);l2=last?`Last: ${episodeTitle(c,last)}, ${fmtShort(last.from)}${last.to?` – ${fmtShort(last.to)}`:', still on'}`:''}
  else{l1=bits([c.regions.map(rl).join(', '),c.started_on?`since ${fmt(c.started_on)}`:'',c.resolved_on?`resolved ${fmt(c.resolved_on)}`:'']);l2=bits([`${n} ${n===1?'entry':'entries'}`,ks?`${ks} ${ks===1?'course of care':'courses of care'}`:''])}
  const pill=ill?(sickOn(c)?['up','Sick now']:['mut','Well']):c.status==='resolved'?['mut','Resolved']:['up','Active'];
  return `<button type="button" class="rcard lcard" data-concern="${c.id}" style="border-left:4px solid ${col}"><span style="display:flex;gap:10px;align-items:center"><i class="dot" style="background:${col};width:12px;height:12px"></i><span class="t" style="flex:1">${esc(c.title)}</span><span class="pill ${pill[0]}">${pill[1]}</span></span>${l1?`<span class="s">${esc(l1)}</span>`:''}${l2?`<span class="s">${esc(l2)}</span>`:''}</button>`;
}
function viewConcerns(){
  if(V.concernPage){const c=D.concerns.find(x=>x.id===V.concernPage);if(c)return concernPage(c);V.concernPage=null}
  const general=D.concerns.filter(c=>!isIllness(c)),active=general.filter(c=>c.status!=='resolved').sort((a,b)=>(a.started_on||'')<(b.started_on||'')?1:-1);
  const ills=illnesses().sort((a,b)=>(sickOn(b)-sickOn(a))||((a.resolved_on||'9999')<(b.resolved_on||'9999')?1:-1));
  const past=general.filter(c=>c.status==='resolved').sort((a,b)=>(a.resolved_on||'')<(b.resolved_on||'')?1:-1);
  const needle=(V.concQ||'').trim().toLowerCase(),shown=past.filter(c=>!needle||[c.title,c.notes||'',...c.regions.map(rl)].join(' ').toLowerCase().includes(needle));
  const loose=D.courses.filter(k=>!k.concern_id||!D.concerns.some(c=>c.id===k.concern_id)),sick=ills.filter(sickOn).length;
  return `<div class="page-h" style="margin-bottom:16px"><h1>Concerns</h1>${infoBtn('Concerns, illnesses and courses of care',CONCERN_INFO)}</div>
  <div style="display:flex;flex-direction:column;gap:16px">
  <section class="card"><div class="card-h"><h2>General <span class="sub">${active.length}</span></h2>${plusBtn('add-concern','Add a concern')}</div><div class="rgrid">${active.map(concernCard).join('')||'<div class="empty">Nothing you are keeping an eye on right now.</div>'}</div></section>
  <section class="card"><div class="card-h"><h2>Illnesses <span class="sub">${ills.length?(sick?`${ills.length} · ${sick} sick now`:ills.length):''}</span></h2>${plusBtn('add-illness','Add an illness')}</div><div class="rgrid">${ills.map(concernCard).join('')||'<div class="empty">Nothing yet. A cold, a bug, a flare-up: each bout is dated, so you can see how often and how long.</div>'}</div></section>
  <section class="card"><div class="card-h"><h2>Archive <span class="sub">${past.length}</span></h2></div>${past.length>3?`<input class="inp" id="concQ" value="${esc(V.concQ||'')}" placeholder="Find by name, area or notes" style="max-width:320px;margin-bottom:12px">`:''}<div class="rgrid">${shown.map(concernCard).join('')||`<div class="empty">${past.length?'Nothing matches.':'Nothing resolved yet.'}</div>`}</div></section>
  ${loose.length?`<section class="card"><div class="card-h"><h2>Courses of care not tied to anything <span class="sub">${loose.length}</span></h2></div><p class="story-p">A course of care belongs on a concern's or illness's page. Open one to pick what it treats.</p><div class="kgrid">${loose.map(k=>courseCard(k)+`<div style="margin:-8px 0 8px"><button type="button" class="btn-ghost btn-sm" data-kedit="${k.id}">Tie it to a concern</button></div>`).join('')}</div></section>`:''}</div>`;
}
function concernPage(c){
  const es=D.entries.filter(e=>e.concern_id===c.id).sort(byDateDesc()),regs=D.regimens.filter(r=>r.concern_id===c.id),ks=D.courses.filter(k=>k.concern_id===c.id);
  const photos=es.filter(e=>e.photos.length&&e.details.series!=='body'),last=es[0],t=c.tracking||{},due=dueMetrics(c);
  const ill=isIllness(c),eps=ill?episodesOf(c):[],open=ill?openEpisode(c):null,col=ill?colorOf(illnessColor(c),'var(--t-illness)'):'';
  const facts=ill?`<dt>Episodes</dt><dd>${eps.length}${c.started_on?` · first ${fmt(c.started_on)}`:''}</dd><dt>This year</dt><dd>${sickDaysThisYear(c)} ${sickDaysThisYear(c)===1?'day':'days'} in ${episodesThisYear(c)} ${episodesThisYear(c)===1?'episode':'episodes'}</dd>`
    :`<dt>Since</dt><dd>${c.started_on?fmt(c.started_on):'–'}</dd>${c.resolved_on?`<dt>Resolved</dt><dd>${fmt(c.resolved_on)}</dd>`:''}`;
  const acts=`${ill?`<button type="button" class="btn-accent btn-sm" data-ca="episode">+ Episode</button>${open?'<button type="button" class="btn-ghost btn-sm" data-ca="better">Better today</button>':''}<button type="button" class="btn-ghost btn-sm" data-ca="note">+ Note</button>`:`<button type="button" class="btn-accent btn-sm" data-ca="checkin">+ Check in</button>`}
    <button type="button" class="btn-ghost btn-sm" data-ca="photo">+ Photo</button>${ill?'':`<button type="button" class="btn-ghost btn-sm" data-ca="status">${c.status==='resolved'?'Reopen':'Mark resolved'}</button>`}${es.filter(x=>x.type==='observation').length>1?`<button type="button" class="btn-ghost btn-sm" data-ca="before">What came before</button>`:''}<button type="button" class="btn-ghost btn-sm" data-ca="timeline">In History</button><button type="button" class="btn-ghost btn-sm${V.concEdit?' on':''}" data-ca="edit">Edit</button>`;
  const edit=V.concEdit?`<form class="form" id="ceForm" style="margin-top:12px;background:var(--soft);border-radius:14px;padding:12px" novalidate><div class="f"><label for="ce_t">Name</label><input id="ce_t" value="${esc(c.title)}"></div>${ill?'':`<div class="f"><label for="ce_s">Since</label><input id="ce_s" type="date" value="${esc(c.started_on||'')}"></div>`}<div class="f"><label for="ce_n">Notes</label><textarea id="ce_n">${esc(c.notes||'')}</textarea></div>
    ${ill?`<div class="f"><span class="l">Colour on charts and History</span><div class="list" id="ceCols">${PALETTES.map(([n,cs])=>`<div class="palrow" style="justify-content:flex-start"><span style="width:80px">${n}</span><div>${cs.map(cc=>`<button type="button" class="sw${cc===c.color?' on':''}" style="background:${cc}" data-ccol="${cc}" aria-label="${n} ${cc}"></button>`).join('')}</div></div>`).join('')}</div></div>`:''}
    <div class="form-acts"><span>${ill?`<button type="button" class="btn-ghost" data-ca="delete">Delete illness</button>`:''}</span><button class="btn-accent" type="submit">Save</button></div></form>`:'';
  const episodes=ill?`<div class="sec" style="margin-top:16px">Episodes</div><div class="list">${eps.map((e,i)=>({e,i})).reverse().map(({e,i})=>`<button type="button" class="row" data-episode="${i}"><span style="display:flex;gap:10px;align-items:stretch;min-width:0"><i style="width:5px;border-radius:3px;background:${col};opacity:${e.to?.55:1};flex:none"></i><span><span class="t">${esc(episodeTitle(c,e))}</span><br><span class="s">${fmtShort(e.from)} – ${e.to?fmtShort(e.to):'still on'} · ${episodeDays(e)} ${episodeDays(e)===1?'day':'days'}${e.notes?' · '+esc(e.notes):''}</span></span></span>${e.to?'':'<span class="pill up">Now</span>'}</button>`).join('')||'<div class="empty">No episodes yet. Use + Episode to add the first.</div>'}</div>`:'';
  const plan=`<div class="sec" style="margin-top:16px">Check-in plan</div><div class="row" style="align-items:flex-start">${(t.metrics||[]).length?`<span><span class="t">${t.metrics.filter(k=>D.metrics[k]).map(k=>esc(metric(k).l)).join(', ')}</span><br><span class="s">${esc(PER_LABEL[t.per||'week'])}${due.length?' · due now':' · done for now'}</span></span>`:`<span class="s">Pick the measures you want to track for this and how often. Check-ins then show up when they're due.</span>`}<button type="button" class="btn-ghost btn-sm" data-ca="plan">${(t.metrics||[]).length?'Change':'Set up'}</button></div>
   ${V.planEdit?`<div class="f" style="margin-top:10px;background:var(--soft);border-radius:14px;padding:12px"><span class="l">Measures to check in</span><div class="chips" id="peChips">${Object.entries(D.metrics).map(([mk,m])=>`<button type="button" class="chip${(t.metrics||[]).includes(mk)?' on':''}" data-pm="${mk}">${esc(m.l)}</button>`).join('')}</div>
    <div class="f2" style="margin-top:10px"><div class="f"><label for="pe_new">Or a new measure</label><input id="pe_new" placeholder="e.g. Energy, lump size"></div><div class="f"><label for="pe_k">It's…</label><select id="pe_k">${KIND_OPTS.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></div><div class="f"><label for="pe_u">Unit (numbers only)</label><input id="pe_u" placeholder="mm, kg"></div><div class="f"><label for="pe_per">How often</label><select id="pe_per">${Object.entries(PER_LABEL).map(([v,l])=>`<option value="${v}"${(t.per||'week')===v?' selected':''}>${l}</option>`).join('')}</select></div></div>
    <div class="form-acts"><span></span><button type="button" class="btn-accent btn-sm" data-ca="plan-save">Save plan</button></div></div>`:''}<div style="margin-top:8px">${remindBtn('concern',c.id)}</div>`;
  return `<button type="button" class="linkish backl" data-act="conc-back">‹ Concerns</button>
   <div class="page-h" style="margin-bottom:12px"><div style="display:flex;gap:10px;align-items:center">${ico(ill?'illness':'observation')}<h1>${esc(c.title)}</h1>${ill?`<i class="dot" style="background:${col};width:14px;height:14px"></i>`:''}</div></div>
   <section class="card"><div class="chips" style="margin-bottom:12px"><span class="pill ${ill?(sickOn(c)?'up':'mut'):c.status==='resolved'?'mut':'up'}">${ill?(sickOn(c)?'Sick now':'Well'):c.status==='resolved'?'Resolved':'Active'}</span>${c.regions.map(r=>`<span class="pill">${esc(rl(r))}</span>`).join('')}</div>
   <dl class="kv">${facts}<dt>Entries</dt><dd>${es.length}${last?` · last ${ago(last.occurred_at)}`:''}</dd>${c.notes?`<dt>Notes</dt><dd>${esc(c.notes)}</dd>`:''}</dl>
   <div class="form-acts" style="margin:14px 0 4px;justify-content:flex-start">${acts}</div>${edit}${episodes}${plan}
   ${photos.length?`<div class="sec" style="margin-top:16px">Photos</div><div class="thumbs">${photos.slice(0,12).map(e=>`<button type="button" class="thumb" style="width:84px;height:100px;border:0;padding:0" data-entry="${e.id}">${photoHTML(e.photos[0],e.title,e.occurred_at)}</button>`).join('')}</div>`:''}
   ${regs.length?`<div class="sec" style="margin-top:16px">Regimens for this</div><div class="list">${regs.map(r=>`<button type="button" class="row" data-regimen="${r.id}"><span><span class="t">${esc(r.name)}</span><br><span class="s">${esc([r.dose,r.frequency].filter(Boolean).join(' · '))} · ${fmtShort(r.started_on)} – ${r.ended_on?fmtShort(r.ended_on):'ongoing'}</span></span></button>`).join('')}</div>`:''}
   <div class="sec" style="margin-top:16px;display:flex;align-items:center;justify-content:space-between">Courses of care <button type="button" class="btn-ghost btn-sm" data-ca="course" style="text-transform:none;letter-spacing:0">+ Course</button></div>
   ${ks.length?`<div class="kgrid">${ks.map(courseCard).join('')}</div>`:'<p class="s" style="font-size:12.5px;color:var(--muted);margin:0">Recurring treatment for this: physio, laser sessions, a specialist. Each session is an appointment with what was done and what it cost.</p>'}
   <div class="sec" style="margin-top:16px">Everything recorded</div><div>${es.map(entryRow).join('')||'<div class="empty">Nothing linked yet. Use Check in to add the first entry.</div>'}</div></section>`;
}
/* the concern page's actions, by data-ca */
function concernAction(k,el){
  const c=D.concerns.find(x=>x.id===V.concernPage);if(!c)return;const id=c.id;
  if(k==='checkin'){((c.tracking||{}).metrics||[]).length?openCheckin([id]):openForm('observation',{concern_id:id,regions:c.regions,title:''})}
  if(k==='note')openForm('observation',{concern_id:id,regions:c.regions,title:''});
  if(k==='episode')openEpisodeSheet(id,null);
  if(k==='better'){endEpisodeToday(id);render()}
  if(k==='photo'){if(!needVault())openForm('photo',{concern_id:id,regions:c.regions})}
  if(k==='status'){c.status=c.status==='resolved'?'active':'resolved';c.resolved_on=c.status==='resolved'?TODAY:null;save();render()}
  if(k==='before')openBeforeConcern(id);
  if(k==='timeline'){V.concern=id;V.tab='timeline';V.type='all';V.histView='list';render();window.scrollTo({top:0})}
  if(k==='edit'){V.concEdit=!V.concEdit;render()}
  if(k==='course')openCourseForm({concern_id:id});
  if(k==='plan'){V.planEdit=!V.planEdit;render()}
  if(k==='plan-save'){const sel=new Set([...document.querySelectorAll('#peChips .chip.on')].map(b=>b.dataset.pm)),nm=$('#pe_new').value.trim();
    if(nm){const kd=$('#pe_k').value,mk='x_'+uid();D.metrics[mk]=kd==='rating'?{l:nm,u:'/5',kind:'rating',rating:true}:{l:nm,u:kd==='number'?$('#pe_u').value.trim():'',kind:kd};sel.add(mk)}
    c.tracking=sel.size?{metrics:[...sel],per:$('#pe_per').value}:{};V.planEdit=false;save();render()}
  if(k==='delete'){if(!el.dataset.armed){el.dataset.armed='1';el.textContent='Click again to delete';return}D.concerns=D.concerns.filter(x=>x.id!==id);V.concernPage=null;V.concEdit=false;save();render()}
}
/* ---------- illnesses: the new-illness sheet picks or names the group, labels the bout and dates it; the episode sheet edits one bout ---------- */
const mkEpisode=(from,to,label,notes)=>({from,to:to||null,...(label.trim()?{label:label.trim()}:{}),...(notes.trim()?{notes:notes.trim()}:{})});
function endEpisodeToday(cid){const c=D.concerns.find(x=>x.id===cid);if(!c)return;const eps=episodesOf(c).map(e=>({...e})),o=eps.find(e=>!e.to);if(o)o.to=TODAY;setEpisodes(c,eps);save()}
const labelField=(val)=>{const recent=recentLabels().slice(0,8);return `<div class="f"><label for="il_l">What it was (optional)</label><input id="il_l" value="${esc(val||'')}" placeholder="Cold, flu, norovirus, flare">${recent.length?`<div class="chips" id="ilRecent">${recent.map(l=>`<button type="button" class="chip sm${(val||'').trim().toLowerCase()===l.toLowerCase()?' on':''}" data-il="${esc(l)}">${esc(l)}</button>`).join('')}</div>`:''}</div>`};
const wireLabelChips=()=>{const b=$('#ilRecent');if(b)b.addEventListener('click',e=>{const x=e.target.closest('[data-il]');if(!x)return;$('#il_l').value=x.dataset.il;b.querySelectorAll('.chip').forEach(y=>y.classList.toggle('on',y===x))})};
function openIllnessNew(pre={}){
  const groups=illnesses(),names=[...groups.map(c=>c.title),...ILLNESS_GROUPS.filter(g=>!groups.some(c=>c.title.trim().toLowerCase()===g.toLowerCase()))];
  let group=pre.group||(groups[0]?groups[0].title:''),own=false;const regs=new Set();
  openSheet(`<div class="sheet-h"><h3>${ico('illness')}Illness</h3><button class="x" type="button" aria-label="Close">✕</button></div>
   <form class="form" id="ilForm" novalidate><div class="f"><span class="l">What kind</span><div class="chips" id="ilGroups">${names.map(n=>`<button type="button" class="chip${group.trim().toLowerCase()===n.toLowerCase()?' on':''}" data-g="${esc(n)}">${esc(n)}</button>`).join('')}<button type="button" class="chip" data-g="__own">+ Your own</button></div><input id="il_own" placeholder="Lupus, Migraine, Allergies" hidden><span class="s" style="font-size:12px;color:var(--muted)">Viral and bacterial are causes. A condition you live with gets its own name, so its flare-ups stack beside them on a chart.</span></div>
   ${labelField('')}
   <div class="f2"><div class="f"><label for="il_from">Started</label><input id="il_from" type="date" value="${TODAY}"></div><div class="f"><label for="il_to">Ended (blank while still on)</label><input id="il_to" type="date"></div></div>
   <div class="f"><button type="button" class="btn-ghost btn-sm" id="ilWhere" style="align-self:flex-start">Where it shows (optional)</button><div id="ilRegs" hidden>${regionChips(regs)}</div></div>
   <div class="f"><label for="il_n">Notes</label><textarea id="il_n"></textarea></div>
   <div class="form-acts"><span></span><button class="btn-accent" type="submit">Save</button></div><div class="err" id="ilErr"></div></form>`);
  wireLabelChips();wireRegions(regs);
  $('#ilGroups').addEventListener('click',e=>{const b=e.target.closest('[data-g]');if(!b)return;own=b.dataset.g==='__own';if(!own)group=b.dataset.g;$('#il_own').hidden=!own;if(own)$('#il_own').focus();$('#ilGroups').querySelectorAll('.chip').forEach(x=>x.classList.toggle('on',x===b))});
  $('#ilWhere').addEventListener('click',()=>{$('#ilRegs').hidden=false;$('#ilWhere').hidden=true});
  $('#ilForm').addEventListener('submit',e=>{e.preventDefault();const err=m=>{$('#ilErr').textContent=m};const g=(own?$('#il_own').value:group).trim();if(!g)return err(own?'Name the group.':'Pick a group.');
    const from=$('#il_from').value,to=$('#il_to').value;if(!from)return err('When did it start?');if(to&&to<from)return err("It can't end before it starts.");
    const ep=mkEpisode(from,to,$('#il_l').value,$('#il_n').value);
    let c=illnesses().find(x=>x.title.trim().toLowerCase()===g.toLowerCase());
    if(c&&episodeClash(episodesOf(c),ep))return err(`That overlaps another ${c.title} episode. Edit that one from its page instead.`);
    if(!c){c={id:'c-'+uid(),title:g,regions:[],started_on:null,resolved_on:null,status:'active',kind:'illness',episodes:[],tracking:{}};D.concerns.push(c)}
    setEpisodes(c,[...episodesOf(c),ep]);if(regs.size)c.regions=[...new Set([...(c.regions||[]),...regs])];
    save();openConcern(c.id)});
}
function openEpisodeSheet(cid,index){
  const c=D.concerns.find(x=>x.id===cid);if(!c)return;const eps=episodesOf(c),e=index!=null?eps[index]:null;
  openSheet(`<div class="sheet-h"><h3>${ico('illness')}${e?`${esc(c.title)} episode`:`New ${esc(c.title)} episode`}</h3><button class="x" type="button" aria-label="Close">✕</button></div>
   <form class="form" id="epForm" novalidate>${labelField(e?e.label:'')}
   <div class="f2"><div class="f"><label for="il_from">Started</label><input id="il_from" type="date" value="${esc(e?e.from:TODAY)}"></div><div class="f"><label for="il_to">Ended (blank while still on)</label><input id="il_to" type="date" value="${esc(e&&e.to?e.to:'')}"></div></div>
   <div class="f"><label for="il_n">Notes</label><textarea id="il_n" placeholder="How it went, what you took">${esc(e&&e.notes?e.notes:'')}</textarea></div>
   <div class="form-acts"><span>${e?'<button type="button" class="btn-ghost" id="epDel">Remove episode</button>':''}</span><button class="btn-accent" type="submit">Save</button></div>${e&&eps.length===1?'<p class="s" style="font-size:12px;color:var(--muted);margin:0">Removing the only episode removes the illness too.</p>':''}<div class="err" id="ilErr"></div></form>`);
  wireLabelChips();
  if(e)$('#epDel').addEventListener('click',ev=>{const b=ev.target;if(!b.dataset.armed){b.dataset.armed='1';b.textContent='Click again to remove';return}const list=episodesOf(c).filter((_,i)=>i!==index);if(list.length)setEpisodes(c,list);else{D.concerns=D.concerns.filter(x=>x.id!==c.id);V.concernPage=null}save();closeSheet();render()});
  $('#epForm').addEventListener('submit',ev=>{ev.preventDefault();const err=m=>{$('#ilErr').textContent=m};const from=$('#il_from').value,to=$('#il_to').value;if(!from)return err('When did it start?');if(to&&to<from)return err("It can't end before it starts.");
    const ep=mkEpisode(from,to,$('#il_l').value,$('#il_n').value);if(episodeClash(eps,ep,index==null?-1:index))return err('That overlaps another episode.');
    const list=eps.map(x=>({...x}));if(index!=null)list[index]=ep;else list.push(ep);setEpisodes(c,list);save();closeSheet();render()});
}
/* ---------- the health card: blood type, preferred units (saved at once), allergies, vaccinations, conditions, the active providers, contacts ---------- */
function openCard(){
  const c=JSON.parse(JSON.stringify((D.settings&&D.settings.card)||{}));
  const meds=D.regimens.filter(r=>(r.category==='medication'||r.category==='supplement')&&regimenActive(r)),u=unitPref(),ps=activeProviders();
  const rowHTML=(fields,v={})=>`<div class="crow">${fields.map(([k,l,t,o])=>t==='select'?`<select data-f="${k}" aria-label="${esc(l)}">${o.map(([ov,ol])=>`<option value="${ov}"${(v[k]||'')===ov?' selected':''}>${ol}</option>`).join('')}</select>`:`<input data-f="${k}" type="${t==='date'?'date':'text'}" placeholder="${esc(l)}" aria-label="${esc(l)}" value="${esc(v[k]||'')}">`).join('')}<button type="button" class="rm" data-crm aria-label="Remove">✕</button></div>`;
  const seg=(k,opts,cur)=>`<div class="seg sm">${opts.map(([v,l])=>`<button type="button" data-hcunit="${k}|${v}" class="${cur===v?'on':''}">${l}</button>`).join('')}</div>`;
  openSheet(`<div class="sheet-h"><h3>Health card</h3><button class="x" type="button" aria-label="Close">✕</button></div>
   <p class="story-p">The fixed facts about you. Things that change over time, like weight, stay as measurements.</p>
   <div class="f"><label for="hc_blood">Blood type</label><select id="hc_blood">${BLOOD.map(b=>`<option value="${b}"${(c.blood||'')===b?' selected':''}>${b||'–'}</option>`).join('')}</select></div>
   <div class="f" style="margin-top:12px"><span class="l">Preferred units</span><div style="display:flex;gap:16px;flex-wrap:wrap"><span class="s" style="display:flex;gap:8px;align-items:center">Weight ${seg('weight',[['kg','Kilograms'],['lb','Pounds']],u.weight)}</span><span class="s" style="display:flex;gap:8px;align-items:center">Height ${seg('height',[['cm','Centimetres'],['ft','Feet, inches']],u.height)}</span></div><span class="s" style="font-size:12px;color:var(--muted)">How weight and height are entered and shown everywhere, charts included. Underneath they are kept in kilograms and centimetres, so switching changes nothing. Saved at once.</span></div>
   ${CARD_SECS.filter(s=>s[0]!=='providers').map(([k,l,f])=>`<div class="sec" style="margin-top:16px">${l}</div><div class="list" data-sec="${k}">${(c[k]||[]).map(v=>rowHTML(f,v)).join('')}</div><button type="button" class="btn-ghost btn-sm" data-cadd="${k}" style="margin-top:6px">+ Add</button>`).join('')}
   <div class="sec" style="margin-top:16px;display:flex;justify-content:space-between;align-items:center">Active providers <button type="button" class="btn-ghost btn-sm" data-pvadd style="text-transform:none;letter-spacing:0">+ Add a provider</button></div>
   <div class="list">${ps.map(p=>`<button type="button" class="row" data-pv="${esc(p.id)}"><span style="display:flex;gap:10px;align-items:center;min-width:0">${providerAvatar(p,36)}<span><span class="t">${esc(p.name)}</span><br><span class="s">${esc([p.role,p.practice].filter(Boolean).join(' · '))}</span></span></span></button>`).join('')||'<div class="empty">None yet. Everyone you see, so appointments can pick them.</div>'}</div>
   <div class="sec" style="margin-top:16px">Current medications and supplements</div><div class="list">${meds.map(r=>`<div class="row"><span><span class="t">${esc(r.name)}</span><br><span class="s">${esc([r.dose,r.frequency].filter(Boolean).join(' · '))}</span></span></div>`).join('')||'<div class="empty">None active. These come from Lifestyle.</div>'}</div>
   <div class="form-acts" style="margin-top:16px"><span></span><button class="btn-accent" type="button" id="hcSave">Save</button></div>`);
  const sheet=$('#overlay').querySelector('.sheet');
  sheet.addEventListener('click',e=>{const a=e.target.closest('[data-cadd]');if(a){const sec=CARD_SECS.find(s=>s[0]===a.dataset.cadd);sheet.querySelector(`[data-sec="${sec[0]}"]`).insertAdjacentHTML('beforeend',rowHTML(sec[2]))}
    const r=e.target.closest('[data-crm]');if(r)r.closest('.crow').remove();
    const un=e.target.closest('[data-hcunit]');if(un){const [k,v]=un.dataset.hcunit.split('|');setUnit(k,v);save();un.parentNode.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b===un));render()}
    const pv=e.target.closest('[data-pv]');if(pv)openProvider(pv.dataset.pv,'card');
    if(e.target.closest('[data-pvadd]'))openProviderAdd('card')});
  $('#hcSave').addEventListener('click',()=>{const out={blood:$('#hc_blood').value};
    CARD_SECS.filter(s=>s[0]!=='providers').forEach(([k])=>{out[k]=[...sheet.querySelectorAll(`[data-sec="${k}"] .crow`)].map(row=>Object.fromEntries([...row.querySelectorAll('[data-f]')].map(i=>[i.dataset.f,i.value.trim()]))).filter(o=>Object.values(o).some(Boolean))});
    D.settings.card={...out,providers:(D.settings.card||{}).providers||[]};mirrorCard();save();closeSheet();render()});
}
/* ---------- providers: the list with a role filter, a page per provider, a form with a photo; archive keeps the history ---------- */
const providerAvatar=(p,s=44)=>p.photo?`<span class="thumb" style="width:${s}px;height:${s}px;border-radius:50%;flex:none">${photoHTML(p.photo,p.name,null,{pos:'center'})}</span>`:`<span class="pvav" style="width:${s}px;height:${s}px;font-size:${Math.round(s*0.36)}px">${esc(initials(p.name)||'?')}</span>`;
const roleLine=p=>[p.role,p.practice].filter(Boolean).join(' · ');
function openProviders(from){
  const all=providersOf(),roleMap=new Map();all.forEach(p=>{const r=(p.role||'').trim();if(r)roleMap.set(r.toLowerCase(),r)});const roles=[...roleMap.values()].sort();
  const role=V.pvRole||'',shown=role?all.filter(p=>(p.role||'').trim().toLowerCase()===role.toLowerCase()):all,active=shown.filter(p=>!p.archived),archived=shown.filter(p=>p.archived);
  const row=p=>`<div class="row" style="gap:10px"><button type="button" class="rlink" data-pv="${esc(p.id)}" style="flex-direction:row;align-items:center;gap:10px">${providerAvatar(p)}<span><span class="t">${esc(p.name)}</span><br><span class="s">${esc(roleLine(p))}</span></span></button>${p.archived?`<button type="button" class="btn-ghost btn-sm" data-pvrestore="${esc(p.id)}">Re-activate</button>`:''}</div>`;
  openSheet(`<div class="sheet-h"><h3>Providers</h3><button class="x" type="button" aria-label="Close">✕</button></div>
   ${roles.length>1?`<div class="chips" style="margin-bottom:10px"><button type="button" class="chip sm${!role?' on':''}" data-pvrole="">All</button>${roles.map(r=>`<button type="button" class="chip sm${role.toLowerCase()===r.toLowerCase()?' on':''}" data-pvrole="${esc(r)}">${esc(r)}</button>`).join('')}</div>`:''}
   <div class="sec" style="display:flex;justify-content:space-between;align-items:center">Active <button type="button" class="btn-ghost btn-sm" data-pvnew style="text-transform:none;letter-spacing:0">+ New</button></div>
   <div class="list">${active.map(row).join('')||`<div class="empty">${all.length?'None here.':'No providers yet. Add your doctor, dentist, physio, and appointments can pick them with one click.'}</div>`}</div>
   ${archived.length?`<div class="sec" style="margin-top:14px">Archived</div><div class="list">${archived.map(row).join('')}</div>`:''}
   ${from==='card'?`<div class="form-acts" style="margin-top:14px"><button type="button" class="btn-ghost" data-pvback>← Health card</button></div>`:''}`);
  $('#overlay').querySelector('.sheet').addEventListener('click',e=>{const t=e.target;const r=t.closest('[data-pvrole]');if(r){V.pvRole=r.dataset.pvrole;openProviders(from);return}
    const p=t.closest('[data-pv]');if(p){openProvider(p.dataset.pv,from);return}const rs=t.closest('[data-pvrestore]');if(rs){setArchived(rs.dataset.pvrestore,false);save();openProviders(from);return}
    if(t.closest('[data-pvnew]'))openProviderForm(null,from);if(t.closest('[data-pvback]'))openCard()});
}
function openProviderAdd(from){
  const archived=providersOf().filter(p=>p.archived);if(!archived.length)return openProviderForm(null,from);
  openSheet(`<div class="sheet-h"><h3>Add a provider</h3><button class="x" type="button" aria-label="Close">✕</button></div><button type="button" class="btn-accent" data-pvnew>New provider</button>
   <div class="sec" style="margin-top:14px">Or re-activate one</div><div class="list">${archived.map(p=>`<div class="row"><span style="display:flex;gap:10px;align-items:center">${providerAvatar(p)}<span><span class="t">${esc(p.name)}</span><br><span class="s">${esc(roleLine(p))}</span></span></span><button type="button" class="btn-ghost btn-sm" data-pvrestore="${esc(p.id)}">Re-activate</button></div>`).join('')}</div>
   <div class="form-acts" style="margin-top:14px"><button type="button" class="btn-ghost" data-pvback>← Back</button></div>`);
  $('#overlay').querySelector('.sheet').addEventListener('click',e=>{const t=e.target;if(t.closest('[data-pvnew]'))openProviderForm(null,from);const rs=t.closest('[data-pvrestore]');if(rs){setArchived(rs.dataset.pvrestore,false);save();from==='card'?openCard():openProviders()}if(t.closest('[data-pvback]'))from==='card'?openCard():openProviders()});
}
function openProvider(id,from){
  const p=providerOf(id);if(!p){alertSheet('Provider','This provider was removed.');return}
  const es=providerEntries(p),ks=providerCourses(p),done=es.filter(e=>e.details.status!=='upcoming'&&e.details.status!=='cancelled'),up=es.filter(e=>e.details.status==='upcoming'),link=(p.link||'').trim(),tel=(p.phone||'').replace(/[^\d+]/g,'');
  openSheet(`<div class="sheet-h"><h3>${esc(p.name)}</h3><button class="x" type="button" aria-label="Close">✕</button></div>
   <div style="display:flex;gap:14px;align-items:center;margin-bottom:12px">${providerAvatar(p,64)}<div style="flex:1;min-width:0">${p.role?`<b>${esc(p.role)}</b><br>`:''}${p.practice?`<span class="s" style="color:var(--muted)">${esc(p.practice)}</span>`:''}${p.archived?'<br><span class="pill mut">Archived</span>':''}</div></div>
   ${p.phone||p.address||link?`<dl class="kv" style="margin-bottom:12px">${p.phone?`<dt>Phone</dt><dd>${tel?`<a href="tel:${esc(tel)}">${esc(p.phone)}</a>`:esc(p.phone)}</dd>`:''}${p.address?`<dt>Address</dt><dd><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address)}" target="_blank" rel="noopener">${esc(p.address)}</a></dd>`:''}${link?`<dt>Link</dt><dd><a href="${esc(/^https?:/i.test(link)?link:'https://'+link)}" target="_blank" rel="noopener">${esc(link)}</a></dd>`:''}</dl>`:''}
   <div class="form-acts" style="justify-content:flex-start;margin-bottom:12px"><button type="button" class="btn-accent btn-sm" data-pvappt>+ Appointment</button><button type="button" class="btn-ghost btn-sm" data-pvedit>Edit</button><button type="button" class="btn-ghost btn-sm" data-pvarch>${p.archived?'Restore':'Archive'}</button></div>
   <div class="kstats" style="grid-template-columns:repeat(3,minmax(0,1fr))"><div><b>${done.length}</b><span>${done.length===1?'visit':'visits'}</span></div><div><b>${up.length}</b><span>upcoming</span></div><div><b>${money(providerSpend(done))}</b><span>spent</span></div></div>
   ${ks.length?`<div class="sec" style="margin-top:14px">Courses of care</div><div class="list">${ks.map(k=>`<div class="row"><span><span class="t">${esc(k.title)}</span><br><span class="s">${fmt(k.started_on)} – ${k.ended_on?fmt(k.ended_on):'ongoing'}</span></span></div>`).join('')}</div>`:''}
   <div class="sec" style="margin-top:14px">Appointments</div><div>${es.map(entryRow).join('')||'<div class="empty">None yet.</div>'}</div>
   <div style="text-align:center;margin-top:14px"><button type="button" class="btn-ghost" data-pvdel style="color:var(--t-observation);border-color:currentColor">Delete provider</button><p class="s" style="font-size:12px;color:var(--muted)">Archive keeps the history. Delete removes this card; the appointments stay.</p></div>
   <div class="form-acts"><button type="button" class="btn-ghost" data-pvback>← ${from==='card'?'Health card':'Providers'}</button></div>`);
  $('#overlay').querySelector('.sheet').addEventListener('click',e=>{const t=e.target;const en=t.closest('[data-entry]');if(en){openEntry(en.dataset.entry);return}
    if(t.closest('[data-pvappt]'))openForm('appointment',{details:{provider_id:p.id,provider:p.name,practice:p.practice||'',status:'upcoming'}});
    if(t.closest('[data-pvedit]'))openProviderForm(p.id,from);
    if(t.closest('[data-pvarch]')){setArchived(p.id,!p.archived);save();openProvider(p.id,from)}
    const del=t.closest('[data-pvdel]');if(del){if(!del.dataset.armed){del.dataset.armed='1';del.textContent='Click again to delete';return}removeProvider(p.id);save();from==='card'?openCard():openProviders();render()}
    if(t.closest('[data-pvback]'))from==='card'?openCard():openProviders()});
}
function openProviderForm(id,from){
  const pre=id?providerOf(id):null,p=pre?{...pre}:{id:'pv-'+uid(),name:'',role:'',practice:'',phone:'',address:'',link:'',photo:null,added_on:TODAY};
  openSheet(`<div class="sheet-h"><h3>${pre?'Edit provider':'New provider'}</h3><button class="x" type="button" aria-label="Close">✕</button></div>
   <form class="form" id="pvForm" novalidate><div style="display:flex;gap:12px;align-items:center"><span id="pvAv">${providerAvatar(p,64)}</span><div style="display:flex;gap:6px;flex-wrap:wrap"><input type="file" id="pv_ph" accept="image/*" hidden><button type="button" class="btn-ghost btn-sm" id="pvPick">Choose a photo</button>${p.photo?'<button type="button" class="btn-ghost btn-sm" id="pvRm">Remove</button>':''}</div></div>
   <div class="f"><label for="pv_n">Name</label><input id="pv_n" value="${esc(p.name)}" placeholder="Dr. Mogla"></div><div class="f"><label for="pv_r">Role</label><input id="pv_r" value="${esc(p.role||'')}" placeholder="Family doctor, dentist, physio"></div><div class="f"><label for="pv_p">Practice</label><input id="pv_p" value="${esc(p.practice||'')}" placeholder="Clinic name"></div>
   <div class="f"><label for="pv_t">Phone</label><input id="pv_t" value="${esc(p.phone||'')}"></div><div class="f"><label for="pv_a">Address</label><textarea id="pv_a">${esc(p.address||'')}</textarea></div><div class="f"><label for="pv_l">Link</label><input id="pv_l" value="${esc(p.link||'')}" placeholder="Website or a Google Maps link"></div>
   <div class="form-acts"><button type="button" class="btn-ghost" id="pvBack">← Back</button><button class="btn-accent" type="submit">Save</button></div><div class="err" id="pvErr"></div></form>`);
  $('#pvPick').addEventListener('click',()=>{if(!needVault())$('#pv_ph').click()});
  $('#pv_ph').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;const src=await shrink(f);if(src){p.photo={src};$('#pvAv').innerHTML=providerAvatar(p,64)}});
  const rm=$('#pvRm');if(rm)rm.addEventListener('click',()=>{p.photo=null;$('#pvAv').innerHTML=providerAvatar(p,64)});
  $('#pvBack').addEventListener('click',()=>pre?openProvider(pre.id,from):from==='card'?openCard():openProviders());
  $('#pvForm').addEventListener('submit',e=>{e.preventDefault();const tr=id=>$(id).value.trim();if(!tr('#pv_n')){$('#pvErr').textContent='Give them a name.';return}
    upsertProvider({...p,name:tr('#pv_n'),role:tr('#pv_r'),practice:tr('#pv_p'),phone:tr('#pv_t'),address:tr('#pv_a'),link:tr('#pv_l')});save();render();openProvider(p.id,from)});
}
/* ---------- Reports: lab results across report dates, the lab reports, and the other documents (prescriptions, scans, letters) ---------- */
function viewLabs(){
  const labs=labsOnly().slice().sort(byDateDesc('date')),dates=labs.map(l=>l.date).slice().reverse(),others=D.labs.filter(l=>!isLab(l)).sort(byDateDesc('date'));
  const markers=[...new Set(labs.flatMap(l=>l.results.map(r=>r.marker)))];
  const cell=(m,d)=>{const l=labs.find(l=>l.date===d);const r=l&&l.results.find(r=>r.marker===m);return r?`${esc(r.value)} ${r.flag?`<span class="pill flag">${esc(r.flag)}</span>`:''}`:'<span class="s" style="color:var(--muted)">–</span>'};
  const spark=m=>{const s=getSeries('lab:'+m);if(!s||s.points.length<2)return '';const ps=s.points,lo=Math.min(...ps.map(p=>p.v)),hi=Math.max(...ps.map(p=>p.v)),W=80,H=24,X=i=>4+i/(ps.length-1)*(W-8),Y=v=>3+(1-(v-lo)/((hi-lo)||1))*(H-6);return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><path d="${ps.map((p,i)=>(i?'L':'M')+X(i)+' '+Y(p.v)).join(' ')}" fill="none" stroke="var(--ink)" stroke-width="1.5"/><circle cx="${X(ps.length-1)}" cy="${Y(ps[ps.length-1].v)}" r="3" fill="var(--accent)" stroke="var(--ink)"/></svg>`};
  const units=m=>{const l=labs.find(l=>l.results.some(r=>r.marker===m));const r=l.results.find(r=>r.marker===m);return `${esc(r.unit)}${r.range?` · <span class="rng">${esc(r.range)}</span>`:''}`};
  return `<div class="page-h" style="margin-bottom:16px"><div><h1>Reports</h1><span class="sub">Lab results, prescriptions, scans and letters, kept as they came</span></div><button type="button" class="btn-accent" data-act="add-lab">+ Add report</button></div>
  <div style="display:flex;flex-direction:column;gap:16px">
  <section class="card"><div class="card-h"><h2>Lab results over time</h2>${infoBtn('Lab results over time','Each marker across your lab reports, newest last. Flags and reference ranges are copied from each report exactly as the lab printed them; this app does not judge them.')}</div>
   ${markers.length?`<div class="tbl-wrap"><table class="labs"><thead><tr><th>Marker</th><th>Unit · lab range</th>${dates.map(d=>`<th class="mono">${fmtShort(d)} ${String(pd(d).getFullYear()).slice(2)}</th>`).join('')}<th>Trend</th></tr></thead>
   <tbody>${markers.map(m=>`<tr><td><button type="button" class="linkish" data-chartlab="${esc(m)}">${esc(m)}</button></td><td>${units(m)}</td>${dates.map(d=>`<td class="v">${cell(m,d)}</td>`).join('')}<td>${spark(m)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">No lab reports yet.</div>'}</section>
  <section class="card"><div class="card-h"><h2>Lab reports <span class="sub">${labs.length||''}</span></h2></div><div class="list">${labs.map(l=>`<button type="button" class="row" data-lab="${l.id}"><span style="display:flex;gap:10px;align-items:center">${ico('lab',1)}<span><span class="t">${esc(reportTitle(l))}</span><br><span class="s">${fmt(l.date)} · ${l.results.length} results${l.file?` · ${esc(fname(l.file))}`:''}</span></span></span><span class="pill mut">${l.results.filter(r=>r.flag).length} flagged</span></button>`).join('')||'<div class="empty">Bloodwork and other lab panels go here, with the PDF and the values as printed.</div>'}</div></section>
  <section class="card"><div class="card-h"><h2>Other documents <span class="sub">${others.length||''}</span></h2>${infoBtn('Other documents','Prescriptions, scans, referral letters, discharge summaries: the file, who it came from, and any values worth keeping as numbers (a glasses prescription, say). Values here stay with the document; only lab results go into the markers table.')}</div><div class="list">${others.map(l=>`<button type="button" class="row" data-lab="${l.id}"><span style="display:flex;gap:10px;align-items:center">${ico('report',1)}<span><span class="t">${esc(reportTitle(l))}</span><br><span class="s">${esc([kindName(reportKind(l)),fmt(l.date),l.lab,l.results.length?`${l.results.length} ${l.results.length===1?'value':'values'}`:'',fname(l.file)].filter(Boolean).join(' · '))}</span></span></span></button>`).join('')||'<div class="empty">Prescriptions, scans and letters go here. Use + Add report and pick the kind.</div>'}</div></section></div>`;
}
/* a report: lab results (the default), or another document with its file and, if useful, its own values */
function openLabForm(kind0='lab'){
  const labs=labsOnly(),known=[...new Set(labs.flatMap(l=>l.results.map(r=>JSON.stringify([r.marker,r.unit,r.range]))))].map(s=>JSON.parse(s));
  let kind=kind0;
  const row=(m=['','',''])=>`<div class="lr"><input placeholder="Marker" value="${esc(m[0])}" aria-label="Marker" list="markerList"><input placeholder="Value" inputmode="decimal" aria-label="Value"><input placeholder="Unit" value="${esc(m[1])}" aria-label="Unit"><input placeholder="Lab range" value="${esc(m[2])}" aria-label="Lab reference range"><select aria-label="Lab flag"><option value="">–</option><option>H</option><option>L</option></select><button type="button" class="rm" aria-label="Remove row">✕</button></div>`;
  const labRows=()=>(known.length?known:[['','','']]).map(row).join('');
  openSheet(`<div class="sheet-h"><h3 id="lbTitle">${ico(kind==='lab'?'lab':'report')}${kind==='lab'?'Lab report':'Report'}</h3><button class="x" type="button" aria-label="Close">✕</button></div>
  <form class="form" id="labForm" novalidate><div class="f"><label for="lb_k">What is it</label><select id="lb_k">${REPORT_KINDS.map(([v,l])=>`<option value="${v}"${v===kind?' selected':''}>${l}</option>`).join('')}</select></div>
   <div class="f" id="lbTitleWrap"${kind==='lab'?' hidden':''}><label for="lb_t">Title</label><input id="lb_t" placeholder="${esc(TITLE_HINT[kind]||'')}"></div>
   <div class="f2"><div class="f"><label for="lb_d" id="lbDateL">${kind==='lab'?'Date collected':'Dated'}</label><input id="lb_d" type="date" value="${TODAY}"></div><div class="f"><label for="lb_l" id="lbLabL">${kind==='lab'?'Lab':'From'}</label><input id="lb_l" placeholder="${kind==='lab'?'Lab name':'Optometrist, clinic, hospital'}" value="${esc(kind==='lab'?(labs[0]||{}).lab||'':'')}"></div></div>
   <div class="f"><label for="lb_f">File</label><input id="lb_f" type="file" accept="application/pdf,image/*"></div>
   <div class="rcard" style="background:var(--accent-soft)"><span class="t">How this works</span><span class="s" id="lbHow">${kind==='lab'?'The PDF is encrypted and stored with the report. Type the values in as the lab printed them. Nothing is interpreted; flags and ranges are the lab\'s own.':'The file is encrypted and stored with the report. Values are optional: a glasses prescription\'s sphere and cylinder, a dose. They stay with this document and are not mixed into the lab markers.'}</span></div>
   <datalist id="markerList">${[...new Set(labs.flatMap(l=>l.results.map(r=>r.marker)))].map(m=>`<option value="${esc(m)}">`).join('')}</datalist>
   <div class="f"><span class="l" id="lbResL">${kind==='lab'?'Results':'Values (optional)'}</span><div class="lr lr-h"><span>Marker</span><span>Value</span><span>Unit</span><span>Lab range</span><span>Flag</span><span></span></div><div id="lrows" class="list">${kind==='lab'?labRows():row()}</div><button type="button" class="btn-ghost btn-sm" id="lrAdd" style="align-self:flex-start">+ Add row</button></div>
   <div class="f"><label for="lb_n">Notes</label><textarea id="lb_n" placeholder="${kind==='lab'?'':'What it says, in your words'}"></textarea></div>
   <div class="form-acts"><span></span><button type="submit" class="btn-accent">Save report</button></div><div class="err" id="lbErr"></div></form>`);
  $('#lb_k').addEventListener('change',e=>{const was=kind;kind=e.target.value;const lab=kind==='lab';$('#lbTitleWrap').hidden=lab;$('#lb_t').placeholder=TITLE_HINT[kind]||'';$('#lbDateL').textContent=lab?'Date collected':'Dated';$('#lbLabL').textContent=lab?'Lab':'From';$('#lb_l').placeholder=lab?'Lab name':'Optometrist, clinic, hospital';$('#lbResL').textContent=lab?'Results':'Values (optional)';$('#lbTitle').innerHTML=`${ico(lab?'lab':'report')}${lab?'Lab report':'Report'}`;
    $('#lbHow').textContent=lab?'The PDF is encrypted and stored with the report. Type the values in as the lab printed them. Nothing is interpreted; flags and ranges are the lab\'s own.':'The file is encrypted and stored with the report. Values are optional: a glasses prescription\'s sphere and cylinder, a dose. They stay with this document and are not mixed into the lab markers.';
    if(lab){$('#lrows').innerHTML=labRows();if(!$('#lb_l').value)$('#lb_l').value=(labs[0]||{}).lab||''}else if(was==='lab'){$('#lrows').innerHTML=row();$('#lb_l').value=''}});
  $('#lb_f').addEventListener('click',e=>{if(!vaultReady()){e.preventDefault();$('#lbErr').textContent='Turn on photo encryption first: Security, at the bottom of the page.'}});
  $('#lrAdd').addEventListener('click',()=>$('#lrows').insertAdjacentHTML('beforeend',row()));
  $('#lrows').addEventListener('click',e=>{if(e.target.closest('.rm'))e.target.closest('.lr').remove()});
  $('#labForm').addEventListener('submit',e=>{e.preventDefault();const err=m=>{$('#lbErr').textContent=m},lab=kind==='lab';
    const results=[...$('#lrows').querySelectorAll('.lr')].map(r=>{const i=r.querySelectorAll('input,select');return {marker:i[0].value.trim(),value:i[1].value.trim(),unit:i[2].value.trim(),range:i[3].value.trim(),flag:i[4].value}}).filter(r=>r.marker||r.value!=='');
    if(results.some(r=>!r.marker||r.value===''))return err(lab?'Each result needs a marker and a value.':'Each value needs a name and a number. Remove the rows you don\'t need.');
    if(results.some(r=>isNaN(+r.value.replace(',','.'))))return err('Values must be numbers.');
    if(lab&&!results.length)return err('Enter at least one result with a value.');
    const f=$('#lb_f').files[0],title=$('#lb_t').value.trim();
    if(!lab&&!title&&!f&&!results.length)return err('Give it a title, attach the file, or enter a value.');
    D.labs.push({id:'l-'+uid(),date:$('#lb_d').value||TODAY,lab:$('#lb_l').value.trim()||(lab?'Lab':''),file:f?{name:f.name,size:f.size,blob:f}:null,notes:$('#lb_n').value.trim(),results:results.map(r=>({...r,value:+r.value.replace(',','.')})),kind,...(title?{title}:{})});save();closeSheet();render()});
}
function openLab(id){
  const l=D.labs.find(x=>x.id===id);if(!l)return;const lab=isLab(l);
  openSheet(`<div class="sheet-h"><h3>${ico(lab?'lab':'report')}${esc(reportTitle(l))}</h3><button class="x" type="button" aria-label="Close">✕</button></div>
   <dl class="kv" style="margin-bottom:12px">${lab?'':`<dt>Kind</dt><dd>${esc(kindName(reportKind(l)))}</dd>`}<dt>${lab?'Collected':'Dated'}</dt><dd>${fmt(l.date)}</dd>${l.lab?`<dt>${lab?'Lab':'From'}</dt><dd>${esc(l.lab)}</dd>`:''}${l.file?`<dt>File</dt><dd><button type="button" class="fchip" id="labFile">${FILE_ICON}${esc(fname(l.file))}</button></dd>`:''}${l.notes?`<dt>Notes</dt><dd>${esc(l.notes)}</dd>`:''}</dl>
   ${l.results.length?`<div class="tbl-wrap"><table class="labs" style="min-width:0"><thead><tr><th>${lab?'Marker':'Value'}</th><th>Value</th><th>${lab?'Lab range':'Note'}</th>${lab?'<th>Flag</th>':''}</tr></thead><tbody>${l.results.map(r=>`<tr><td>${esc(r.marker)}</td><td class="v">${esc(r.value)} ${esc(r.unit)}</td><td class="v">${esc(r.range)}</td>${lab?`<td>${r.flag?`<span class="pill flag">${esc(r.flag)}</span>`:''}</td>`:''}</tr>`).join('')}</tbody></table></div>`:''}
   <p class="disclaim">${lab?'Ranges and flags as printed by the lab.':'Kept as it came. These values stay with this document.'}</p><div class="form-acts"><span></span><button type="button" class="btn-ghost" id="labDel">Delete report</button></div>`);
  const lf=$('#labFile');lf&&lf.addEventListener('click',()=>openFile(l.file));
  $('#labDel').addEventListener('click',e=>{if(!e.target.dataset.armed){e.target.dataset.armed='1';e.target.textContent='Click again to delete';return}D.labs=D.labs.filter(x=>x.id!==id);save();closeSheet();render()});
}
/* ---------- About, privacy and terms; the Apple Health items (read-only here: the phone reads Health) ---------- */
function openAbout(){
  openSheet(`<div class="sheet-h"><h3>About My OS Health</h3><button class="x" type="button" aria-label="Close">✕</button></div>
   <p class="story-p">My OS Health records what you choose to put in it: appointments, photos, measurements, lab results, what you take and what you do. It shows it back to you so you can see patterns and take them to your doctor.</p>
   <p class="story-p">It never interprets your data. Nothing in it is medical advice, a diagnosis, or a reason to start or stop a treatment. For that, see a professional.</p>
   <div class="sec">Your data</div>
   <p class="story-p">Your record is stored in a Supabase project that you own and that you connected yourself, or only in this browser when you use it on this computer alone. This app reads and writes to that project. It does not send your record anywhere else.</p>
   <p class="story-p">Photos and files are encrypted on this device with your passphrase before they are uploaded. The passphrase never leaves the device. Without it, the stored photos cannot be opened, by anyone.</p>
   <p class="story-p">This app has no advertising and no third-party tracking. It does not collect analytics about you. Reminders set here are delivered by the My OS app on your phone, and their text stays with your record.</p>
   <div class="sec">Terms</div>
   <p class="story-p">You are responsible for the record you keep and for the Supabase project it lives in, including its security and backups. This app is provided as is. It can have faults, and it should not be your only copy of anything that matters.</p>
   <p class="story-p" style="margin:0">Use it for yourself. It is not built for keeping records about other people.</p>`);
}
function openAppleHealth(){
  const has=D.hk&&Object.keys(D.hk).some(k=>(D.hk[k]||[]).length);
  openSheet(`<div class="sheet-h"><h3>Apple Health</h3><button class="x" type="button" aria-label="Close">✕</button></div>
   <p class="story-p">Read by the My OS app on your phone, read-only: daily values, your cycle and workouts come into your own record; nothing is ever written back to Health. ${has?'Values from Health are in your record here.':'Nothing has been read yet; connect it on the phone.'}</p>
   <div class="sec">What is used, as set on the phone</div><div class="list">${HK_ITEMS.map(it=>{const v=hkUse(it.key),l=it.merge?{both:'Both',health:'Health only',manual:'Manual only',off:'Off'}[v]||'Both':v==='off'?'Off':'On';return `<div class="row"><span class="t">${esc(it.label)}</span><span class="pill${v==='off'?' mut':''}">${l}</span></div>`}).join('')}</div>
   <p class="s" style="font-size:12px;color:var(--muted);margin:10px 0 0">Weight and body fat are one measure whether typed in or read from Health: Both shows every value and, on a day with both, the figure from Health. Cycle days you enter yourself always win. Off hides an item without deleting anything. Change these on the phone.</p>`);
}
function openEntry(id){
  const e=D.entries.find(x=>x.id===id);if(!e)return;
  const T=TYPES[e.type],c=D.concerns.find(c=>c.id===e.concern_id),parent=D.entries.find(x=>x.id===e.parent_entry_id),kids=D.entries.filter(x=>x.parent_entry_id===e.id).sort(byDateDesc());
  const rows=[['Date',`${fmt(e.occurred_at)} (${ago(e.occurred_at)})`]];
  if(e.details.time)rows.push(['Time',tfmt(e.details.time)]);
  if(e.details.end_date||e.details.end_time){const a=new Date(`${e.occurred_at}T${e.details.time||'00:00'}`),b=new Date(`${e.details.end_date||e.occurred_at}T${e.details.end_time||'00:00'}`);rows.push(['Lasted',b>a?dur((b-a)/60000):`until ${fmt(e.details.end_date||e.occurred_at)}${e.details.end_time?' '+tfmt(e.details.end_time):''}`])}
  if(e.type==='measurement'&&e.details.metric)rows.push(['Value',fmtM(e.details.metric,e.details.value)]);
  T.fields.forEach(f=>{let v=e.details[f.k];if(v==null||v==='')return;if(f.t==='kind')v=kindLabel(v);else if(f.t==='metric')v=metric(v).l;else if(f.t==='plan')v=(D.plans.find(p=>p.id===v)||{}).title||v;else if(f.t==='course')v=(D.courses.find(k=>k.id===v)||{}).title||v;else if(f.k==='cost')v=money(v);else if(f.t==='select'){const o=f.o.find(o=>o[0]===String(v));v=o?o[1]:v}else if(f.t==='date')v=fmt(v);rows.push([f.l,v])});
  if(e.regions.length)rows.push(['Body areas',e.regions.map(rl).join(', ')]);if(c)rows.push(['Concern',c.title]);if(parent)rows.push(['Follows',parent.title]);if(e.notes)rows.push(['Notes',e.notes]);if(e.source!=='manual')rows.push(['Source',e.source]);
  if(e.type==='appointment'){const r=readingFor(e.id);if(r){const M=metric(r.details.metric);rows.splice(1,0,[`Your ${M.l.toLowerCase()}`,fmtV(r.details.value,M.u)])}}
  openSheet(`<div class="sheet-h"><h3>${ico(e.type)}${esc(e.title)}</h3><button class="x" type="button" aria-label="Close">✕</button></div>
   <dl class="kv">${rows.map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
   ${(e.files||[]).length?`<div class="sec" style="margin-top:16px">Files</div><div class="thumbs">${e.files.map((f,i)=>`<button type="button" class="fchip" data-openfile="${i}">${FILE_ICON}${esc(f.name)}${f.size?` <em>${Math.max(1,Math.round(f.size/1024))} KB</em>`:''}</button>`).join('')}</div>`:''}
   ${e.photos.length?`<div class="sec" style="margin-top:16px">Photos</div><div class="thumbs">${e.photos.map(p=>`<div class="thumb" style="width:110px;height:130px">${photoHTML(p,e.title,e.occurred_at)}</div>`).join('')}</div>`:''}
   ${kids.length?`<div class="sec" style="margin-top:16px">Follow-ups</div><div>${kids.map(entryRow).join('')}</div>`:''}
   <div class="form-acts" style="margin-top:16px">${e.type==='appointment'&&e.details.status==='upcoming'?`<button class="btn-accent" type="button" data-sa="complete">Record how it went</button>`:''}${e.details&&e.details.tooth&&/\d{2}/.test(e.details.tooth)?`<button class="btn-ghost" type="button" data-sa="tooth">Tooth chart</button>`:''}${e.type==='observation'?`<button class="btn-ghost" type="button" data-sa="before">What came before</button>`:''}${['procedure','appointment','food_trial'].includes(e.type)&&e.occurred_at<=TODAY?`<button class="btn-ghost" type="button" data-sa="ba">Compare before and after</button>`:''}<button class="btn-ghost" type="button" data-sa="followup">+ Follow-up</button><button class="btn-ghost" type="button" data-sa="edit">Edit</button><button class="btn-ghost" type="button" data-sa="del">Delete entry</button></div>
   <div id="delConfirm" hidden class="rcard" style="margin-top:12px;background:var(--accent-soft)"><span class="t">Delete this entry?</span><span style="display:flex;gap:8px"><button class="btn-dark btn-sm" type="button" data-sa="del-yes">Delete</button><button class="btn-ghost btn-sm" type="button" data-sa="del-no">Keep</button></span></div>`);
  $('#overlay').querySelector('.sheet').addEventListener('click',ev=>{
    const of=ev.target.closest('[data-openfile]');if(of){openFile(e.files[+of.dataset.openfile]);return}
    const row=ev.target.closest('[data-entry]');if(row){openEntry(row.dataset.entry);return}
    const a=ev.target.closest('[data-sa]');if(!a)return;const k=a.dataset.sa;
    if(k==='complete')openForm('appointment',{...e,details:{...e.details,status:'done'}});
    if(k==='edit')openForm(e.type,e);
    if(k==='tooth'){openTooth(String(e.details.tooth).match(/\d{2}/)[0]);return}
    if(k==='before'){openBefore(e.id);return}
    if(k==='ba'){openBeforeAfter({config:{event_date:e.occurred_at,label:e.title}});return}
    if(k==='followup')openForm('observation',{parent_entry_id:e.id,regions:e.regions,concern_id:e.concern_id});
    if(k==='del')$('#delConfirm').hidden=false;if(k==='del-no')$('#delConfirm').hidden=true;
    if(k==='del-yes'){D.entries=D.entries.filter(x=>x.id!==e.id);D.entries.forEach(x=>{if(x.parent_entry_id===e.id)x.parent_entry_id=null});save();closeSheet();V.frame=null;render()}
  });
}
function openChallengeView(id){openExpPage(id)}
function openWidgetLib(col){
  openSheet(`<div class="sheet-h"><h3>Add a widget</h3><button class="x" type="button" aria-label="Close">✕</button></div>
   <div class="types">${Object.entries(WIDGETS).map(([k,w])=>`<button type="button" class="type" data-wl="${k}"><b>${esc(w.label)}</b><span>${esc(w.hint)}</span></button>`).join('')}</div>
   <div id="chartPick" hidden><div class="sec" style="margin-top:16px">Which chart?</div>${D.charts.length?`<div class="chips">${D.charts.map(c=>`<button type="button" class="chip" data-ws="${c.id}">${esc(c.title)}</button>`).join('')}</div>`:''}<div style="margin-top:10px"><button type="button" class="btn-ghost btn-sm" data-ws="__new">+ Build a new chart</button></div></div>
   <div id="quickPick" hidden><div class="sec" style="margin-top:16px">What do you want to log each day?</div><div class="chips"><button type="button" class="chip" data-wq="cycle">Cycle day</button>${Object.entries(D.metrics).map(([k,m])=>`<button type="button" class="chip" data-wq="m:${k}">${esc(m.l)}</button>`).join('')}</div></div>`);
  $('#overlay').querySelector('.sheet').addEventListener('click',e=>{
    const w=e.target.closest('[data-wl]');if(w){if(w.dataset.wl==='savedchart'){$('#chartPick').hidden=false;$('#quickPick').hidden=true;return}if(w.dataset.wl==='quick'){$('#quickPick').hidden=false;$('#chartPick').hidden=true;return}D.widgets[col].push({id:uid(),type:w.dataset.wl});save();closeSheet();render();return}
    const wq=e.target.closest('[data-wq]');if(wq){D.widgets[col].push({id:uid(),type:'quick',src:wq.dataset.wq});save();closeSheet();render();return}
    const s=e.target.closest('[data-ws]');if(!s)return;
    if(s.dataset.ws==='__new'){const c=newChart();D.widgets[col].push({id:uid(),type:'savedchart',chartId:c.id});save();closeSheet();V.tab='charts';V.customizing=false;render();window.scrollTo({top:0});return}
    D.widgets[col].push({id:uid(),type:'savedchart',chartId:s.dataset.ws});save();closeSheet();render();
  });
}

/* ---------- events ---------- */
$('#addBtn').addEventListener('click',()=>openAdd());$('#fab').addEventListener('click',()=>openAdd());
$('#menuBtn').addEventListener('click',e=>{e.stopPropagation();const m=$('#tmenu'),open=m.hidden;m.hidden=!open;$('#menuBtn').setAttribute('aria-expanded',String(open))});
document.addEventListener('click',e=>{if(!$('#tmenu').hidden&&!e.target.closest('#tmenu'))closeMenu()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#tmenu').hidden)closeMenu()});
$('#nav').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(!b)return;V.tab=b.dataset.tab;V.exp=null;V.concernPage=null;V.concEdit=false;V.planEdit=false;V.editing=false;V.customizing=false;render();window.scrollTo({top:0})});
$('#view').addEventListener('click',e=>{
  const t=e.target,q=s=>t.closest(s);let el;
  if((el=q('[data-rtick]'))){logToday(el.dataset.rtick);return}
  if((el=q('[data-logm]'))){openForm('measurement',{details:{metric:el.dataset.logm}});return}
  if((el=q('[data-unit]'))){const k=el.dataset.unit,p=unitPref();setUnit(k,k==='weight'?(p.weight==='kg'?'lb':'kg'):p.height==='cm'?'ft':'cm');save();render();return}
  if((el=q('[data-egroup]'))){V.editGroup=el.dataset.egroup;paintBody();return}
  if((el=q('.hot'))){if(!V.editing&&!el.classList.contains('grouped')){const p=D.points.find(p=>p.id===el.dataset.pt);if(p)setRegion(p.region)}return}
  if(q('#gbox'))return;
  if(V.editing&&(el=q('#stage'))){if(!V.region&&V.editGroup==='all')return;const b=el.getBoundingClientRect();const x=+((e.clientX-b.left)/b.width*100).toFixed(1),y=+((e.clientY-b.top)/b.height*100).toFixed(1);addPointAt(x,y);return}
  if((el=q('[data-entry]'))){openEntry(el.dataset.entry);return}
  if((el=q('[data-lab]'))){openLab(el.dataset.lab);return}
  if((el=q('[data-rphoto]'))){const [id,i]=el.dataset.rphoto.split(':'),r=D.regimens.find(x=>x.id===id);if(r&&r.photos&&r.photos[+i])openLightbox(r.photos[+i]);return}
  if((el=q('[data-again]'))){const r=D.regimens.find(x=>x.id===el.dataset.again);r&&openRegimen(r,{again:true});return}
  if((el=q('[data-arch]'))){V.archKind=el.dataset.arch;render();return}
  if((el=q('[data-info]'))){alertSheet(el.dataset.info,el.dataset.text);return}
  if((el=q('[data-regimen]'))){const r=D.regimens.find(x=>x.id===el.dataset.regimen);r&&openRegimen(r);return}
  if((el=q('[data-challenge]'))){openChallengeView(el.dataset.challenge);return}
  if((el=q('[data-type]'))){V.type=el.dataset.type;render();return}
  if((el=q('[data-hview]'))){V.histView=el.dataset.hview;render();return}
  if((el=q('[data-hmonth]'))){const n=+el.dataset.hmonth;if(!n)V.histMonth=TODAY.slice(0,7);else{const [y,m]=(V.histMonth||TODAY.slice(0,7)).split('-').map(Number),d=new Date(y,m-1+n,1);V.histMonth=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}render();return}
  if((el=q('[data-hday]'))){openDay(el.dataset.hday);return}
  if((el=q('[data-ca]'))){concernAction(el.dataset.ca,el);return}
  if((el=q('[data-episode]'))){openEpisodeSheet(V.concernPage,+el.dataset.episode);return}
  if((el=q('[data-ccol]'))){const c=D.concerns.find(x=>x.id===V.concernPage);if(c){c.color=el.dataset.ccol;save();render()}return}
  if((el=q('[data-pm]'))){el.classList.toggle('on');return}
  if((el=q('[data-fold]'))){V.folds=V.folds||{};V.folds[el.dataset.fold]=!V.folds[el.dataset.fold];render();return}
  if((el=q('[data-story]'))){openStory(+el.dataset.story);return}
  if((el=q('[data-concern]'))){openConcern(el.dataset.concern);return}
  if((el=q('[data-clear]'))){if(el.dataset.clear==='region'){V.region=null;V.frame=null}else V.concern=null;render();return}
  if((el=q('[data-seemore]'))){const w=el.dataset.seemore;V.expanded.has(w)?V.expanded.delete(w):V.expanded.add(w);render();const l=document.querySelector(`[data-w="${w}"]`);l&&l.closest('section').scrollIntoView({block:'nearest'});return}
  if((el=q('[data-cmenu]'))){const m=el.nextElementSibling,open=m.hidden;document.querySelectorAll('.cmenu').forEach(x=>x.hidden=true);m.hidden=!open;return}
  if((el=q('[data-layout]'))){const order=(D.chartZones||[]).flat();D.chartLayout=el.dataset.layout;distributeZones(order);save();render();return}
  if((el=q('[data-hexapply]'))){const v=el.parentElement.querySelector('[data-hextext]').value.trim(),c=D.charts.find(x=>x.id===V.editChart);if(c&&/^#[0-9a-f]{6}$/i.test(v)){c[el.dataset.hexapply+'Color']=v;save();render()}else el.parentElement.querySelector('[data-hextext]').style.borderColor='var(--t-observation)';return}
  if((el=q('[data-cbgrid]'))){const c=D.charts.find(x=>x.id===V.editChart);if(c){c.grid=el.dataset.cbgrid==='1';save();render()}return}
  if((el=q('[data-cbaxes]'))){const c=D.charts.find(x=>x.id===V.editChart);if(c){c.axes=el.dataset.cbaxes==='1';save();render()}return}
  if((el=q('[data-cbscroll]'))){const c=D.charts.find(x=>x.id===V.editChart);if(c){c.scroll=el.dataset.cbscroll==='1';if(c.scroll&&!c.window)c.window=3;save();render()}return}
  if((el=q('[data-cbwin]'))){const c=D.charts.find(x=>x.id===V.editChart);if(c){c.window=+el.dataset.cbwin;save();render()}return}
  if((el=q('[data-cbaddright]'))){V.rightOpen=V.editChart;render();return}
  if((el=q('[data-cbrmright]'))){const c=D.charts.find(x=>x.id===V.editChart);if(c){c.y2=null;delete c.y2More;delete c.y2Range;V.rightOpen=null;save();render()}return}
  if((el=q('[data-cbrange2]'))){const [k,m]=el.dataset.cbrange2.split('|'),c=D.charts.find(x=>x.id===V.editChart);if(c){if(m==='auto')delete c[k+'Range'];else c[k+'Range']=c[k+'Range']||[null,null];save();render()}return}
  if((el=q('[data-cbrmmore]'))){const [k,id]=el.dataset.cbrmmore.split('|'),c=D.charts.find(x=>x.id===V.editChart);if(c){c[k+'More']=(c[k+'More']||[]).filter(x=>x!==id);if(!c[k+'More'].length)delete c[k+'More'];save();render()}return}
  if((el=q('[data-rtickday]'))){const [rid,d]=el.dataset.rtickday.split(':');const i=D.regLogs.findIndex(l=>l.regimen_id===rid&&l.on_date===d&&l.source==='manual');if(i>=0)D.regLogs.splice(i,1);else D.regLogs.push({id:'rl-'+uid(),regimen_id:rid,on_date:d,time:null,source:'manual',note:''});save();render();return}
  if((el=q('[data-tooth]'))){openTooth(el.dataset.tooth);return}
  if((el=q('[data-mview]'))){V.mouthView=el.dataset.mview;render();return}
  if((el=q('[data-tnum]'))){D.settings.toothNumbering=el.dataset.tnum;save();render();return}
  if((el=q('[data-region-go]'))){V.tab='dashboard';V.mouthView='teeth';setRegion(el.dataset.regionGo);return}
  if((el=q('[data-addplan]'))){openPlan({category:el.dataset.addplan});return}
  if((el=q('[data-qflow]'))){el.parentNode.querySelectorAll('[data-qflow]').forEach(x=>x.classList.toggle('on',x===el));return}
  if((el=q('[data-qsym]'))){el.classList.toggle('on');return}
  if((el=q('[data-qsave]'))){quickSave(el.dataset.qsave);return}
  if((el=q('[data-plog]'))){const p=D.plans.find(x=>x.id===el.dataset.plog);openForm('appointment',{title:p.title,details:{kind:p.kind,plan_id:p.id,status:'done'}});return}
  if((el=q('[data-pedit]'))){openPlan(D.plans.find(x=>x.id===el.dataset.pedit));return}
  if((el=q('[data-klog]'))){logForCourse(D.courses.find(x=>x.id===el.dataset.klog));return}
  if((el=q('[data-kview]'))){openCourseSessions(el.dataset.kview);return}
  if((el=q('[data-kedit]'))){openCourseForm(D.courses.find(x=>x.id===el.dataset.kedit));return}
  if((el=q('[data-kchart]'))){const k=D.courses.find(x=>x.id===el.dataset.kchart);newChart({title:k.title,y1:k.metric?'m:'+k.metric:null,y1Type:'line',bands:['k:'+k.id],sessions:[k.id],range:'custom',from:addDays(k.started_on,-14),to:k.ended_on||TODAY});V.tab='charts';render();window.scrollTo({top:0});return}
  if((el=q('[data-pyear]'))){V.planYear+=+el.dataset.pyear;render();return}
  if((el=q('[data-akind]'))){V.apptKind=el.dataset.akind;render();return}
  if((el=q('[data-tabgo]'))){V.tab=el.dataset.tabgo;V.exp=null;V.customizing=false;if(V.tab==='appointments')V.planYear=+YEAR;render();const f=el.dataset.focus&&document.querySelector(`[data-cid="${el.dataset.focus}"]`);if(f){f.scrollIntoView({block:'center'});f.classList.add('flash');setTimeout(()=>f.classList.remove('flash'),1600)}else window.scrollTo({top:0});return}
  if((el=q('[data-pick-color]'))){const [k,col]=el.dataset.pickColor.split('|');const c=D.charts.find(x=>x.id===V.editChart);if(c){c[k+'Color']=col;save();render()}return}
  if((el=q('[data-cbtype]'))){const [k,t]=el.dataset.cbtype.split('|');const c=D.charts.find(x=>x.id===V.editChart);if(c){c[k+'Type']=t;save();render()}return}
  if((el=q('[data-cact]'))){const [a,id]=el.dataset.cact.split(':');const c=D.charts.find(x=>x.id===id);if(!c)return;
    if(a==='edit'){V.editChart=id;render();const card=document.querySelector(`[data-cid="${id}"]`);card&&card.scrollIntoView({block:'start',behavior:'smooth'})}
    if(a==='done'){V.editChart=null;render()}
    if(a==='dash'){if(onDashboard(id)){['left','right'].forEach(k=>D.widgets[k]=D.widgets[k].filter(w=>!(w.type==='savedchart'&&w.chartId===id)))}else D.widgets.left.push({id:uid(),type:'savedchart',chartId:id});save();render()}
    if(a==='prev'||a==='next'){normalizeZones();const zi=D.chartZones.findIndex(z=>z.includes(id)),n=D.chartZones.length,to=(zi+(a==='next'?1:n-1))%n;moveChart(id,to,D.chartZones[to].length);render()}
    if(a==='dup'){const i=D.charts.indexOf(c);const nc={...JSON.parse(JSON.stringify(c)),id:'ch-'+uid(),title:c.title+' (copy)'};D.charts.splice(i+1,0,nc);normalizeZones();const z=D.chartZones.find(z=>z.includes(id));D.chartZones.forEach(zz=>{const k=zz.indexOf(nc.id);if(k>=0)zz.splice(k,1)});z.splice(z.indexOf(id)+1,0,nc.id);save();render()}
    if(a==='del'){if(!el.dataset.armed){el.dataset.armed='1';el.textContent='Click again to delete';return}D.charts=D.charts.filter(x=>x.id!==id);['left','right'].forEach(k=>D.widgets[k]=D.widgets[k].filter(w=>w.chartId!==id));if(V.editChart===id)V.editChart=null;save();render()}
    return}
  if((el=q('[data-cbband]'))){const c=D.charts.find(x=>x.id===V.editChart);const id=el.dataset.cbband;c.bands=c.bands.includes(id)?c.bands.filter(x=>x!==id):[...c.bands,id];save();render();return}
  if((el=q('[data-cym]'))){const c=D.charts.find(x=>x.id===V.editChart);if(c){c.months=+el.dataset.cym;save();render()}return}
  if((el=q('[data-cbmk]'))){const c=D.charts.find(x=>x.id===V.editChart);const k=el.dataset.cbmk;c.markers=(c.markers||[]).includes(k)?c.markers.filter(x=>x!==k):[...(c.markers||[]),k];save();render();return}
  if((el=q('[data-cbavg]'))){const c=D.charts.find(x=>x.id===V.editChart);const k=el.dataset.cbavg;c[k+'Avg']=!c[k+'Avg'];save();render();return}
  if((el=q('[data-cday]'))){openCycleDay(el.dataset.cday);return}
  if((el=q('[data-exp]'))){openExperiment(el.dataset.exp);return}
  if((el=q('[data-cbsess]'))){const c=D.charts.find(x=>x.id===V.editChart);const k=el.dataset.cbsess;c.sessions=(c.sessions||[]).includes(k)?c.sessions.filter(x=>x!==k):[...(c.sessions||[]),k];save();render();return}
  if((el=q('[data-cbph]'))){const c=D.charts.find(x=>x.id===V.editChart);const r=el.dataset.cbph;c.photos=c.photos.includes(r)?c.photos.filter(x=>x!==r):[...c.photos,r];save();render();return}
  if((el=q('[data-cbrange]'))){const c=D.charts.find(x=>x.id===V.editChart);c.range=el.dataset.cbrange;if(c.range==='custom'){c.from=c.from||addDays(TODAY,-180);c.to=c.to||TODAY}save();render();return}
  if((el=q('[data-chartlab]'))){newChart({title:el.dataset.chartlab,y1:'lab:'+el.dataset.chartlab,range:'all'});V.tab='charts';render();window.scrollTo({top:0});return}
  if((el=q('[data-pr]'))){V.photoRegion=el.dataset.pr;render();return}
  if((el=q('[data-csv]'))){document.querySelectorAll('[data-csv]').forEach(b=>b.classList.toggle('on',b===el));$('#csvOut').value=buildCSV(el.dataset.csv);return}
  if((el=q('[data-sug]'))){const s=D.suggestions.find(x=>x.id===el.dataset.sug);if(!s)return;if(el.dataset.a==='dismiss'){s.status='dismissed';save();render()}else openForm('appointment',{title:s.title,occurred_at:s.occurred_at,details:{...s.details,status:'upcoming'},source:'calendar',fromSuggestion:s.id});return}
  if((el=q('[data-wdel]'))){const [c,i]=el.dataset.wdel.split(':');D.widgets[c].splice(+i,1);save();render();return}
  if((el=q('[data-wpast]'))){const w=[...D.widgets.left,...D.widgets.right].find(x=>x.id===el.dataset.wpast);if(w){w.showPast=w.showPast===false;save();render()}return}
  if((el=q('[data-wmove]'))){const [c,i,d]=el.dataset.wmove.split(':');const a=D.widgets[c],j=+i+ +d;if(j<0||j>=a.length)return;[a[+i],a[j]]=[a[j],a[+i]];save();render();return}
  if((el=q('[data-wadd]'))){openWidgetLib(el.dataset.wadd);return}
  if((el=q('[data-act]'))){const a=el.dataset.act;
    if(a==='back'){V.region=V.region?parentOf(V.region):null;V.frame=null;V.editing=false;render()}
    if(a==='edit-points'){V.editing=true;V.editGroup='one';EDIT_SNAP=D.points.map(p=>({...p}));render()}
    if(a==='edit-cancel'){if(EDIT_SNAP)D.points=EDIT_SNAP;EDIT_SNAP=null;V.editing=false;save();render()}
    if(a==='edit-save'){EDIT_SNAP=null;V.editing=false;save();render()}
    if(a==='add-point')addPointAt(50,50);
    if(a==='snap')snapGroup();
    if(a==='rotate'){V.side=V.side==='back'?'front':'back';V.frame=null;render()}
    if(a==='adjust'){const fr=frames(),cur=fr[V.frame];if(cur&&cur.entry){const en=cur.entry,ph=cur.photo;openAdjust(ph,!V.region?'body':V.region==='face'?'face':null,fit=>{const p=en.photos.find(q=>(q.path&&q.path===ph.path)||(q.src&&q.src===ph.src))||ph;if(fit)p.fit=fit;else delete p.fit;save();render()})}}
    if(a==='customize'){V.customizing=!V.customizing;render()}
    if(a==='base'){if(!needVault())$('#basePhotoInput').click()}
    if(a==='vault-unlock')openVaultUnlock();
    if(a==='add-photo')addBodyPhoto();
    if(a==='add-chart')openChartChooser();
    if(a==='hist-filters'){V.histFilters=!V.histFilters;render()}
    if(a==='apple-health')openAppleHealth();
    if(a==='exp-photo'){const c=D.challenges.find(x=>x.id===V.exp),rs=c?expRegions(c):[];if(rs.length&&!needVault())openForm('photo',{regions:[rs[0]],details:{series:rs[0]==='face'?'face':rs[0]==='whole_body'?'body':'none'}})}
    if(a==='conc-back'){V.concernPage=null;V.concEdit=false;V.planEdit=false;render();window.scrollTo({top:0})}
    if(a==='add-concern')openConcernNew();if(a==='add-illness')openIllnessNew();if(a==='add-report')openLabForm('prescription');
    if(a==='add-upcoming')openForm('appointment',{details:{status:'upcoming'}});
    if(a==='copy-plan'){plansFor(V.planYear-1).forEach(p=>D.plans.push({...p,id:'p-'+uid(),year:V.planYear}));save();render()}
    if(a==='health-card')openCard();
    if(a==='new-exp')openNewExperiment();
    if(a==='exp-back'){V.exp=null;render();window.scrollTo({top:0})}
    if(a==='exp-edit')openExpEdit();
    if(a==='exp-del'){if(!el.dataset.armed){el.dataset.armed=1;el.textContent='Tap again to delete';return}D.challenges=D.challenges.filter(x=>x.id!==V.exp);V.exp=null;save();render()}
    if(a==='plan-cats')openPlanCats();
    if(a==='cycle-on'||a==='cycle-off'){D.settings.cycle_on=a==='cycle-on';save();render()}
    if(a==='add-plan')openPlan();if(a==='add-course')openCourseForm();if(a==='add-appt')openForm('appointment',{details:{status:'done'}});
    if(a==='add-lab')openLabForm();if(a==='add-regimen')openRegimen({});if(a==='add-diet')openRegimen({category:'diet'});if(a==='add-challenge')openChallenge();
    if(a==='copy-csv'){const ta=$('#csvOut');const done=m=>{$('#copyMsg').textContent=m};try{navigator.clipboard.writeText(ta.value).then(()=>done('Copied.'),()=>{ta.select();done('Selected. Press Ctrl+C or Cmd+C to copy.')})}catch(_){ta.select();done('Selected. Press Ctrl+C or Cmd+C to copy.')}}
  }
});
$('#view').addEventListener('input',e=>{const hx=e.target.closest('[data-hexcolor]');if(hx){const t=hx.parentElement.querySelector('[data-hextext]');if(t)t.value=hx.value;return}
  if(e.target.id==='concQ'){V.concQ=e.target.value;const sec=e.target.closest('section');const past=D.concerns.filter(c=>!isIllness(c)&&c.status==='resolved').sort((a,b)=>(a.resolved_on||'')<(b.resolved_on||'')?1:-1),needle=V.concQ.trim().toLowerCase();sec.querySelector('.rgrid').innerHTML=past.filter(c=>!needle||[c.title,c.notes||'',...c.regions.map(rl)].join(' ').toLowerCase().includes(needle)).map(concernCard).join('')||'<div class="empty">Nothing matches.</div>';return}
  if(e.target.id==='archQ'){V.archQ=e.target.value;const sec=e.target.closest('section');const past=D.regimens.filter(r=>regimenStopped(r)).sort((a,b)=>(a.ended_on||'')<(b.ended_on||'')?1:-1),kind=V.archKind||'all',needle=V.archQ.trim().toLowerCase();
    const shown=past.filter(r=>(kind==='all'||(kind==='diet')===(r.category==='diet'))&&(!needle||[r.name,r.dose,r.frequency,r.notes,catLabel(r.category)].join(' ').toLowerCase().includes(needle)));
    sec.querySelector('.rgrid').innerHTML=shown.map(r=>regCard(r,true)).join('')||'<div class="empty">Nothing matches.</div>';return}
  const el=e.target.closest('[data-cb="title"]');if(!el)return;const c=D.charts.find(x=>x.id===V.editChart);if(!c)return;c.title=el.value;const h=el.closest('.ccard').querySelector('[data-ctitle]');h.textContent=c.title||'Untitled chart';save()});
$('#view').addEventListener('change',e=>{const hx=e.target.closest('[data-hexcolor]');if(hx){const c=D.charts.find(x=>x.id===V.editChart);if(c){c[hx.dataset.hexcolor+'Color']=hx.value;save();render()}return}
  const more=e.target.closest('[data-cbmore]');if(more){const c=D.charts.find(x=>x.id===V.editChart);if(c&&more.value){const k=more.dataset.cbmore;c[k+'More']=[...(c[k+'More']||[]),more.value];save();render()}return}
  const el=e.target.closest('[data-cb]');if(!el||el.dataset.cb==='title')return;const c=D.charts.find(x=>x.id===V.editChart);if(!c)return;
  if(el.dataset.cb==='reg'){c.reg=el.value||undefined;save();render();return}
  c[el.dataset.cb]=el.value||null;if((el.dataset.cb==='y1'||el.dataset.cb==='y2')&&el.value){const t=lineSeries(el.value);if(t&&(t.rating||t.monthly))c[el.dataset.cb+'Type']='column'}save();render()});
$('#view').addEventListener('input',e=>{const mn=e.target.closest('[data-cbmin],[data-cbmax]');if(!mn)return;const c=D.charts.find(x=>x.id===V.editChart);if(!c)return;const k=mn.dataset.cbmin||mn.dataset.cbmax,r=c[k+'Range']||[null,null],v=mn.value.trim()===''||isNaN(+mn.value)?null:+mn.value;
  c[k+'Range']=mn.dataset.cbmin?[v,r[1]]:[r[0],v];save();const box=document.querySelector(`[data-cbox="${c.id}"]`);if(box)drawChart(box,c)});
document.addEventListener('click',e=>{if(!e.target.closest('.mwrap'))document.querySelectorAll('.cmenu').forEach(m=>m.hidden=true)});
$('#basePhotoInput').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;const src=await shrink(f);if(src){D.basePhoto=src;D.basePhotoPath=null;D.basePhotoEnc=false;save();V.frame=null;V.editing=true;V.editGroup='one';EDIT_SNAP=D.points.map(p=>({...p}));render()}e.target.value=''});
let rz;window.addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{paintCharts();paintCourses()},150)});
/* ---------- storage, sign-in and start-up ---------- */
const fname=f=>!f?'':typeof f==='string'?f:(f.name||'file');
function emptyData(){
  const s=sample();
  return {...s,reminders:[],cycle:[],regLogs:[],settings:{},entries:[],concerns:[],regimens:[],labs:[],challenges:[],plans:[],courses:[],hk:{},suggestions:[],charts:[],chartZones:null,basePhoto:null,basePhotoPath:null,
    metrics:{weight:{l:'Weight',u:'kg'},body_fat:{l:'Body fat',u:'%'},height:{l:'Height',u:'cm'}},
    widgets:{left:[{id:uid(),type:'challenge'},{id:uid(),type:'regimens'}],right:[{id:uid(),type:'plan'},{id:uid(),type:'appointments'},{id:uid(),type:'concerns'}]}};
}
// Points come in two levels: regions on the body, and points on a region's canvas (`parent`). Older data had one level with
// the face's points marked zone:'head': those become the face's points; arms, legs and feet become a left and a right; hands,
// mouth and the rest of the head move off the body (they are points now). Done once, then marked in the settings (points_v = 2),
// the same migration the phone runs.
function migratePoints(d){
  if(!d.points.length){d.points=defaultPoints();d.settings.points_v=2;return}
  if(d.settings.points_v!==2){
    const out=[];
    for(const p0 of d.points){const p={...p0};
      if(p.zone==='head'){delete p.zone;if(['face','scalp','neck'].includes(p.region))continue;p.parent='face';out.push(p);continue}
      delete p.zone;if(p.parent){out.push(p);continue}
      const lr=(l,r)=>+p.x<50?r:l;// the figure faces you
      if(p.region==='arms')p.region=lr('arm_l','arm_r');else if(p.region==='legs')p.region=lr('leg_l','leg_r');else if(p.region==='feet')p.region=lr('foot_l','foot_r');
      else if(['hands','mouth','eyes','nose','ears','teeth'].includes(p.region))continue;
      out.push(p)}
    DEFAULT_POINTS_RAW.forEach(([region,x,y,side])=>{if(!out.some(p=>!p.parent&&p.region===region))out.push({id:uid(),region,x,y,...(side==='back'?{side}:{})})});
    new Set(DEFAULT_SUB_RAW.map(s=>s[0])).forEach(par=>{if(!out.some(p=>p.parent===par))DEFAULT_SUB_RAW.filter(s=>s[0]===par).forEach(([parent,region,x,y])=>out.push({id:uid(),region,x,y,parent}))});
    d.points=out;d.settings.points_v=2}
  // older software may still add head-drawing points; they are the face's points already
  d.points=d.points.filter(p=>p.zone!=='head');d.points.forEach(p=>{delete p.zone;if(!p.id)p.id=uid()});
}
// Regimens that were copied to start again (same name and kind, dates apart) become one regimen with stints; once per
// profile (regimens_v = 2). Logs, challenge links, reminders and chart bands follow to the kept one.
function mergeStints(d){
  if(d.settings.regimens_v===2)return;d.settings.regimens_v=2;
  const regs=d.regimens,key=r=>`${r.category}|${(r.name||'').trim().toLowerCase()}`,groups=new Map();
  regs.forEach(r=>{const k=key(r);groups.set(k,[...(groups.get(k)||[]),r])});
  const gone=new Map();
  groups.forEach(g=>{if(g.length<2)return;g.sort((a,b)=>a.started_on<b.started_on?-1:1);const keep=g[0];
    let stints=keep.periods&&keep.periods.length?keep.periods.slice():[{from:keep.started_on,to:keep.ended_on}];
    for(const r of g.slice(1)){const last=stints[stints.length-1];if(!last.to||last.to>=r.started_on)continue;// they overlap: two different things after all
      stints=[...stints,...(r.periods&&r.periods.length?r.periods:[{from:r.started_on,to:r.ended_on}])];
      if((r.dose||'')!==(keep.dose||'')||(r.frequency||'')!==(keep.frequency||'')){keep.changes=[...(keep.changes||[]),{on:r.started_on,dose:r.dose||'',frequency:r.frequency||'',prev_dose:keep.dose||'',prev_frequency:keep.frequency||''}].sort((a,b)=>a.on<b.on?-1:1);keep.dose=r.dose;keep.frequency=r.frequency}
      keep.changes=[...(keep.changes||[]),...(r.changes||[])].sort((a,b)=>a.on<b.on?-1:1);
      if(r.notes&&r.notes!==keep.notes)keep.notes=[keep.notes,r.notes].filter(Boolean).join('\n');
      if(r.photos&&r.photos.length){const have=new Set((keep.photos||[]).map(p=>p.path||p.src));keep.photos=[...(keep.photos||[]),...r.photos.filter(p=>!have.has(p.path||p.src))]}
      keep.regions=[...new Set([...(keep.regions||[]),...(r.regions||[])])];
      if(!keep.concern_id)keep.concern_id=r.concern_id;if(!keep.target&&r.target)keep.target=r.target;
      gone.set(r.id,keep.id)}
    const s=stints.map(p=>({from:p.from,to:p.to||null})).sort((a,b)=>a.from<b.from?-1:1);
    keep.started_on=s[0].from;keep.ended_on=s[s.length-1].to;if(s.length>1)keep.periods=s;else delete keep.periods});
  if(!gone.size)return;const to=id=>gone.get(id)||id;
  d.regimens=regs.filter(r=>!gone.has(r.id));
  (d.regLogs||[]).forEach(l=>{l.regimen_id=to(l.regimen_id)});
  (d.challenges||[]).forEach(c=>{c.regimen_ids=[...new Set((c.regimen_ids||[]).map(to))];(c.rules||[]).forEach(r=>{if(r.regimen)r.regimen=to(r.regimen)})});
  (d.reminders||[]).forEach(m=>{if(m.target_kind==='regimen'&&m.target_id)m.target_id=to(m.target_id)});
  (d.charts||[]).forEach(c=>{c.bands=[...new Set((c.bands||[]).map(to))];['y1','y2'].forEach(k=>{if(typeof c[k]==='string'&&c[k].startsWith('r:'))c[k]='r:'+to(c[k].slice(2))})});
}
function normalize(d){
  const base=emptyData();
  ['entries','concerns','regimens','labs','challenges','plans','courses','suggestions','charts'].forEach(k=>{if(!Array.isArray(d[k]))d[k]=[]});
  if(!d.metrics||!Object.keys(d.metrics).length)d.metrics=base.metrics;
  if(!d.hk)d.hk={};
  if(!Array.isArray(d.points))d.points=[];
  if(!d.settings)d.settings={};
  migratePoints(d);
  mergeStints(d);
  if(!d.customRegions)d.customRegions={};
  if(!d.widgets||!d.widgets.left)d.widgets=base.widgets;
  if(!Array.isArray(d.widgets.right))d.widgets.right=[];
  if(!d.chartLayout)d.chartLayout='top';
  if(!Array.isArray(d.regLogs))d.regLogs=[];
  if(!Array.isArray(d.cycle))d.cycle=[];
  if(!Array.isArray(d.reminders))d.reminders=[];
  d.challenges.forEach(c=>{if(!c.kind)c.kind='challenge';if(!c.config)c.config={};if(!Array.isArray(c.rules))c.rules=[];if(!Array.isArray(c.regimen_ids))c.regimen_ids=[]});
  d.concerns.forEach(c=>{if(!c.tracking)c.tracking={};if(!Array.isArray(c.regions))c.regions=[];
    if(c.kind==='illness'){
      // an illness keeps its episodes; a side that did not know them may have moved the dates, so the first and last episode follow the row's dates
      if(!Array.isArray(c.episodes)||!c.episodes.length)c.episodes=c.started_on?[{from:c.started_on,to:c.resolved_on||null}]:[];
      c.episodes=c.episodes.filter(e=>e&&e.from).map(e=>({from:e.from,to:e.to||null,...(e.label?{label:e.label}:{}),...(e.notes?{notes:e.notes}:{})})).sort((a,b)=>a.from<b.from?-1:1);
      if(c.episodes.length){const first=c.episodes[0],last=c.episodes[c.episodes.length-1];
        if(c.started_on&&c.started_on!==first.from&&c.started_on<(first.to||'9999'))first.from=c.started_on;
        if((c.resolved_on||null)!==(last.to||null)&&(!c.resolved_on||c.resolved_on>=last.from))last.to=c.resolved_on||null;
        c.started_on=first.from;c.resolved_on=c.episodes.some(e=>!e.to)?null:c.episodes.reduce((m,e)=>e.to>m?e.to:m,last.to);c.status=c.resolved_on?'resolved':'active'}
    }else if(c.kind)delete c.kind});
  d.charts.forEach(c=>{
    if(c.kind==='days'){// the old bars chart: a count per month is a series on the left axis now, drawn as columns
      const pre=c.count==='sessions'?'done:':'sick:',g=(c.groups||[]).map(id=>pre+id),ids=g.length?g:['sick:all'];
      c.y1=ids[0];if(ids.length>1)c.y1More=ids.slice(1);c.y1Type='column';c.range=(c.months||12)>=24?'all':(c.months||12)<=6?'6m':'12m';
      delete c.kind;delete c.count;delete c.groups;delete c.months}
    c.y1Type=c.y1Type||'line';c.y2Type=c.y2Type||'line';c.bands=c.bands||[];c.photos=c.photos||[];c.sessions=c.sessions||[]});
  d.entries.forEach(e=>{e.photos=e.photos||[];e.files=e.files||[];e.details=e.details||{};e.regions=e.regions||[]});
  d.labs.forEach(l=>{if(!Array.isArray(l.results))l.results=[];if(!l.kind)l.kind='lab'});
  if(d.basePhoto===undefined)d.basePhoto=null;if(d.basePhotoPath===undefined)d.basePhotoPath=null;d.basePhotoEnc=!!d.basePhotoEnc;
  return d;
}
const ACCENTS=[['Soft Launched maroon','#8B0000'],['Lime','#CDEE45'],['Periwinkle','#4F5BF5'],['Sage','#4F8A62'],['Clay','#C2693F']];
function contrastOn(hex){const ch=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};const n=parseInt(hex.slice(1),16),L=.2126*ch(n>>16&255)+.7152*ch(n>>8&255)+.0722*ch(n&255);return (1.05)/(L+.05)>=(L+.05)/(.0122+.05)?'#FFFFFF':'#16180F'}
function applyAccent(hex){if(!/^#[0-9a-f]{6}$/i.test(hex||''))hex=CFG.accent||'#CDEE45';const st=document.documentElement.style;st.setProperty('--accent',hex);st.setProperty('--on-accent',contrastOn(hex));st.setProperty('--accent-soft',`color-mix(in srgb, ${hex} 13%, var(--card))`)}
function openAppearance(){
  const cur=((D.settings||{}).accent||CFG.accent||'#CDEE45').toUpperCase();
  openSheet(`<div class="sheet-h"><h3>Accent colour</h3><button class="x" type="button" aria-label="Close">✕</button></div>
   <p style="margin:0 0 14px;color:var(--muted);font-size:13px">Used for buttons, highlights, the app icon and the tinted widgets. Change it any time.</p>
   <div class="accs" id="accs">${ACCENTS.map(([n,h])=>`<button type="button" class="acc${h===cur?' on':''}" data-acc="${h}"><span style="background:${h}"></span>${esc(n)}</button>`).join('')}</div>
   <div class="palrow hexrow" style="justify-content:flex-start;gap:12px"><span>Custom</span><div style="align-items:center"><input type="color" id="accPick" value="${cur}" aria-label="Pick any colour"><input class="inp" id="accHex" value="${cur}" maxlength="7" aria-label="Hex colour"></div></div>`);
  const set=h=>{h=h.toUpperCase();D.settings=D.settings||{};D.settings.accent=h;applyAccent(h);save();document.querySelectorAll('#accs .acc').forEach(b=>b.classList.toggle('on',b.dataset.acc===h));$('#accPick').value=h;$('#accHex').value=h};
  $('#accs').addEventListener('click',e=>{const b=e.target.closest('[data-acc]');if(b)set(b.dataset.acc)});
  $('#accPick').addEventListener('input',e=>set(e.target.value));
  $('#accHex').addEventListener('input',e=>{const v=e.target.value.trim();if(/^#[0-9a-f]{6}$/i.test(v))set(v)});
}
/* ---------- security: photo vault + two-step ---------- */
const vaultOn=()=>STORE&&STORE.mode==='supabase';
const vaultState=()=>vaultOn()?STORE.vaultState(D&&D.settings&&D.settings.vault):'none';
function vaultReady(){return !vaultOn()||vaultState()==='unlocked'}
async function hydrateVault(root=document){
  if(!vaultOn())return;
  for(const img of root.querySelectorAll('img[data-vault]:not([data-done])')){
    img.dataset.done='1';
    if(vaultState()!=='unlocked'){img.classList.add('locked');continue}
    try{img.src=await STORE.photoUrl(img.dataset.vault)}catch(e){img.classList.add('locked')}
  }
}
new MutationObserver(()=>hydrateVault()).observe(document.documentElement,{childList:true,subtree:true});
function vaultBar(){const st=vaultState();return st==='locked'?`<div class="vaultbar"><span>Photos and files are locked on this device.</span><button type="button" class="btn-dark btn-sm" data-act="vault-unlock">Unlock</button></div>`:''}
function openVaultSetup(after){
  openSheet(`<div class="sheet-h"><h3>Encrypt your photos and files</h3><button class="x" type="button" aria-label="Close">✕</button></div>
   <p style="margin:0 0 10px;color:var(--muted);font-size:13px">Photos and files are encrypted on this device before they're uploaded, with a passphrase only you know. Supabase stores scrambled data it can't open. Nobody else can either, including anyone who gets into your Supabase account.</p>
   <div class="rcard" style="background:var(--accent-soft);margin-bottom:12px"><span class="t">This passphrase can't be recovered.</span><span class="s">It's separate from your sign-in password. If you lose it, your encrypted photos and files are unreadable forever. Store it in a password manager.</span></div>
   <form class="form" id="vsForm" novalidate><div class="f"><label for="vs_p">Passphrase (at least 10 characters)</label><input id="vs_p" type="password" autocomplete="new-password"></div>
   <div class="f"><label for="vs_p2">Type it again</label><input id="vs_p2" type="password" autocomplete="new-password"></div>
   <div class="form-acts"><span></span><button class="btn-accent" type="submit">Turn on encryption</button></div><div class="err" id="vsErr"></div></form>`);
  $('#vsForm').addEventListener('submit',async e=>{e.preventDefault();const p=$('#vs_p').value,p2=$('#vs_p2').value;if(p.length<10)return $('#vsErr').textContent='Use at least 10 characters.';if(p!==p2)return $('#vsErr').textContent="The two passphrases don't match.";
    $('#vsErr').textContent='Setting up…';try{D.settings.vault=await STORE.vaultSetup(p);save();closeSheet();render();after&&after()}catch(err){$('#vsErr').textContent=err.message||String(err)}});
}
function openVaultUnlock(after){
  openSheet(`<div class="sheet-h"><h3>Unlock photos and files</h3><button class="x" type="button" aria-label="Close">✕</button></div>
   <p style="margin:0 0 12px;color:var(--muted);font-size:13px">Enter your photo passphrase. This device remembers it until you choose Forget on this device.</p>
   <form class="form" id="vuForm" novalidate><div class="f"><label for="vu_p">Passphrase</label><input id="vu_p" type="password" autocomplete="current-password"></div>
   <div class="form-acts"><span></span><button class="btn-accent" type="submit">Unlock</button></div><div class="err" id="vuErr"></div></form>`);
  $('#vuForm').addEventListener('submit',async e=>{e.preventDefault();$('#vuErr').textContent='Checking…';try{await STORE.vaultUnlock($('#vu_p').value,D.settings.vault);const d=await STORE.load();if(d)D=normalize(d);closeSheet();V.frame=null;render();after&&after()}catch(err){$('#vuErr').textContent=err.message||String(err)}});
}
// before choosing a photo or file in synced mode, encryption must be ready on this device
function needVault(){if(vaultReady())return false;closeSheet();vaultState()==='none'?openVaultSetup():openVaultUnlock();return true}
async function openSecurity(){
  if(!vaultOn()){alertSheet('Security','Everything stays in this browser on this computer, so there is no account to protect. Export backups regularly and keep them somewhere safe.');return}
  let mfa=false;try{mfa=await STORE.mfaEnabled()}catch(_){}
  const vs=vaultState();
  openSheet(`<div class="sheet-h"><h3>Security</h3><button class="x" type="button" aria-label="Close">✕</button></div>
   <div class="list">
    <div class="row" style="align-items:flex-start"><span><span class="t">Two-step sign-in</span><br><span class="s">${mfa?'On. Signing in needs a code from your authenticator app, and the database refuses any session without it.':'Off. Anyone with your password could sign in.'}</span></span>${mfa?'<span class="pill">On</span>':'<button type="button" class="btn-accent btn-sm" id="secMfa">Turn on</button>'}</div>
    <div class="row" style="align-items:flex-start"><span><span class="t">Encrypted photos and files</span><br><span class="s">${vs==='none'?'Off. Turn this on before adding photos.':vs==='unlocked'?'On, and unlocked on this device.':'On, but locked on this device.'}</span></span>${vs==='none'?'<button type="button" class="btn-accent btn-sm" id="secVault">Turn on</button>':vs==='locked'?'<button type="button" class="btn-dark btn-sm" id="secUnlock">Unlock</button>':'<button type="button" class="btn-ghost btn-sm" id="secForget">Forget on this device</button>'}</div>
   </div>`);
  const on=(id,fn)=>{const b=$(id);b&&b.addEventListener('click',fn)};
  on('#secMfa',openMfaSetup);on('#secVault',()=>openVaultSetup());on('#secUnlock',()=>openVaultUnlock());
  on('#secForget',async()=>{await STORE.vaultForget();const d=await STORE.load();if(d)D=normalize(d);closeSheet();render()});
}
async function openMfaSetup(){
  openSheet(`<div class="sheet-h"><h3>Turn on two-step sign-in</h3><button class="x" type="button" aria-label="Close">✕</button></div><div id="mfaBody"><p class="empty">Preparing…</p></div>`);
  try{const d=await STORE.mfaEnroll();
    $('#mfaBody').innerHTML=`<p style="margin:0 0 12px;color:var(--muted);font-size:13px">Scan this with an authenticator app (1Password, Google Authenticator, Authy), then enter the 6-digit code it shows.</p>
     <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-bottom:12px"><img src="${esc(d.totp.qr_code)}" alt="QR code for your authenticator app" width="180" height="180" style="background:#fff;border-radius:12px;padding:8px"><div class="s" style="font-size:12px;color:var(--muted);max-width:240px">Can't scan? Enter this key instead:<br><code style="font-family:var(--font-data);color:var(--ink);word-break:break-all">${esc(d.totp.secret)}</code></div></div>
     <form class="form" id="mfaForm" novalidate><div class="f"><label for="mfa_c">6-digit code</label><input id="mfa_c" inputmode="numeric" autocomplete="one-time-code" maxlength="6"></div><div class="form-acts"><span></span><button class="btn-accent" type="submit">Turn on</button></div><div class="err" id="mfaErr"></div></form>`;
    $('#mfaForm').addEventListener('submit',async e=>{e.preventDefault();try{await STORE.mfaVerify(d.id,$('#mfa_c').value.trim());closeSheet();openSecurity()}catch(err){$('#mfaErr').textContent=err.message||String(err)}});
  }catch(err){$('#mfaBody').innerHTML=`<p class="err">${esc(err.message||String(err))}</p>`}
}
function showMfaChallenge(){
  $('#app').hidden=true;$('#fab').hidden=true;const a=$('#authView');a.hidden=false;
  a.innerHTML=`<div class="auth"><div class="brand" style="margin-bottom:18px"><div class="mark" aria-hidden="true"><span></span></div><div><small>My OS</small><b>Health</b></div></div>
   <h1 style="font-size:22px;margin-bottom:6px">Enter your code</h1><p style="margin:0 0 16px;color:var(--muted);font-size:13px">Open your authenticator app and enter the 6-digit code for My OS Health.</p>
   <form class="form" id="mfaIn" novalidate><div class="f"><label for="mi_c">Code</label><input id="mi_c" inputmode="numeric" autocomplete="one-time-code" maxlength="6"></div>
   <div class="form-acts"><button type="button" class="btn-ghost" id="mi_out">Sign out</button><button type="submit" class="btn-accent">Continue</button></div><div class="err" id="mi_err"></div></form></div>`;
  $('#mfaIn').addEventListener('submit',async e=>{e.preventDefault();try{await STORE.mfaSignIn($('#mi_c').value.trim());boot()}catch(err){$('#mi_err').textContent=err.message||String(err)}});
  $('#mi_out').addEventListener('click',async()=>{await STORE.signOut();location.reload()});
}
function setSync(st,msg){
  const el=$('#sync');if(!el)return;
  el.className='sync '+st;
  el.textContent=st==='saving'?'Saving…':st==='saved'?(STORE&&STORE.mode==='local'?'Saved on this computer':'Saved'):st==='error'?'Not saved yet. Retrying':'';
  el.title=msg||'';
  if(st==='error'&&/locked/i.test(msg||''))el.textContent='Photos locked. Not saved';
  const m=$('#tmSaved');if(m)m.textContent=el.textContent;
}
async function openFile(f){
  try{const u=await STORE.fileUrl(f);if(u)window.open(u,'_blank','noopener')}catch(e){alertSheet('Could not open that file',e.message||String(e))}
}
function alertSheet(title,msg){openSheet(`<div class="sheet-h"><h3>${esc(title)}</h3><button class="x" type="button" aria-label="Close">✕</button></div><p class="alertp" style="margin:0;color:var(--muted)">${esc(msg)}</p>`)}
async function exportData(){
  const copy=JSON.parse(JSON.stringify(D,(k,v)=>v instanceof Blob?undefined:v));
  // carry local-only file blobs inside the backup
  const toUrl=b=>new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result);fr.readAsDataURL(b)});
  for(let i=0;i<D.entries.length;i++)for(let j=0;j<(D.entries[i].files||[]).length;j++){const f=D.entries[i].files[j];if(f.blob)copy.entries[i].files[j].dataUrl=await toUrl(f.blob)}
  for(let i=0;i<D.labs.length;i++){const f=D.labs[i].file;if(f&&f.blob)copy.labs[i].file.dataUrl=await toUrl(f.blob)}
  copy._exported=new Date().toISOString();copy._app='myos-health';
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(copy)],{type:'application/json'}));a.download=`myos-health-backup-${TODAY}.json`;document.body.appendChild(a);a.click();a.remove();
}
function importData(){
  const inp=document.createElement('input');inp.type='file';inp.accept='application/json,.json';
  inp.onchange=async()=>{const f=inp.files[0];if(!f)return;try{const d=JSON.parse(await f.text());if(!['myos-health','myos-body'].includes(d._app)||!Array.isArray(d.entries))throw new Error('This is not a My OS Health backup.');
    openSheet(`<div class="sheet-h"><h3>Replace your data with this backup?</h3><button class="x" type="button" aria-label="Close">✕</button></div><p style="margin:0 0 14px;color:var(--muted)">Backup from ${esc((d._exported||'').slice(0,10))} with ${d.entries.length} entries. Everything currently in the app is replaced.</p><div class="form-acts"><span></span><button class="btn-accent" type="button" id="impGo">Replace with backup</button></div>`);
    $('#impGo').addEventListener('click',()=>{D=normalize(d);delete D._exported;delete D._app;if(STORE.mode==='supabase'){D.entries.forEach(e=>e.photos.forEach(p=>{if(p.src&&!p.src.startsWith('data:'))delete p.path}));}save();closeSheet();V.frame=null;render()});
  }catch(e){alertSheet('Could not read that file',e.message||String(e))}};
  inp.click();
}
// one list of actions: buttons in the footer on a computer, the ⋯ menu on a phone (as in the My OS app)
function menuActs(){
  const local=STORE.mode==='local';
  const sample=()=>{openSheet(`<div class="sheet-h"><h3>Load sample data?</h3><button class="x" type="button" aria-label="Close">✕</button></div><p style="margin:0 0 14px;color:var(--muted)">Fills the app with fictional records so you can explore it. Your current data is replaced, so export a backup first if you have any.</p><div class="form-acts"><span></span><button class="btn-accent" type="button" id="smpGo">Load sample data</button></div>`);$('#smpGo').onclick=()=>{D=normalize(sample());save();closeSheet();V.frame=null;render()}};
  return [['My OS'],['About',openAbout],['Accent colour',openAppearance],['Health'],...(STORE.mode==='supabase'?[['Security',openSecurity]]:[]),...(CFG.preview?[]:[['Export backup',exportData],['Import backup',importData]]),
    local?['Load sample data',sample]:['Sign out',async()=>{await STORE.signOut();location.reload()}]];
}
function closeMenu(){$('#tmenu').hidden=true;$('#menuBtn').setAttribute('aria-expanded','false')}
function renderFooter(){
  const local=STORE.mode==='local',acts=menuActs();
  $('#footActs').innerHTML=acts.map((a,i)=>a[1]?`<button class="btn-ghost" type="button" data-fa="${i}">${a[0]}</button>`:'').join('');
  $('#tmenu').innerHTML=acts.map((a,i)=>a[1]?`<button type="button" role="menuitem" data-fa="${i}">${a[0]}</button>`:`<small>${a[0]}</small>`).join('')+
    `<p id="tmSaved"></p><p>${CFG.preview?'Sample data. Lives only in this browser.':local?'Stored only in this browser.':'Synced to your own Supabase project.'}</p>`;
  document.querySelectorAll('[data-fa]').forEach(b=>b.onclick=()=>{closeMenu();acts[+b.dataset.fa][1]()});
  const sv=$('#sync');$('#tmSaved').textContent=sv?sv.textContent:'';
  $('#modeNote').innerHTML=CFG.preview?'<b>Preview with sample data.</b> It lives only in this browser and can\'t be exported from here. To keep real records, set it up from the Soft Launched flow.':local?'Stored only in this browser on this computer. Export a backup now and then.':'Synced to your own Supabase project.';
}
function showAuth(msg){
  $('#app').hidden=true;$('#fab').hidden=true;const a=$('#authView');a.hidden=false;
  a.innerHTML=`<div class="auth"><div class="brand" style="margin-bottom:18px"><div class="mark" aria-hidden="true"><span></span></div><div><small>My OS</small><b>Health</b></div></div>
   <h1 style="font-size:22px;margin-bottom:6px">Sign in</h1><p class="s" style="margin:0 0 16px;color:var(--muted);font-size:13px">Your records live in your own Supabase project. Only you can read them.</p>
   <form class="form" id="authForm" novalidate><div class="f"><label for="au_e">Email</label><input id="au_e" type="email" autocomplete="email" required></div>
   <div class="f"><label for="au_p">Password</label><input id="au_p" type="password" autocomplete="current-password" required minlength="8"></div>
   <div class="form-acts"><button type="button" class="btn-ghost" id="au_new">Create my account</button><button type="submit" class="btn-accent">Sign in</button></div><div class="err" id="au_err">${esc(msg||'')}</div></form>
   <p class="s" style="margin:16px 0 0;color:var(--muted);font-size:12px">Create an account once. Then turn off new sign-ups in Supabase so nobody else can.</p></div>`;
  const go=async up=>{const e=$('#au_e').value.trim(),p=$('#au_p').value;$('#au_err').textContent='';if(!e||p.length<8){$('#au_err').textContent='Enter your email and a password of at least 8 characters.';return}
    try{if(up){const confirm=await STORE.signUp(e,p);if(confirm){$('#au_err').textContent='Check your email to confirm your account, then sign in here.';return}}else await STORE.signIn(e,p);if(await STORE.mfaNeeded())return showMfaChallenge();boot()}catch(err){$('#au_err').textContent=err.message||String(err)}};
  $('#authForm').addEventListener('submit',ev=>{ev.preventDefault();go(false)});$('#au_new').addEventListener('click',()=>go(true));
}
async function boot(){
  $('#authView').hidden=true;$('#app').hidden=false;$('#fab').hidden=false;
  setSync('saving');$('#sync').textContent='Loading…';
  let data;
  try{data=await STORE.load()}catch(e){$('#view').innerHTML=`<section class="card"><h2>Could not load your data</h2><p class="s" style="color:var(--muted)">${esc(e.message||String(e))}</p><button class="btn-dark" type="button" onclick="location.reload()">Try again</button></section>`;setSync('error',e.message);return}
  const fresh=!data;
  D=normalize(data||(CFG.sample?sample():emptyData()));
  applyAccent(D.settings.accent||CFG.accent);
  renderFooter();render();
  if(fresh)save();else setSync('saved');
  let loadedAt=Date.now();
  // photo links expire after 30 minutes: quietly reload while the app is open and idle
  setInterval(async()=>{if(STORE.mode!=='supabase'||document.visibilityState!=='visible'||$('#overlay').innerHTML||V.editChart||V.customizing||V.editing)return;try{const d=await STORE.load();if(d){D=normalize(d);loadedAt=Date.now();render()}}catch(_){}},25*60*1000);
  document.addEventListener('visibilitychange',async()=>{if(document.visibilityState!=='visible'||STORE.mode!=='supabase'||Date.now()-loadedAt<120000||$('#overlay').innerHTML)return;
    try{const d=await STORE.load();if(d){D=normalize(d);loadedAt=Date.now();render()}}catch(_){}});
}
async function init(){
  applyAccent(CFG.accent);
  try{
    if(CFG.storage==='supabase'){
      if(!window.supabase)await new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';s.integrity='sha384-0w2KAL2YHP6wKOkUDzkCDGgVvfmHnj02DHeQ6XcHOgTfFsGyonKOpShMH1x6nk9o';s.crossOrigin='anonymous';s.onload=res;s.onerror=()=>rej(new Error('Could not load the Supabase library. Check your connection.'));document.head.appendChild(s)});
      STORE=window.MyOSStores.supabase(CFG,{onStatus:setSync});
      if(!(await STORE.session()))return showAuth();
      if(await STORE.mfaNeeded())return showMfaChallenge();
    }else STORE=window.MyOSStores.local(CFG,{onStatus:setSync});
    await boot();
  }catch(e){$('#authView').hidden=false;$('#authView').innerHTML=`<div class="auth"><h1>Something went wrong</h1><p>${esc(e.message||String(e))}</p></div>`}
}
init();

})();
