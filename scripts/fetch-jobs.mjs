import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hsomjtpoqmtymuvzymik.supabase.co';
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/^SUPABASE_SERVICE_ROLE_KEY=/, '').trim();
const rapidApiKey = process.env.RAPID_API_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function detectCategory(title) {
  const t = (title || '').toLowerCase();
  if (t.includes('sales') || t.includes('مبيعات') || t.includes('عقارات') || t.includes('real estate')) return 'مبيعات وعقارات';
  if (t.includes('developer') || t.includes('software') || t.includes('engineer') || t.includes('برمجة') || t.includes('it') || t.includes('data')) return 'تكنولوجيا ومعلومات';
  if (t.includes('accountant') || t.includes('محاسب') || t.includes('finance') || t.includes('مالي')) return 'محاسبة ومالية';
  if (t.includes('civil') || t.includes('architect') || t.includes('مدني') || t.includes('معماري')) return 'هندسة وإنشاءات';
  if (t.includes('marketing') || t.includes('تسويق') || t.includes('social media')) return 'تسويق وصناعة محتوى';
  if (t.includes('hr') || t.includes('موارد بشرية') || t.includes('admin') || t.includes('إداري') || t.includes('خدمة عملاء')) return 'إدارة وخدمة عملاء';
  return 'وظائف متنوعة';
}

async function fetchJSearchJobs() {
  if (!rapidApiKey) {
    console.error('❌ مفتاح RAPID_API_KEY مفقود!');
    return [];
  }

  // كلمات بحث تركز مباشرة على فرص العمل داخل مصر
  const queries = ['Cairo', 'Alexandria', 'Egypt'];
  let allJobs = [];

  for (const q of queries) {
    try {
      const url = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(q)}&page=1&num_pages=1`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': rapidApiKey,
          'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
        }
      });
      const data = await response.json();

      if (data && data.data) {
        const mapped = data.data.map(job => ({
          external_id: `jsearch_${job.job_id}`,
          title: job.job_title || 'وظيفة في مصر',
          company: job.employer_name || 'شركة معتمدة',
          location: job.job_city ? `${job.job_city}, مصر` : 'مصر',
          country_code: 'EG',
          category: detectCategory(job.job_title),
          job_type: job.job_employment_type ? job.job_employment_type.toLowerCase() : 'دوام كامل',
          description: job.job_description ? job.job_description.slice(0, 240) + '...' : '',
          apply_url: job.job_apply_link || job.job_google_link || 'https://google.com',
          source: 'JSearch Egypt',
          published_at: job.job_posted_at_datetime_utc ? new Date(job.job_posted_at_datetime_utc).toISOString() : new Date().toISOString()
        }));
        allJobs.push(...mapped);
      }
    } catch (err) {
      console.error('API Error:', err.message);
    }
  }

  return allJobs;
}

async function run() {
  console.log('🇪🇬 جاري سحب الوظائف عبر JSearch...');
  const jobs = await fetchJSearchJobs();
  console.log(`📦 تم جلب ${jobs.length} وظيفة.`);

  if (jobs.length > 0) {
    const { error } = await supabase
      .from('jobs')
      .upsert(jobs, { onConflict: 'external_id', ignoreDuplicates: true });

    if (error) console.error('Error saving:', error.message);
    else console.log('✅ تم الحفظ بنجاح!');
  }
}

run();
