import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hsomjtpoqmtymuvzymik.supabase.co';
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/^SUPABASE_SERVICE_ROLE_KEY=/, '').trim();
const rapidApiKey = process.env.RAPID_API_KEY;

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

async function fetchJSearchJobs() {
  if (!rapidApiKey) {
    console.error('❌ خطأ: مفتاح RAPID_API_KEY غير موجود في Secrets!');
    return [];
  }

  const queries = ['jobs in Egypt', 'Cairo jobs', 'مبيعات مصر'];
  let allMappedJobs = [];

  for (const query of queries) {
    try {
      const url = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(query)}&page=1&num_pages=1`;
      console.log(`🔍 جاري البحث عن: ${query}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': rapidApiKey,
          'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
        }
      });
      
      const data = await response.json();
      console.log(`📥 استجابة API لـ ${query}:`, data?.data ? `${data.data.length} وظيفة` : 'لا توجد بيانات');

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
        allMappedJobs.push(...mapped);
      }
    } catch (err) {
      console.error(`❌ خطأ في جلب ${query}:`, err.message);
    }
  }

  return allMappedJobs;
}

async function run() {
  console.log('🇪🇬 بدء سحب وظائف مصر عبر JSearch API...');
  const jobs = await fetchJSearchJobs();
  console.log(`📦 إجمالي الوظائف المجمعة: ${jobs.length}`);

  if (jobs.length > 0) {
    const { error } = await supabase
      .from('jobs')
      .upsert(jobs, { onConflict: 'external_id', ignoreDuplicates: true });

    if (error) {
      console.error('❌ خطأ في الحفظ بقاعدة البيانات:', error.message);
    } else {
      console.log('✅ تم حفظ الوظائف الجديدة بنجاح في Supabase!');
    }
  } else {
    console.log('⚠️ لم يتم العثور على وظائف جديدة لإضافتها.');
  }
}

run();
