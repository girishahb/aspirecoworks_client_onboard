import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="min-h-screen flex">
      {/* Left brand panel */}
      <div
        className="hidden lg:flex lg:w-[45%] xl:w-[40%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(145deg, #134b7f 0%, #0c2d52 60%, #071a30 100%)' }}
      >
        {/* Decorative circles */}
        <div
          className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #ffffff 0%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-32 -left-16 w-80 h-80 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #0d9488 0%, transparent 70%)' }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 right-0 w-px h-64 opacity-20"
          style={{ background: 'linear-gradient(to bottom, transparent, #ffffff, transparent)' }}
        />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <img src="/logo.png" alt="Aspire Coworks" className="h-10 w-10 object-contain" />
          <span className="text-white font-bold text-xl tracking-wide" style={{ fontFamily: 'Arial, sans-serif' }}>
            ASPIRE COWORKS
          </span>
        </div>

        {/* Center content */}
        <div className="relative z-10 space-y-6">
          <div>
            <h2 className="text-3xl font-bold text-white leading-tight">
              Your workspace,<br />your community.
            </h2>
            <p className="mt-4 text-base text-blue-200 leading-relaxed max-w-xs">
              Premium coworking spaces designed for professionals who value clarity, focus, and connection.
            </p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2">
            {['Conference Rooms', 'Day Passes', 'KYC Portal', 'Invoicing'].map((f) => (
              <span
                key={f}
                className="px-3 py-1 rounded-full text-xs font-medium text-white border border-white/20"
                style={{ background: 'rgba(255,255,255,0.08)' }}
              >
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div className="relative z-10">
          <p className="text-xs text-blue-300 opacity-70">
            Indiranagar, Bengaluru · aspirecoworks.in
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col justify-center bg-white">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 px-6 pt-8 pb-4">
          <img src="/logo.png" alt="Aspire Coworks" className="h-8 w-8 object-contain" />
          <span className="font-bold text-base tracking-wide" style={{ color: '#134b7f', fontFamily: 'Arial, sans-serif' }}>
            ASPIRE COWORKS
          </span>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 py-8 sm:px-12">
          <div className="w-full max-w-sm">
            <Outlet />
          </div>
        </div>

        <div className="px-6 pb-6 text-center">
          <p className="text-xs text-slate-400">
            &copy; {new Date().getFullYear()} Aspire Coworks. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
