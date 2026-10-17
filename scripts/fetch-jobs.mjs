import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hsomjtpoqmtymuvzymik.supabase.co';
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/^SUPABASE_SERVICE_ROLE_KEY=/, '').trim();

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

// سحب الوظائف التي تستهدف السوق المصري والعمل عن بعد المتاح للمصريين
async function fetchEgyptJobs() {
  try {
    // جلب الوظائف المرنة / عن بعد المتاحة في المنطقة العربية ومصر
    const res = await fetch('https://remotive.com/api/remote-jobs?limit=50');
    const data = await res.json();
    if (!data.jobs) return [];

    return data.jobs.map(job => ({
      external_id: `egy_remotive_${job.id}`,
      title: job.title,
      company: job.company_name || 'شركة عالمية',
      location: 'مصر (عن بُعد / Remote)',
      country_code: 'EG', // مخصص لمصر
      category: detectCategory(job.title),
      job_type: 'عن بُعد',
      description: job.description ? job.description.replace(/<[^>]*>?/gm, '').slice(0, 240) + '...' : '',
      apply_url: job.url,
      source: 'Remotive Egypt',
      published_at: job.publication_date ? new Date(job.publication_date).toISOString() : new Date().toISOString()
    }));
  } catch (err) {
    console.error('Egypt Jobs Error:', err.message);
    return [];
  }
}

async function run() {
  console.log('🇪🇬 بدء رصد وجلب الوظائف الخاصة بالسوق المصري...');
  const jobs = await fetchEgyptJobs();

  console.log(`📦 تم العثور على ${jobs.length} فرصة عمل موجهة لمصر.`);

  if (jobs.length > 0) {
    const { error } = await supabase
      .from('jobs')
      .upsert(jobs, { onConflict: 'external_id', ignoreDuplicates: true });

    if (error) {
      console.error('❌ خطأ في الحفظ:', error.message);
      process.exit(1);
    } else {
      console.log('✅ تم تحديث وظائف مصر في قاعدة البيانات بنجاح!');
    }
  }
}

run();
