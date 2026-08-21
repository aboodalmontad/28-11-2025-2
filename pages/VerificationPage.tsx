import * as React from 'react';
import { PowerIcon, CheckCircleIcon } from '../components/icons';
import { get_supabase_client } from '../supabaseClient';
import { useData } from '../context/DataContext';

interface VerificationPageProps {
    onLogout: () => void;
}

const VerificationPage: React.FC<VerificationPageProps> = ({ onLogout }) => {
    const [code, setCode] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [success, setSuccess] = React.useState(false);
    const { manual_sync } = useData();
    const supabase = get_supabase_client();

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (!supabase) return;

        try {
            const { data, error: rpcError } = await supabase.rpc('verify_user_code', {
                code_input: code
            });

            if (rpcError) throw rpcError;

            if (data === true) {
                setSuccess(true);
                // Force a data refresh to update the profile state in the app
                await manual_sync({ force: true });
                // Reload the page to ensure the main App component re-renders with authorized view
                setTimeout(() => window.location.reload(), 1500);
            } else {
                setError("كود التفعيل غير صحيح. يرجى المحاولة مرة أخرى.");
            }
        } catch (err: any) {
            console.error("Verification error:", err);
            setError(err.message || "حدث خطأ أثناء التفعيل.");
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-green-50">
                <div className="text-center p-8 bg-white rounded-lg shadow-lg">
                    <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-green-800">تم تفعيل الحساب بنجاح!</h1>
                    <p className="text-gray-600 mt-2">جاري تحويلك إلى الصفحة الرئيسية...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4" dir="rtl">
            <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-800">تفعيل الحساب</h1>
                    <p className="text-gray-600 mt-2 text-sm">
                        تم إنشاء حسابك. يرجى التواصل مع إدارة المكتب للحصول على كود التفعيل وإدخاله أدناه.
                    </p>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-100 text-red-700 rounded text-sm text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleVerify} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">كود التفعيل</label>
                        <input
                            type="text"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            className="w-full p-3 text-center text-2xl tracking-widest border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            placeholder="XXXXXX"
                            maxLength={6}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading || code.length < 4}
                        className="w-full py-2 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {loading ? 'جاري التحقق...' : 'تفعيل الحساب'}
                    </button>
                </form>

                <div className="mt-8 border-t pt-4 text-center">
                    <button
                        onClick={onLogout}
                        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-red-600 transition-colors"
                    >
                        <PowerIcon className="w-4 h-4" />
                        <span>تسجيل الخروج</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VerificationPage;