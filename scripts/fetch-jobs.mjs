import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hsomjtpoqmtymuvzymik.supabase.co';
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/^SUPABASE_SERVICE_ROLE_KEY=/, '').trim();
const apifyToken = process.env.APIFY_API_TOKEN;

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

async function run() {
  console.log('🇪🇬 بدء تشغيل النظام...');

  if (!apifyToken) {
    console.error('❌ خطأ: مفتاح APIFY_API_TOKEN مفقود في إعدادات GitHub Secrets!');
    return;
  }

  // استخدام استعلام مباشر لجلب بيانات تجريبية للتأكد من نجاح الربط
  const datasetUrl = `https://api.apify.com/v2/datasets/last/items?token=${apifyToken}`;
  
  try {
    const response = await fetch(datasetUrl);
    const items = await response.json();

    if (Array.isArray(items) && items.length > 0) {
      console.log(`✅ تم العثور على ${items.length} وظيفة، جاري حفظها...`);
      
      const mappedJobs = items.slice(0, 10).map(job => ({
        external_id: `apify_${job.id || Math.random().toString(36).substr(2, 9)}`,
        title: job.title || 'وظيفة في مصر',
        company: job.company || 'شركة بايت',
        location: job.location || 'مصر',
        country_code: 'EG',
        category: detectCategory(job.title),
        job_type: 'دوام كامل',
        description: (job.description || 'لا توجد تفاصيل').slice(0, 240) + '...',
        apply_url: job.url || 'https://www.bayt.com',
        source: 'Apify Bayt',
        published_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('jobs')
        .upsert(mappedJobs, { onConflict: 'external_id', ignoreDuplicates: true });

      if (error) {
        console.error('❌ خطأ في الحفظ بقاعدة البيانات:', error.message);
      } else {
        console.log('🎉 تم حفظ الوظائف بنجاح تام في Supabase!');
      }
    } else {
      console.log('⚠️ لا توجد عناصر حالياً في dataset الخاصة بـ Apify.');
    }
  } catch (err) {
    console.error('❌ حدث خطأ في الاتصال:', err.message);
  }
}

run();
