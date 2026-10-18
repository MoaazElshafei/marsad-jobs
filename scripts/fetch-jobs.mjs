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
  console.log('🇪🇬 جاري جلب البيانات من Apify Dataset...');

  if (!apifyToken) {
    console.error('❌ خطأ: مفتاح APIFY_API_TOKEN مفقود!');
    return;
  }

  const datasetUrl = `https://api.apify.com/v2/datasets/last/items?token=${apifyToken}`;
  
  try {
    const response = await fetch(datasetUrl);
    const items = await response.json();

    if (Array.isArray(items) && items.length > 0) {
      console.log(`✅ تم العثور على ${items.length} عنصر مسحوب، جاري تحويلها وحفظها...`);
      
      const mappedJobs = items.map((item, index) => {
        const title = item.title || item.heading || (item.text ? item.text.slice(0, 50) : `وظيفة رقم ${index + 1}`);
        const url = item.url || item.link || 'https://www.jobs-arab.com/eg/';
        const description = item.text || item.description || 'لا توجد تفاصيل متاحة';

        return {
          external_id: `jobsarab_${index}_${Math.random().toString(36).substr(2, 5)}`,
          title: title.slice(0, 100),
          company: 'وظائف العرب',
          location: 'مصر',
          country_code: 'EG',
          category: detectCategory(title),
          job_type: 'دوام كامل',
          description: description.slice(0, 240) + '...',
          apply_url: url,
          source: 'Jobs Arabs',
          published_at: new Date().toISOString()
        };
      });

      // حفظ الوظائف في Supabase
      const { error } = await supabase
        .from('jobs')
        .upsert(mappedJobs, { onConflict: 'external_id', ignoreDuplicates: true });

      if (error) {
        console.error('❌ خطأ في Supabase:', error.message);
      } else {
        console.log('🎉 تم حفظ الوظائف في قاعدة البيانات بنجاح تام!');
      }
    } else {
      console.log('⚠️ لم يتم العثور على أي عناصر في الـ Dataset.');
    }
  } catch (err) {
    console.error('❌ حدث خطأ:', err.message);
  }
}

run();
