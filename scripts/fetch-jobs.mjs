import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

function detectCategory(title) {
  const t = (title || '').toLowerCase();
  if (t.includes('sales') || t.includes('مبيعات') || t.includes('عقارات') || t.includes('real estate') || t.includes('account manager') || t.includes('business development')) return 'مبيعات وعقارات';
  if (t.includes('developer') || t.includes('software') || t.includes('engineer') || t.includes('برمجة') || t.includes('it') || t.includes('sap') || t.includes('data') || t.includes('frontend') || t.includes('backend') || t.includes('full stack')) return 'تكنولوجيا ومعلومات';
  if (t.includes('accountant') || t.includes('محاسب') || t.includes('finance') || t.includes('مالي') || t.includes('payroll')) return 'محاسبة ومالية';
  if (t.includes('civil') || t.includes('architect') || t.includes('مدني') || t.includes('معماري') || t.includes('construction') || t.includes('mechanical')) return 'هندسة وإنشاءات';
  if (t.includes('marketing') || t.includes('تسويق') || t.includes('social media') || t.includes('content') || t.includes('seo') || t.includes('copywriter') || t.includes('video') || t.includes('design')) return 'تسويق وصناعة محتوى';
  if (t.includes('hr') || t.includes('موارد بشرية') || t.includes('admin') || t.includes('إداري') || t.includes('support') || t.includes('customer') || t.includes('خدمة عملاء') || t.includes('recruiter')) return 'إدارة وخدمة عملاء';
  return 'وظائف متنوعة';
}

async function fetchRemotiveJobs() {
  try {
    const res = await fetch('https://remotive.com/api/remote-jobs?limit=40');
    const data = await res.json();
    if (!data.jobs) return [];

    return data.jobs.map(job => ({
      external_id: `remotive_${job.id}`,
      title: job.title,
      company: job.company_name || 'شركة عالمية',
      location: 'عمل عن بُعد (متاح في مصر والوطن العربي)',
      country_code: 'EG',
      category: detectCategory(job.title),
      job_type: 'عن بُعد',
      description: job.description ? job.description.replace(/<[^>]*>?/gm, '').slice(0, 240) + '...' : '',
      apply_url: job.url,
      source: 'Remotive',
      published_at: job.publication_date ? new Date(job.publication_date).toISOString() : new Date().toISOString()
    }));
  } catch (err) {
    console.error('Remotive Error:', err.message);
    return [];
  }
}

async function fetchArbeitnowJobs() {
  try {
    const res = await fetch('https://www.arbeitnow.com/api/job-board-api');
    const data = await res.json();
    if (!data.data) return [];

    return data.data.slice(0, 40).map(job => ({
      external_id: `arbeitnow_${job.slug}`,
      title: job.title,
      company: job.company_name || 'شركة دولية',
      location: job.remote ? 'عمل عن بُعد (متاح من مصر)' : (job.location || 'دولي / عن بُعد'),
      country_code: 'EG',
      category: detectCategory(job.title),
      job_type: job.remote ? 'عن بُعد' : 'دوام كامل',
      description: job.description ? job.description.replace(/<[^>]*>?/gm, '').slice(0, 240) + '...' : '',
      apply_url: job.url,
      source: 'Arbeitnow',
      published_at: job.created_at ? new Date(job.created_at * 1000).toISOString() : new Date().toISOString()
    }));
  } catch (err) {
    console.error('Arbeitnow Error:', err.message);
    return [];
  }
}

async function fetchJoobleJobs() {
  const apiKey = process.env.JOOBLE_API_KEY;
  if (!apiKey) return [];

  const queries = ['Egypt', 'Cairo', 'Alexandria', 'Sales Egypt', 'Accountant Egypt'];
  let results = [];

  for (const q of queries) {
    try {
      const response = await fetch(`https://jooble.org/api/${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: q, location: 'Egypt', page: 1 })
      });
      const data = await response.json();
      if (data.jobs) {
        const mapped = data.jobs.map(job => ({
          external_id: `jooble_${job.id}`,
          title: job.title.replace(/<[^>]*>?/gm, ''),
          company: job.company || 'شركة في مصر',
          location: job.location || 'مصر',
          country_code: 'EG',
          category: detectCategory(job.title),
          job_type: job.type || 'دوام كامل',
          description: job.snippet ? job.snippet.replace(/<[^>]*>?/gm, '') : '',
          apply_url: job.link,
          source: 'Jooble Egypt',
          published_at: new Date().toISOString()
        }));
        results.push(...mapped);
      }
    } catch (err) {
      console.error('Jooble Error:', err.message);
    }
  }
  return results;
}

async function run() {
  console.log('🚀 بدء جلب الوظائف لمنصة مرصد الوظائف...');
  const [remotive, arbeitnow, jooble] = await Promise.all([
    fetchRemotiveJobs(),
    fetchArbeitnowJobs(),
    fetchJoobleJobs()
  ]);

  const allJobs = [...jooble, ...remotive, ...arbeitnow];
  console.log(`📦 تم العثور على ${allJobs.length} وظيفة جاهزة للحفظ.`);

  if (allJobs.length > 0) {
    const { error } = await supabase
      .from('jobs')
      .upsert(allJobs, { onConflict: 'external_id', ignoreDuplicates: true });

    if (error) {
      console.error('❌ خطأ في حفظ البيانات:', error.message);
      process.exit(1);
    } else {
      console.log('✅ تم حفظ وتحديث الوظائف في قاعدة البيانات بنجاح!');
    }
  }
}

run();
