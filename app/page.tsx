'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Home() {
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-brand-500 selection:text-white">
      {/* Navbar Section */}
      <nav className={`fixed w-full z-50 transition-all duration-300 ${isScrolled ? 'bg-white/90 backdrop-blur-md shadow-sm py-3' : 'bg-transparent py-5'}`}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Logo placeholder */}
            <div className="w-8 h-8 rounded bg-brand-600 flex items-center justify-center text-white font-bold shadow-lg shadow-brand-500/30">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-800">
              Evidence<span className="text-brand-600">Sync</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-brand-600 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-brand-600 transition-colors">How it Works</a>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-slate-700 hover:text-brand-600 transition-colors hidden sm:block">
              Sign In
            </Link>
            <button className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-all hover:shadow-lg hover:shadow-brand-500/30 hover:-translate-y-0.5 active:translate-y-0">
              Connect Wallet
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-30 lg:pb-32 overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] opacity-30 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-brand-300 to-indigo-300 rounded-full blur-[80px] mix-blend-multiply"></div>
        </div>

        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-sm font-medium mb-8 border border-brand-100">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
            </span>
            Blockchain-Powered Evidence Management
          </div>

          <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight text-slate-900 mb-8 max-w-4xl mx-auto leading-[1.1]">
            Secure the truth with <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-indigo-600">Immutable Records.</span>
          </h1>

          <p className="text-lg lg:text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            A decentralized, tamper-proof system designed for law enforcement, legal professionals, and courts to securely manage, verify, and authenticate digital evidence.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/dashboard" className="w-full sm:w-auto bg-brand-600 hover:bg-brand-700 text-white px-8 py-3.5 rounded-xl text-base font-semibold transition-all hover:shadow-xl hover:shadow-brand-500/30 hover:-translate-y-1">
              Go to Dashboard
            </Link>
            <a href="#how-it-works" className="w-full sm:w-auto bg-white hover:bg-slate-50 text-slate-700 px-8 py-3.5 rounded-xl text-base font-semibold border border-slate-200 transition-all hover:border-slate-300">
              Learn More
            </a>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Uncompromised Security</h2>
            <p className="mt-4 text-lg text-slate-600">Built on blockchain technology to guarantee the integrity of every piece of evidence.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-slate-50 rounded-2xl p-8 border border-slate-100 hover:border-brand-200 hover:shadow-lg transition-all duration-300 group">
              <div className="w-12 h-12 bg-white rounded-xl border border-slate-200 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform text-brand-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Tamper-Proof Storage</h3>
              <p className="text-slate-600 leading-relaxed">Cryptographic hashes of all evidence are stored securely on the blockchain, making undetected alterations impossible.</p>
            </div>

            {/* Feature 2 */}
            <div className="bg-slate-50 rounded-2xl p-8 border border-slate-100 hover:border-brand-200 hover:shadow-lg transition-all duration-300 group">
              <div className="w-12 h-12 bg-white rounded-xl border border-slate-200 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform text-brand-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Court Admissible</h3>
              <p className="text-slate-600 leading-relaxed">Maintains a strict chain of custody from collection to presentation, ensuring full legal compliance.</p>
            </div>

            {/* Feature 3 */}
            <div className="bg-slate-50 rounded-2xl p-8 border border-slate-100 hover:border-brand-200 hover:shadow-lg transition-all duration-300 group">
              <div className="w-12 h-12 bg-white rounded-xl border border-slate-200 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform text-brand-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Instant Verification</h3>
              <p className="text-slate-600 leading-relaxed">Independent parties can verify the authenticity of any piece of evidence in seconds using our validation tools.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">How It Works</h2>
            <p className="mt-4 text-lg text-slate-600">A streamlined process to secure and track your evidence.</p>
          </div>

          <div className="grid md:grid-cols-4 gap-8 relative">
            {/* Connecting line for larger screens */}
            <div className="hidden md:block absolute top-12 left-24 right-24 h-0.5 bg-slate-200 z-0"></div>

            {[
              { step: '01', title: 'Upload', desc: 'Securely upload digital evidence into the localized storage.' },
              { step: '02', title: 'Hash Generation', desc: 'A unique cryptographic SHA-256 hash is generated for the file.' },
              { step: '03', title: 'Blockchain Anchor', desc: 'The hash and metadata are permanently recorded on-chain.' },
              { step: '04', title: 'Verify Anywhere', desc: 'Authorized entities can verify authenticity at any time.' }
            ].map((item, i) => (
              <div key={i} className="relative z-10 flex flex-col items-center text-center">
                <div className="w-24 h-24 rounded-full bg-white border-4 border-slate-50 shadow-md flex items-center justify-center mb-6 text-brand-600 font-bold text-2xl">
                  {item.step}
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">{item.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer Section */}
      <footer className="bg-slate-900 text-slate-300 py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded bg-brand-600 flex items-center justify-center text-white font-bold">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                </div>
                <span className="text-xl font-bold tracking-tight text-white">
                  Evidence<span className="text-brand-500">Sync</span>
                </span>
              </div>
              <p className="text-sm text-slate-400 max-w-sm">
                Next-generation evidence management system built on blockchain technology to ensure integrity, security, and court admissibility.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Platform</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#features" className="hover:text-brand-400 transition-colors">Features</a></li>
                <li><a href="#how-it-works" className="hover:text-brand-400 transition-colors">How it Works</a></li>
                <li><Link href="/verify" className="hover:text-brand-400 transition-colors">Verify Evidence</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#" className="hover:text-brand-400 transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-brand-400 transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-brand-400 transition-colors">Compliance</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-slate-800 text-sm text-slate-500 flex flex-col md:flex-row justify-between items-center">
            <p>&copy; {new Date().getFullYear()} EvidenceSync System. All rights reserved.</p>
            <div className="flex gap-4 mt-4 md:mt-0">
              {/* Social Icons Placeholder */}
              <div className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center cursor-pointer transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path></svg>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}