import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hsomjtpoqmtymuvzymik.supabase.co';
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/^SUPABASE_SERVICE_ROLE_KEY=/, '').trim();
const rapidApiKey = process.env.RAPID_API_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  console.log('🇪🇬 بدء فحص وتشخيص سحب الوظائف من JSearch API...');

  if (!rapidApiKey) {
    console.error('❌ خطأ: مفتاح RAPID_API_KEY غير موجود في الـ Secrets!');
    return;
  }

  // سنقوم بتجربة استعلام بسيط وواضح
  const query = 'developer Egypt';
  const url = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(query)}&page=1&num_pages=1`;

  console.log(`🔍 جاري إرسال الطلب إلى الرابط: ${url}`);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': rapidApiKey,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
      }
    });

    const data = await response.json();
    console.log('📥 الاستجابة الخام من الـ API (Raw Data):', JSON.stringify(data, null, 2));

    if (data && data.data && data.data.length > 0) {
      console.log(`✅ تم العثور على ${data.data.length} وظيفة بنجاح!`);
      
      // تجهيز أول وظيفة للتجربة
      const job = data.data[0];
      const mappedJob = {
        external_id: `jsearch_test_${job.job_id || Date.now()}`,
        title: job.job_title || 'وظيفة اختبارية',
        company: job.employer_name || 'شركة اختبارية',
        location: 'مصر',
        country_code: 'EG',
        category: 'تكنولوجيا ومعلومات',
        job_type: 'دوام كامل',
        description: (job.job_description || 'لا توجد تفاصيل').slice(0, 200),
        apply_url: job.job_apply_link || 'https://google.com',
        source: 'JSearch Test',
        published_at: new Date().toISOString()
      };

      console.log('📦 محاولة حفظ الوظيفة في Supabase:', mappedJob);

      const { error } = await supabase
        .from('jobs')
        .upsert([mappedJob], { onConflict: 'external_id' });

      if (error) {
        console.error('❌ فشل الحفظ في Supabase:', error.message);
      } else {
        console.log('🎉 تم حفظ الوظيفة التجريبية في قاعدة البيانات بنجاح تام!');
      }

    } else {
      console.log('⚠️ الـ API لم يرجع أي نتائج لهذا الاستعلام. قد يكون المفتاح بحاجة لتفعيل أو استهلاك الحد المجاني.');
    }

  } catch (err) {
    console.error('❌ حدث خطأ أثناء الاتصال بالـ API:', err.message);
  }
}

run();
