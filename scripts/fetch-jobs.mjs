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

async function runApifyScraper() {
  if (!apifyToken) {
    console.error('const apifyToken = process.env.APIFY_API_TOKEN;
');
    return;
  }

  console.log('🇪🇬 جاري تشغيل سحب وظائف بايت عبر Apify...');

  // Actor ID الخاص بـ Bayt Scraper على Apify (أو اسم الممثل الخاص بك)
  // يمكنك استبداله بالمعرف الخاص بالـ Actor الذي تستخدمه
  const actorId = 'your-apify-actor-id'; // استبدله بمعرف الـ Actor الفعلي من حسابك على Apify
  const runUrl = `https://api.apify.com/v2/acts/${actorId}/runs?token=${apifyToken}`;

  try {
    // 1. بدء تشغيل الـ Actor
    const startResponse = await fetch(runUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        country: 'Egypt',
        maxItems: 20
      })
    });

    const startData = await startResponse.json();
    const runId = startData.data?.id;

    if (!runId) {
      console.error('❌ فشل بدء تشغيل Apify Actor');
      return;
    }

    console.log(`⏳ تم بدء العملية برقم Run ID: ${runId}، جاري الانتظار حتى اكتمال السحب...`);

    // 2. الانتظار حتى تنتهي العملية (حوالي 30-60 ثانية)
    let isFinished = false;
    let datasetId = null;

    for (let i = 0; i < 15; i++) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // انتظار 5 ثوانٍ بين كل فحص
      const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${apifyToken}`);
      const statusData = await statusRes.json();
      const status = statusData.data?.status;

      console.log(`🔄 حالة السحب حالياً: ${status}`);

      if (status === 'SUCCEEDED') {
        isFinished = true;
        datasetId = statusData.data?.defaultDatasetId;
        break;
      } else if (status === 'FAILED' || status === 'ABORTED') {
        console.error('❌ فشلت عملية السحب على Apify.');
        return;
      }
    }

    if (!isFinished || !datasetId) {
      console.error('⌛ انتهت مهلة الانتظار ولم تكتمل عملية السحب بعد.');
      return;
    }

    // 3. جلب النتائج من Dataset
    console.log(`📥 جاري جلب الوظائف المسحوبة من Dataset: ${datasetId}`);
    const itemsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}`);
    const items = await itemsRes.json();

    if (items && items.length > 0) {
      console.log(`✅ تم جلب ${items.length} وظيفة بنجاح من بايت! جاري حفظها في Supabase...`);

      const mappedJobs = items.map(job => ({
        external_id: `bayt_${job.id || Math.random().toString(36).substr(2, 9)}`,
        title: job.title || 'وظيفة في مصر',
        company: job.company || 'شركة بايت',
        location: job.location || 'مصر',
        country_code: 'EG',
        category: detectCategory(job.title),
        job_type: 'دوام كامل',
        description: (job.description || 'لا توجد تفاصيل متاحة').slice(0, 240) + '...',
        apply_url: job.url || 'https://www.bayt.com',
        source: 'Bayt Scraper',
        published_at: new Date().toISOString()
      }));

      // حفظ الوظائف في Supabase
      const { error } = await supabase
        .from('jobs')
        .upsert(mappedJobs, { onConflict: 'external_id', ignoreDuplicates: true });

      if (error) {
        console.error('❌ خطأ في حفظ الوظائف بقاعدة البيانات:', error.message);
      } else {
        console.log('🎉 تم حفظ جميع وظائف بايت في قاعدة بيانات Supabase بنجاح تام!');
      }
    } else {
      console.log('⚠️ لم يتم إرجاع أي وظائف من Apify.');
    }

  } catch (err) {
    console.error('❌ حدث خطأ غير متوقع:', err.message);
  }
}

runApifyScraper();
