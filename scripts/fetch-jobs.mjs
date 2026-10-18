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
  console.log('🇪🇬 جاري الاتصال بمنصة Apify للبحث عن أحدث بيانات مسحوبة...');

  if (!apifyToken) {
    console.error('❌ خطأ: مفتاح APIFY_API_TOKEN مفقود في GitHub Secrets!');
    return;
  }

  try {
    // جلب قائمة العمليات السابقة لمعرفة آخر Dataset تحتوي على بيانات
    const runsRes = await fetch(`https://api.apify.com/v2/actor-runs?token=${apifyToken}&limit=5&desc=true`);
    const runsData = await runsRes.json();
    const runs = runsData.data?.items || [];

    let datasetId = null;
    for (const run of runs) {
      if (run.defaultDatasetId) {
        datasetId = run.defaultDatasetId;
        break;
      }
    }

    if (!datasetId) {
      console.error('❌ لم يتم العثور على أي Dataset نشطة في حسابك على Apify.');
      return;
    }

    console.log(`📥 تم العثور على Dataset برقم: ${datasetId}، جاري جلب الوظائف...`);
    const itemsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}`);
    const items = await itemsRes.json();

    if (Array.isArray(items) && items.length > 0) {
      console.log(`✅ تم العثور على ${items.length} عنصر، جاري معالجتها وحفظها...`);
      
      const mappedJobs = items.map((item, index) => {
        const title = item.title || item.heading || (item.text ? item.text.split('\n')[0] : `وظيفة مصرية ${index + 1}`);
        const url = item.url || item.link || 'https://www.jobs-arab.com/eg/';
        const description = item.text || item.description || 'لا توجد تفاصيل متاحة';

        return {
          external_id: `job_item_${index}_${Math.random().toString(36).substr(2, 5)}`,
          title: title.slice(0, 100),
          company: 'وظائف العرب',
          location: 'مصر',
          country_code: 'EG',
          category: detectCategory(title),
          job_type: 'دوام كامل',
          description: description.slice(0, 240) + '...',
          apply_url: url,
          source: 'Apify Scraper',
          published_at: new Date().toISOString()
        };
      });

      // حفظ البيانات في قاعدة بيانات Supabase
      const { error } = await supabase
        .from('jobs')
        .upsert(mappedJobs, { onConflict: 'external_id', ignoreDuplicates: true });

      if (error) {
        console.error('❌ خطأ في حفظ قاعدة البيانات:', error.message);
      } else {
        console.log('🎉 تم حفظ الوظائف في Supabase بنجاح وتحديث الموقع!');
      }
    } else {
      console.log('⚠️ الـ Dataset الحالية فارغة تماماً. يرجى تشغيل أداة السحب على Apify مرة واحدة لتوليد بيانات جديدة.');
    }
  } catch (err) {
    console.error('❌ حدث خطأ غير متوقع:', err.message);
  }
}

run();
