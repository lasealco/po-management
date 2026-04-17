# ARSCMP Brand Guidelines

Last updated: 2026-04-16

## Core identity

- **Brand name:** ARSCMP
- **Meaning:** AR Supply Chain Management Platform
- **Primary color:** `#165B67` (dark teal)
- **Neutral support:** `#F1F5F9` (light slate)

## Logo system

- **Primary lockup:** boxed `AR` mark + `SCMP` wordmark + tagline.
- **Tagline:** `Supply Chain Management Platform`
- **Typography intent:** heavy sans for mark/wordmark, medium sans for tagline.
- **Usage preference:** render as component/SVG-style layout to keep sharpness at all sizes.

## UI guidance

- Use `#165B67` for primary actions, active states, and key system indicators.
- Use subtle grays for background and secondary surfaces.
- Preserve high contrast for text and controls.

## Reference implementation snippet

```tsx
import React from 'react';

/**
 * ARSCMP Brand Assets & UI Kit
 * Primary Color: #165B67 (Dark Teal)
 */

const ARSCMPLogo = ({ className = "h-16" }) => (
  <div className={`flex flex-col items-center ${className}`}>
    <div className="flex items-center gap-2">
      {/* The AR Box */}
      <div className="bg-[#165B67] rounded-xl flex items-center justify-center px-4 py-2 aspect-square">
        <span className="text-white font-sans font-black text-4xl leading-none select-none">
          AR
        </span>
      </div>
      {/* The SCMP Text */}
      <span className="text-[#165B67] font-sans font-black text-6xl tracking-tight leading-none select-none">
        SCMP
      </span>
    </div>
    {/* Centered Tagline */}
    <div className="mt-2 text-gray-500 font-sans font-medium tracking-[0.2em] text-xs uppercase select-none">
      Supply Chain Management Platform
    </div>
  </div>
);

const App = () => {
  const brandColor = "#165B67";

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      <div className="max-w-4xl mx-auto space-y-12">
        
        {/* Logo Section */}
        <section className="bg-white p-12 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-8">Primary Logo (SVG Component)</h2>
          <ARSCMPLogo />
          <div className="mt-8 p-4 bg-gray-50 rounded-lg w-full">
            <p className="text-xs font-mono text-gray-600 break-all">
              {`// Component usage: <ARSCMPLogo className="h-12" />`}
            </p>
          </div>
        </section>

        <div className="grid md:grid-cols-2 gap-8">
          
          {/* Colors Section */}
          <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6">Brand Palette</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl shadow-inner border border-black/5" style={{ backgroundColor: brandColor }}></div>
                <div>
                  <p className="font-bold">Primary Teal</p>
                  <p className="font-mono text-sm text-gray-500">#165B67</p>
                </div>
              </div>
              <div className="flex items-center gap-4 opacity-70">
                <div className="w-16 h-16 rounded-xl bg-slate-100 border border-gray-200"></div>
                <div>
                  <p className="font-bold">Neutral Gray</p>
                  <p className="font-mono text-sm text-gray-500">#F1F5F9</p>
                </div>
              </div>
            </div>
          </section>

          {/* UI Elements Section */}
          <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6">UI Components</h2>
            <div className="space-y-4">
              <button 
                className="w-full py-3 px-6 rounded-xl font-bold text-white shadow-lg transition-all active:scale-95"
                style={{ backgroundColor: brandColor }}
              >
                Primary Action Button
              </button>
              
              <button 
                className="w-full py-3 px-6 rounded-xl font-bold border-2 transition-all active:scale-95"
                style={{ borderColor: brandColor, color: brandColor }}
              >
                Secondary Outline
              </button>

              <div className="flex items-center gap-2 pt-2">
                 <div className="w-2 h-2 rounded-full" style={{ backgroundColor: brandColor }}></div>
                 <span className="text-sm font-medium" style={{ color: brandColor }}>System Status: Online</span>
              </div>
            </div>
          </section>
        </div>

        {/* Integration Instructions */}
        <section className="bg-[#165B67] p-8 rounded-2xl text-white">
          <h2 className="text-sm font-bold opacity-70 uppercase tracking-widest mb-4">Integration Tip</h2>
          <p className="text-lg leading-relaxed">
            For the best software experience, use the **SVG component** provided above. It ensures that the logo remains crisp on Retina displays and scales perfectly within your navigation bar or landing pages.
          </p>
        </section>

      </div>
    </div>
  );
};

export default App;
```
