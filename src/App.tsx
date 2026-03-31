import { Scale, BookOpen, Users, Phone, Mail, MapPin, ArrowLeft, Printer } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { supabase } from './supabaseClient';
import { printElement } from '../utils/printUtils';

export default function App() {
  const [form_data, set_form_data] = useState({ name: '', phone: '', message: '' });
  const [is_submitting, set_is_submitting] = useState(false);
  const [submit_message, set_submit_message] = useState('');

  const handle_submit = async (e: React.FormEvent) => {
    e.preventDefault();
    set_is_submitting(true);
    set_submit_message('');

    try {
      // Assuming a table named 'contacts' exists in Supabase
      const { error } = await supabase
        .from('contacts')
        .insert([
          { name: form_data.name, phone: form_data.phone, message: form_data.message }
        ]);

      if (error) {
        console.error('Error submitting form:', error);
        set_submit_message('حدث خطأ أثناء إرسال رسالتك. يرجى المحاولة مرة أخرى.');
      } else {
        set_submit_message('تم إرسال رسالتك بنجاح. سنتواصل معك قريباً.');
        set_form_data({ name: '', phone: '', message: '' });
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      set_submit_message('حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.');
    } finally {
      set_is_submitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900" dir="rtl">
      {/* Header */}
      <header className="bg-slate-900 text-white py-6 shadow-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Scale className="w-8 h-8 text-amber-500" />
            <h1 className="text-2xl font-bold tracking-tight">مكتب المحامي</h1>
          </div>
          <nav className="hidden md:flex gap-8 text-sm font-medium">
            <a href="#home" className="hover:text-amber-500 transition-colors">الرئيسية</a>
            <a href="#services" className="hover:text-amber-500 transition-colors">خدماتنا</a>
            <a href="#about" className="hover:text-amber-500 transition-colors">من نحن</a>
            <a href="#contact" className="hover:text-amber-500 transition-colors">اتصل بنا</a>
            <button 
                onClick={() => {
                    const element = document.getElementById('print-section');
                    if (element) {
                        printElement(element);
                    }
                }}
                className="hover:text-amber-500 transition-colors flex items-center gap-1"
            >
                <Printer className="w-4 h-4" />
                <span>طباعة</span>
            </button>
          </nav>
          <a href="#contact" className="hidden md:flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold py-2 px-6 rounded-lg transition-colors">
            <span>استشارة مجانية</span>
            <ArrowLeft className="w-4 h-4" />
          </a>
        </div>
      </header>

      {/* Hero Section */}
      <section id="home" className="relative bg-slate-900 text-white py-32 md:py-48 overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <img 
            src="https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&q=80" 
            alt="Law background" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-l from-slate-900/90 to-slate-900/40"></div>
        <div className="container mx-auto px-4 relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-3xl"
          >
            <h2 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              العدالة، النزاهة، <br/><span className="text-amber-500">والاحترافية</span>
            </h2>
            <p className="text-xl md:text-2xl text-slate-300 mb-10 leading-relaxed max-w-2xl">
              نقدم استشارات قانونية متخصصة وحلولاً مبتكرة لحماية حقوقك ومصالحك بأعلى معايير الجودة والسرية.
            </p>
            <div className="flex flex-wrap gap-4">
              <a href="#contact" className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold py-4 px-8 rounded-lg transition-colors text-lg flex items-center gap-2">
                احجز استشارة الآن
                <ArrowLeft className="w-5 h-5" />
              </a>
              <a href="#services" className="bg-white/10 hover:bg-white/20 text-white font-bold py-4 px-8 rounded-lg transition-colors text-lg backdrop-blur-sm border border-white/20">
                تعرف على خدماتنا
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h3 className="text-3xl md:text-4xl font-bold mb-4">خدماتنا القانونية</h3>
            <div className="w-24 h-1.5 bg-amber-500 mx-auto rounded-full"></div>
            <p className="text-slate-600 mt-6 max-w-2xl mx-auto text-lg">
              نغطي مجموعة واسعة من التخصصات القانونية لتلبية كافة احتياجاتك الشخصية والتجارية.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Scale, title: 'القضايا المدنية والتجارية', desc: 'تمثيل قانوني شامل في كافة النزاعات المدنية والتجارية أمام المحاكم بمختلف درجاتها.' },
              { icon: BookOpen, title: 'صياغة ومراجعة العقود', desc: 'إعداد ومراجعة كافة أنواع العقود والاتفاقيات لضمان حماية حقوقك وتجنب الثغرات القانونية.' },
              { icon: Users, title: 'قضايا الأحوال الشخصية', desc: 'التعامل مع قضايا الأسرة، الطلاق، الحضانة، والنفقة بسرية تامة واحترافية عالية.' }
            ].map((service, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.2 }}
                className="p-8 rounded-2xl bg-slate-50 border border-slate-100 hover:shadow-xl hover:border-amber-200 transition-all group"
              >
                <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-amber-500 transition-colors">
                  <service.icon className="w-8 h-8 text-amber-600 group-hover:text-white transition-colors" />
                </div>
                <h4 className="text-xl font-bold mb-3">{service.title}</h4>
                <p className="text-slate-600 leading-relaxed">{service.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section (Brief) */}
      <section id="about" className="py-24 bg-slate-900 text-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div 
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h3 className="text-3xl md:text-4xl font-bold mb-6">لماذا تختار مكتبنا؟</h3>
              <div className="w-20 h-1.5 bg-amber-500 mb-8 rounded-full"></div>
              <p className="text-slate-300 text-lg leading-relaxed mb-8">
                نحن نؤمن بأن المحاماة ليست مجرد مهنة، بل هي رسالة لإحقاق الحق ونصرة المظلوم. يضم مكتبنا نخبة من المحامين والمستشارين القانونيين ذوي الخبرة الواسعة في مختلف فروع القانون.
              </p>
              <ul className="space-y-4">
                {[
                  'خبرة تمتد لأكثر من 15 عاماً في المحاكم',
                  'سرية تامة في التعامل مع كافة القضايا',
                  'شفافية مطلقة مع الموكل في كل خطوات القضية',
                  'حلول قانونية مبتكرة وفعالة'
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-slate-200">
                    <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="absolute inset-0 bg-amber-500 rounded-3xl transform translate-x-4 translate-y-4 opacity-50"></div>
              <img 
                src="https://images.unsplash.com/photo-1505664173615-04f1bef931df?auto=format&fit=crop&q=80" 
                alt="Lawyer office" 
                className="relative rounded-3xl z-10 w-full object-cover aspect-[4/3] shadow-2xl"
                referrerPolicy="no-referrer"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-24 bg-slate-50 relative">
        <div className="container mx-auto px-4 relative z-10">
          <div className="bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-100">
            <div className="grid grid-cols-1 lg:grid-cols-5">
              <div className="p-10 lg:p-16 bg-slate-900 text-white lg:col-span-2">
                <h3 className="text-3xl font-bold mb-8">تواصل معنا</h3>
                <p className="text-slate-400 mb-10 leading-relaxed">
                  نحن هنا للإجابة على استفساراتك القانونية. لا تتردد في التواصل معنا لحجز موعد استشارة.
                </p>
                <div className="space-y-8">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center text-amber-500 shrink-0">
                      <Phone className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm mb-1">رقم الهاتف</p>
                      <p className="font-medium text-lg" dir="ltr">+966 50 000 0000</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center text-amber-500 shrink-0">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm mb-1">البريد الإلكتروني</p>
                      <p className="font-medium text-lg" dir="ltr">info@lawoffice.com</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center text-amber-500 shrink-0">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm mb-1">العنوان</p>
                      <p className="font-medium text-lg leading-relaxed">الرياض، طريق الملك فهد<br/>المملكة العربية السعودية</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-10 lg:p-16 lg:col-span-3">
                <h3 className="text-2xl font-bold mb-8 text-slate-900">أرسل لنا رسالة</h3>
                <form onSubmit={handle_submit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">الاسم الكامل</label>
                      <input 
                        type="text" 
                        required
                        value={form_data.name}
                        onChange={(e) => set_form_data({...form_data, name: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all bg-slate-50" 
                        placeholder="أدخل اسمك" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">رقم الهاتف</label>
                      <input 
                        type="tel" 
                        required
                        value={form_data.phone}
                        onChange={(e) => set_form_data({...form_data, phone: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all bg-slate-50" 
                        placeholder="أدخل رقم هاتفك" 
                        dir="rtl"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">الرسالة أو الاستشارة</label>
                    <textarea 
                      rows={5} 
                      required
                      value={form_data.message}
                      onChange={(e) => set_form_data({...form_data, message: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all bg-slate-50 resize-none" 
                      placeholder="كيف يمكننا مساعدتك؟ يرجى كتابة تفاصيل استشارتك باختصار..."
                    ></textarea>
                  </div>
                  
                  {submit_message && (
                    <div className={`p-4 rounded-lg ${submit_message.includes('بنجاح') ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                      {submit_message}
                    </div>
                  )}

                  <button 
                    type="submit" 
                    disabled={is_submitting}
                    className="w-full md:w-auto bg-slate-900 hover:bg-slate-800 disabled:bg-slate-700 text-white font-bold py-4 px-10 rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    {is_submitting ? 'جاري الإرسال...' : 'إرسال الرسالة'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-400 py-12 border-t border-slate-900">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <Scale className="w-6 h-6 text-amber-500" />
              <span className="text-xl font-bold text-white">مكتب المحامي</span>
            </div>
            <div className="flex gap-6 text-sm">
              <a href="#" className="hover:text-amber-500 transition-colors">سياسة الخصوصية</a>
              <a href="#" className="hover:text-amber-500 transition-colors">الشروط والأحكام</a>
            </div>
            <p className="text-sm">© {new Date().getFullYear()} مكتب المحامي. جميع الحقوق محفوظة.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
