import { createClient } from '@supabase/supabase-js';
import RSSParser from 'rss-parser';

const parser = new RSSParser();
const supabaseUrl = 'https://hsomjtpoqmtymuvzymik.supabase.co';
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/^SUPABASE_SERVICE_ROLE_KEY=/, '').trim();

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function detectCategory(title) {
  const t = (title || '').toLowerCase();
  if (t.includes('sales') || t.includes('مبيعات') || t.includes('عقارات')) return 'مبيعات وعقارات';
  if (t.includes('developer') || t.includes('software') || t.includes('برمجة') || t.includes('it') || t.includes('محاسب') || t.includes('accountant')) return 'محاسبة ومالية';
  if (t.includes('engineer') || t.includes('مهندس') || t.includes('مدني') || t.includes('معماري')) return 'هندسة وإنشاءات';
  if (t.includes('marketing') || t.includes('تسويق')) return 'تسويق وصناعة محتوى';
  if (t.includes('hr') || t.includes('موارد بشرية') || t.includes('إداري') || t.includes('خدمة عملاء')) return 'إدارة وخدمة عملاء';
  return 'وظائف متنوعة';
}

async function fetchJobsFromRSS() {
  try {
    // ⚠️ الصق رابط الـ RSS الخاص بك هنا بين علامتي التنصيص
    const rssUrl = 'ضع_رابط_الـ_RSS_الخاص_بك_هنا';
    
    const feed = await parser.parseURL(rssUrl);
    if (!feed.items || feed.items.length === 0) return [];

    return feed.items.map(item => ({
      external_id: `rss_${item.guid || item.link}`,
      title: item.title || 'وظيفة في مصر',
      company: item.creator || 'شركة مصرية',
      location: 'مصر (القاهرة / المحافظات)',
      country_code: 'EG',
      category: detectCategory(item.title),
      job_type: 'دوام كامل',
      description: item.contentSnippet ? item.contentSnippet.slice(0, 240) + '...' : 'فرصة عمل جديدة في مصر',
      apply_url: item.link,
      source: 'وظائف العرب (RSS)',
      published_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString()
    }));
  } catch (err) {
    console.error('RSS Parsing Error:', err.message);
    return [];
  }
}

async function run() {
  console.log('🇪🇬 بدء سحب الوظائف المصرية عبر RSS...');
  const jobs = await fetchJobsFromRSS();
  console.log(`📦 تم جلب ${jobs.length} وظيفة مصرية.`);

  if (jobs.length > 0) {
    const { error } = await supabase
      .from('jobs')
      .upsert(jobs, { onConflict: 'external_id', ignoreDuplicates: true });

    if (error) console.error('Error saving to DB:', error.message);
    else console.log('✅ تم حفظ الوظائف المصرية بنجاح في قاعدة البيانات!');
  }
}

run();
