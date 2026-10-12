import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { extractError } from '../lib/utils';
import { Shield, Eye, EyeOff, AlertTriangle, CheckCircle } from 'lucide-react';

const EMAIL_REGEX = /^[a-z0-9]{10}@svecw\.edu\.in$/i;

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');

  const emailValid = EMAIL_REGEX.test(form.email);

  const passwordRules = [
    { label: '8+ characters', ok: form.password.length >= 8 },
    { label: 'Uppercase letter', ok: /[A-Z]/.test(form.password) },
    { label: 'Number', ok: /[0-9]/.test(form.password) },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!emailValid) {
      setError('Email must be a 10-character roll number @svecw.edu.in (e.g. 25b05a1209@svecw.edu.in)');
      return;
    }
    setLoading(true);
    try {
      const user = await register(form);
      toast.success(`Welcome, ${user.name}! Your account is created.`);
      navigate('/student');
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 left-1/3 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-2xl shadow-indigo-500/30 mb-4">
            <Shield size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold gradient-text mb-2">CampusPulse</h1>
          <p className="text-slate-400 text-sm">Student Registration</p>
        </div>

        <div className="glass-card">
          <h2 className="text-xl font-bold text-slate-100 mb-6">Create your account</h2>

          {/* Safety banner */}
          <div className="safety-banner mb-4">
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
            <p>
              <strong>IMPORTANT:</strong> CampusPulse is NOT an emergency service. For immediate danger,
              contact college security/emergency personnel immediately.
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm mb-4">
              <AlertTriangle size={16} className="flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Full Name</label>
              <input
                id="reg-name"
                type="text"
                className="input"
                placeholder="Your full name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="label">College Email (Roll Number)</label>
              <input
                id="reg-email"
                type="email"
                className={`input ${form.email && (!emailValid ? 'border-red-500/50' : 'border-emerald-500/50')}`}
                placeholder="25b05a1209@svecw.edu.in"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value.toLowerCase() })}
                required
              />
              {form.email && (
                <p className={`text-xs mt-1 ${emailValid ? 'text-emerald-400' : 'text-red-400'}`}>
                  {emailValid
                    ? `✓ Roll number: ${form.email.split('@')[0]}`
                    : 'Must be: 10 alphanumeric chars @svecw.edu.in'}
                </p>
              )}
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  id="reg-password"
                  type={showPass ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="Create a strong password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  onClick={() => setShowPass(!showPass)}
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div className="flex gap-3 mt-2">
                {passwordRules.map((rule) => (
                  <div key={rule.label} className={`flex items-center gap-1 text-xs ${rule.ok ? 'text-emerald-400' : 'text-slate-500'}`}>
                    <CheckCircle size={12} />
                    {rule.label}
                  </div>
                ))}
              </div>
            </div>

            <button type="submit" className="btn-primary w-full justify-center btn-lg mt-2" disabled={loading}>
              {loading ? <span className="spinner" /> : null}
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-400 mt-4">
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
