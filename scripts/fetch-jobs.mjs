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
  console.log('🇪🇬 بدء تشغيل جلب الوظائف من أداة Apify المحددة...');

  if (!apifyToken) {
    console.error('❌ خطأ: مفتاح APIFY_API_TOKEN مفقود في إعدادات GitHub Secrets!');
    return;
  }

  // استبدل هذا المعرف بالاسم الحقيقي للـ Actor الظاهر في الأعلى (مثل: blackfalconda~bayt-scraper أو معرف الـ Actor)
  const actorId = 'blackfalconda~bayt-scraper'; 
  const runUrl = `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/runs?token=${apifyToken}`;

  try {
    console.log('🚀 جاري إرسال أمر تشغيل الأداة على Apify...');
    const startRes = await fetch(runUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        country: 'Egypt',
        maxItems: 15
      })
    });

    const startData = await startRes.json();
    const runId = startData.data?.id;

    if (!runId) {
      console.error('❌ لم يتم بدء التشغيل بنجاح. تأكد من صحة معرف الـ Actor.');
      return;
    }

    console.log(`⏳ تم بدء التشغيل برقم ID: ${runId}، جاري انتظار اكتمال السحب...`);

    // الانتظار حتى تنتهي العملية (حوالي 30 إلى 40 ثانية)
    let datasetId = null;
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 6000)); // انتظار 6 ثوانٍ
      const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${apifyToken}`);
      const statusData = await statusRes.json();
      const status = statusData.data?.status;
      
      console.log(`🔄 حالة السحب حالياً: ${status}`);

      if (status === 'SUCCEEDED') {
        datasetId = statusData.data?.defaultDatasetId;
        break;
      } else if (status === 'FAILED' || status === 'ABORTED') {
        console.error('❌ فشلت عملية السحب داخل منصة Apify.');
        return;
      }
    }

    if (!datasetId) {
      console.error('⌛ انتهت مهلة الانتظار ولم تكتمل العملية.');
      return;
    }

    // جلب النتائج من الـ Dataset الناتج
    console.log(`📥 جاري جلب الوظائف الناتجة من Dataset: ${datasetId}`);
    const itemsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}`);
    const items = await itemsRes.json();

    if (Array.isArray(items) && items.length > 0) {
      console.log(`✅ تم جلب ${items.length} وظيفة بنجاح! جاري حفظها في Supabase...`);

      const mappedJobs = items.map(job => ({
        external_id: `bayt_${job.id || job.jobId || Math.random().toString(36).substr(2, 9)}`,
        title: job.title || job.jobTitle || 'وظيفة في مصر',
        company: job.company || job.employerName || 'شركة معتمدة',
        location: job.location || 'مصر',
        country_code: 'EG',
        category: detectCategory(job.title || job.jobTitle),
        job_type: 'دوام كامل',
        description: (job.description || job.jobDescription || 'لا توجد تفاصيل').slice(0, 240) + '...',
        apply_url: job.url || job.applyUrl || 'https://www.bayt.com',
        source: 'Bayt Apify',
        published_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('jobs')
        .upsert(mappedJobs, { onConflict: 'external_id', ignoreDuplicates: true });

      if (error) {
        console.error('❌ خطأ أثناء الحفظ في Supabase:', error.message);
      } else {
        console.log('🎉 تم حفظ الوظائف في قاعدة البيانات وتحديث الموقع بنجاح تام!');
      }
    } else {
      console.log('⚠️ لم تقم الأداة بإرجاع أي وظائف.');
    }

  } catch (err) {
    console.error('❌ حدث خطأ:', err.message);
  }
}

run();
