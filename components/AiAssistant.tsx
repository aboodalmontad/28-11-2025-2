
import * as React from 'react';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { useData } from '../context/DataContext';
import { SparklesIcon, XMarkIcon, PaperAirplaneIcon, ArrowPathIcon, MagnifyingGlassIcon } from './icons';
import { format_date, is_before_today } from '../utils/dateUtils';

// Extension of icons for AI
const RobotIcon = ({ className = "w-6 h-6" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
    </svg>
);

const UserBubbleIcon = ({ className = "w-5 h-5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
    </svg>
);

interface Message {
    role: 'user' | 'model';
    text: string;
    grounding_urls?: { uri: string; title: string }[];
}

const AiAssistant: React.FC = () => {
    const { clients, admin_tasks, appointments, all_sessions } = useData();
    const [isOpen, setIsOpen] = React.useState(false);
    const [input, setInput] = React.useState('');
    const [messages, setMessages] = React.useState<Message[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);
    const scrollRef = React.useRef<HTMLDivElement>(null);

    // Scroll to bottom on new messages
    React.useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    const generateSystemContext = () => {
        const client_summary = clients.map(c => `- ${c.name}: ${c.cases.length} قضايا`).join('\n');
        const session_summary = all_sessions
            .filter(s => !is_before_today(s.date))
            .slice(0, 5)
            .map(s => `- ${format_date(s.date)}: ${s.client_name} ضد ${s.opponent_name} (${s.court})`)
            .join('\n');
        const task_summary = admin_tasks
            .filter(t => !t.completed)
            .slice(0, 5)
            .map(t => `- ${t.task} (${t.location})`)
            .join('\n');

        return `أنت مساعد قانوني ذكي لمكتب محامي. لديك الصلاحية للاطلاع على البيانات التالية للمكتب:
الموكلون:
${client_summary}

أهم الجلسات القادمة:
${session_summary}

المهام الإدارية المعلقة:
${task_summary}

يرجى تقديم إجابات دقيقة ومهنية باللغة العربية. إذا سألك المستخدم عن بحث قانوني أو معلومة عامة، استخدم البحث في جوجل. إذا سألك عن الموكلين أو القضايا، اعتمد على البيانات المقدمة أعلاه.`;
    };

    const ensureApiKey = async () => {
        // @ts-ignore - aistudio bridge provided by platform
        if (window.aistudio && !(await window.aistudio.hasSelectedApiKey())) {
            // @ts-ignore
            await window.aistudio.openSelectKey();
        }
    };

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const user_message: Message = { role: 'user', text: input };
        setMessages(prev => [...prev, user_message]);
        setInput('');
        setIsLoading(true);

        try {
            await ensureApiKey();
            
            // Create a new instance right before call as required
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const model = 'gemini-3-flash-preview';
            
            const response = await ai.models.generateContent({
                model,
                contents: [
                    ...messages.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
                    { role: 'user', parts: [{ text: input }] }
                ],
                config: {
                    systemInstruction: generateSystemContext(),
                    tools: [{ googleSearch: {} }],
                }
            });

            const text = response.text || "عذراً، لم أتمكن من معالجة الطلب.";
            const grounding_chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
            const grounding_urls = grounding_chunks?.map((chunk: any) => ({
                uri: chunk.web?.uri,
                title: chunk.web?.title
            })).filter((u: any) => u.uri) || [];

            const ai_message: Message = { role: 'model', text, grounding_urls };
            setMessages(prev => [...prev, ai_message]);
        } catch (error: any) {
            console.error("AI Error:", error);
            
            if (error.message?.includes("Requested entity was not found.")) {
                // @ts-ignore
                if (window.aistudio) await window.aistudio.openSelectKey();
                setMessages(prev => [...prev, { role: 'model', text: "يرجى اختيار مفتاح API صالح للمتابعة." }]);
            } else if (error.message?.toLowerCase().includes("failed to fetch")) {
                setMessages(prev => [...prev, { role: 'model', text: "تعذر الاتصال بخوادم الذكاء الاصطناعي. يرجى التحقق من اتصال الإنترنت." }]);
            } else {
                setMessages(prev => [...prev, { role: 'model', text: "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى لاحقاً." }]);
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            {/* Floating Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`fixed bottom-20 sm:bottom-8 start-8 z-50 p-4 rounded-full shadow-2xl transition-all duration-300 transform hover:scale-110 active:scale-95 ${
                    isOpen ? 'bg-red-500 rotate-90' : 'bg-blue-600'
                }`}
                title="المساعد الذكي"
            >
                {isOpen ? <XMarkIcon className="w-6 h-6 text-white" /> : <SparklesIcon className="w-8 h-8 text-white" />}
            </button>

            {/* Sidebar Chat Panel */}
            <div className={`fixed inset-y-0 start-0 z-40 w-full sm:w-[400px] bg-white shadow-2xl transition-transform duration-500 ease-in-out border-e flex flex-col ${
                isOpen ? 'translate-x-0' : '-translate-x-full'
            }`} dir="rtl">
                {/* Header */}
                <div className="p-4 bg-gradient-to-l from-blue-600 to-indigo-700 text-white flex justify-between items-center shadow-md">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-lg">
                            <SparklesIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="font-bold text-lg">المساعد القانوني الذكي</h2>
                            <span className="text-[10px] opacity-75">مدعوم بـ Gemini AI & Google Search</span>
                        </div>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Messages Area */}
                <div 
                    ref={scrollRef}
                    className="flex-grow overflow-y-auto p-4 space-y-4 bg-gray-50/50 scroll-smooth"
                >
                    {messages.length === 0 && (
                        <div className="text-center py-12 px-6">
                            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <RobotIcon className="w-10 h-10 text-blue-600" />
                            </div>
                            <h3 className="font-bold text-gray-800 mb-2">مرحباً بك في المساعد الذكي</h3>
                            <p className="text-sm text-gray-500">يمكنك سؤالي عن مواعيدك، أو البحث عن قوانين، أو تلخيص قضية معينة.</p>
                        </div>
                    )}

                    {messages.map((m, i) => (
                        <div key={i} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                            <div className={`max-w-[85%] rounded-2xl p-3 shadow-sm ${
                                m.role === 'user' 
                                    ? 'bg-blue-600 text-white rounded-tr-none' 
                                    : 'bg-white border text-gray-800 rounded-tl-none'
                            }`}>
                                <div className="flex items-center gap-2 mb-1 opacity-70">
                                    {m.role === 'user' ? <UserBubbleIcon className="w-3 h-3" /> : <RobotIcon className="w-3 h-3" />}
                                    <span className="text-[10px] font-bold">{m.role === 'user' ? 'أنت' : 'الذكاء الاصطناعي'}</span>
                                </div>
                                <div className="text-sm leading-relaxed whitespace-pre-wrap">{m.text}</div>
                                
                                {m.grounding_urls && m.grounding_urls.length > 0 && (
                                    <div className="mt-3 pt-2 border-t border-gray-100">
                                        <p className="text-[10px] font-bold text-gray-400 mb-1 flex items-center gap-1">
                                            <MagnifyingGlassIcon className="w-3 h-3" /> المصادر والمراجع:
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {m.grounding_urls.map((u, ui) => (
                                                <a key={ui} href={u.uri} target="_blank" rel="noopener noreferrer" className="text-[10px] px-2 py-1 bg-blue-50 text-blue-700 rounded-md hover:underline truncate max-w-[150px]">
                                                    {u.title || "رابط خارجي"}
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    
                    {isLoading && (
                        <div className="flex justify-end">
                            <div className="bg-white border rounded-2xl rounded-tl-none p-4 shadow-sm flex items-center gap-3">
                                <ArrowPathIcon className="w-4 h-4 text-blue-500 animate-spin" />
                                <span className="text-sm text-gray-500">جاري التفكير...</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white border-t">
                    <form 
                        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                        className="flex items-center gap-2"
                    >
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="اسأل المساعد القانوني..."
                            className="flex-grow p-3 bg-gray-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isLoading}
                            className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors shadow-lg"
                        >
                            <PaperAirplaneIcon className="w-5 h-5 transform -rotate-90" />
                        </button>
                    </form>
                    <p className="text-[9px] text-gray-400 mt-2 text-center">قد يقدم الذكاء الاصطناعي معلومات غير دقيقة، يرجى التحقق من المصادر القانونية.</p>
                </div>
            </div>
        </>
    );
};

export default AiAssistant;
