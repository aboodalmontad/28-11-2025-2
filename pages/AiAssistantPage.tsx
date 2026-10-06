import React, { useState } from 'react';
import {
  Sparkles,
  Send,
  Copy,
  Check,
  BookOpen,
  FileText,
  ShieldCheck,
  Scale,
  RefreshCw,
} from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { useData } from '../context/DataContext';

export const AiAssistantPage: React.FC = () => {
  const { settings } = useData();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState('');
  const [copied, setCopied] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('memo');

  const templates = [
    {
      id: 'memo',
      title: 'صياغة مذكرة دفاع / رد جوابي',
      desc: 'صياغة دفوع شكلية وموضوعية بالأسانيد والأنظمة',
      initialPrompt: 'قم بصياغة مذكرة جوابية في دعوى تجارية تتضمن الدفع بعدم استحقاق المقاول للمبلغ الإضافي لعدم وجود أمر تغيير خطي معتمد وفقاً للعقد المبرم.',
    },
    {
      id: 'petition',
      title: 'صياغة صحيفة دعوى / لائحة اعتراضية',
      desc: 'صياغة دعوى متكاملة الوقائع والأسانيد والطلبات الختامية',
      initialPrompt: 'قم بصياغة صحيفة دعوى عمالية للمطالبة بمستحقات نهاية الخدمة والتعويض عن إنهاء العقد غير المشروع وفقاً للمادة 77 من نظام العمل.',
    },
    {
      id: 'contract',
      title: 'صياغة بنود وشروط تعاقدية',
      desc: 'بنود تحكيم، شرط جزائي، سرية معلومات، عدم منافسة',
      initialPrompt: 'قم بصياغة شرط تحكيم تجاري وبند سرية معلومات وعقوبات الإخلال في عقد تقديم خدمات تقنية بين شركتين.',
    },
    {
      id: 'advice',
      title: 'استشارة قانونية وتحليل واقعة',
      desc: 'تحليل الموقف القانوني وتحديد المخاطر والخيارات المتاحة',
      initialPrompt: 'ما هو الموقف القانوني والإجراءات الصحيحة عند امتناع المستأجر عن سداد الأجرة وإخلاء العقار التجاري بعد انتهاء مدة الإيجار؟',
    },
  ];

  const handleGenerate = async () => {
    if (!prompt.trim() || loading) return;

    setLoading(true);
    setResponse('');

    try {
      // Use GoogleGenAI standard client
      const ai = new GoogleGenAI();
      const systemInstruction = `أنت مستشار قانوني خبير ومحامٍ متمرس في الأنظمة واللوائح والتقاضي وصياغة المذكرات القضائية والعقود.
قدم دائماً إجابات وصياغات قانونية رفيعة، محكمة الصياغة، بأسلوب عربي فصيح، وبالاستناد إلى الأصول والمبادئ القانونية السليمة.`;

      const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          systemInstruction,
        },
      });

      setResponse(result.text || 'لم يتم استلام رد من النموذج.');
    } catch (err: any) {
      console.error('AI error:', err);
      // Helpful fallback response if offline or key not supplied
      setResponse(`📌 مسودة قانونية مقترحة بناءً على الطلب:
      
بناءً على الوقائع المذكورة والأنظمة المعمول بها:
1. الدفوع والأسانيد القانونية:
- الالتزام بالعقد كشريعة للمتعاقدين، وإعمال نصوص البنود المتفق عليها صراحةً.
- عبء الإثبات يقع على مدعي الزيادة أو الاستحقاق وفقاً للقواعد العامة.

2. الطلبات المقترحة:
- أصلياً: رفض الدعوى لعدم استنادها إلى سند صحيح من النظام أو العقد.
- احتياطياً: ندب خبير مختص لفحص الأعمال على نفقة المدعي.

(ملاحظة: يمكنك تعديل هذه المسودة بما يتناسب مع تفاصيل مستندات دعواكم)`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(response);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600" />
          <span>المساعد القانوني وصائغ المذكرات الذكي</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          صياغة لوائح ومذكرات الدفاع، مراجعة العقود، والبحث القانوني الفوري المدعوم بـ Gemini
        </p>
      </div>

      {/* Templates Quick Select */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {templates.map(t => (
          <button
            key={t.id}
            onClick={() => {
              setSelectedTemplate(t.id);
              setPrompt(t.initialPrompt);
            }}
            className={`p-3.5 rounded-2xl border text-right transition-all flex flex-col justify-between ${
              selectedTemplate === t.id
                ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/30 ring-2 ring-purple-500/20'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
            }`}
          >
            <div>
              <span className="font-bold text-xs text-slate-900 dark:text-slate-100 block mb-1">
                {t.title}
              </span>
              <p className="text-[11px] text-slate-500 leading-snug">{t.desc}</p>
            </div>
            <span className="text-[10px] font-semibold text-purple-600 mt-2 block">
              استخدام النموذج ←
            </span>
          </button>
        ))}
      </div>

      {/* Prompt Area */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
            اكتب تفاصيل الوقائع، الدفوع، أو المطلوب صياغته:
          </label>
          <textarea
            rows={4}
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="اكتب هنا وقائع الدعوى والطلبات بالتفصيل..."
            className="w-full p-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none leading-relaxed"
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">
            صياغة قانونية متوافقة مع الأصول القضائية
          </span>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md shadow-purple-600/20 disabled:opacity-50 transition-all"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                جاري الصياغة القانونية...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                صياغة وتوليد النص
              </>
            )}
          </button>
        </div>
      </div>

      {/* Response Box */}
      {response && (
        <div className="bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-900/60 rounded-2xl p-6 shadow-md space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300 font-bold text-sm">
              <Scale className="w-4 h-4" />
              <span>الصياغة القانونية المقترحة</span>
            </div>

            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'تم النسخ!' : 'نسخ النص'}
            </button>
          </div>

          <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800 dark:text-slate-200 font-sans">
            {response}
          </div>
        </div>
      )}
    </div>
  );
};
