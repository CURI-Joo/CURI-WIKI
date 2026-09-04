'use client';

import { Check, X } from 'lucide-react';

export default function DesignSystemPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-10">
      <div>
        <h1 className="text-xl font-bold text-text-primary">디자인 시스템</h1>
        <p className="text-sm text-text-secondary mt-1">
          CURI Wiki에서 사용하는 디자인 토큰과 컴포넌트 목록
        </p>
      </div>

      {/* Color Tokens */}
      <section>
        <h2 className="text-base font-semibold text-text-primary mb-4">Color Tokens</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {[
            { name: '--curi-pink', value: '#EA3380', className: 'bg-curi-pink' },
            { name: '--curi-pink-hover', value: '#F04A91', className: 'bg-curi-pink-hover' },
            { name: '--background', value: '#090A0F', className: 'bg-background border border-border' },
            { name: '--surface', value: '#101117', className: 'bg-surface' },
            { name: '--surface-elevated', value: '#16171E', className: 'bg-surface-elevated' },
            { name: '--border', value: '#292A33', className: 'bg-border' },
            { name: '--text-primary', value: '#F7F7FA', className: 'bg-text-primary' },
            { name: '--text-secondary', value: '#A5A6AE', className: 'bg-text-secondary' },
            { name: '--text-muted', value: '#73757F', className: 'bg-text-muted' },
            { name: '--success', value: '#22C55E', className: 'bg-success' },
            { name: '--warning', value: '#F59E0B', className: 'bg-warning' },
            { name: '--error', value: '#EF4444', className: 'bg-error' },
          ].map((color) => (
            <div key={color.name} className="rounded-xl border border-border bg-surface p-3">
              <div className={`w-full h-10 rounded-lg mb-2 ${color.className}`} />
              <p className="text-xs text-text-primary font-mono">{color.name}</p>
              <p className="text-xs text-text-muted">{color.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Typography */}
      <section>
        <h2 className="text-base font-semibold text-text-primary mb-4">Typography</h2>
        <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
          <p className="text-[28px] font-bold text-text-primary">Heading 1 — 28px / 700</p>
          <p className="text-[22px] font-semibold text-text-primary">Heading 2 — 22px / 600</p>
          <p className="text-[18px] font-semibold text-text-primary">Heading 3 — 18px / 600</p>
          <p className="text-[15px] text-text-primary">Body — 15px / 400</p>
          <p className="text-[13px] text-text-secondary">Caption — 13px / 400</p>
          <p className="text-[13px] font-medium text-text-primary">Label — 13px / 500</p>
        </div>
      </section>

      {/* Spacing */}
      <section>
        <h2 className="text-base font-semibold text-text-primary mb-4">Spacing</h2>
        <div className="flex items-end gap-2">
          {[4, 8, 12, 16, 20, 24, 32, 40, 48, 64].map((s) => (
            <div key={s} className="flex flex-col items-center">
              <div className="bg-curi-pink/30 border border-curi-pink/50" style={{ width: s, height: s }} />
              <span className="text-[10px] text-text-muted mt-1">{s}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Radius */}
      <section>
        <h2 className="text-base font-semibold text-text-primary mb-4">Radius</h2>
        <div className="flex gap-4">
          {[
            { label: 'Small — 8px', radius: '8px' },
            { label: 'Medium — 12px', radius: '12px' },
            { label: 'Large — 16px', radius: '16px' },
            { label: 'XL — 20px', radius: '20px' },
          ].map((r) => (
            <div key={r.label} className="text-center">
              <div
                className="w-16 h-16 bg-surface-elevated border border-border"
                style={{ borderRadius: r.radius }}
              />
              <p className="text-[10px] text-text-muted mt-1">{r.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Buttons */}
      <section>
        <h2 className="text-base font-semibold text-text-primary mb-4">Buttons</h2>
        <div className="flex flex-wrap gap-3">
          <button className="px-4 py-2 rounded-xl bg-curi-pink hover:bg-curi-pink-hover text-white text-sm font-medium transition-colors">
            Primary
          </button>
          <button className="px-4 py-2 rounded-xl border border-border bg-surface hover:bg-surface-elevated text-text-secondary text-sm font-medium transition-colors">
            Secondary
          </button>
          <button className="px-4 py-2 rounded-xl text-text-muted hover:text-text-secondary hover:bg-surface-elevated text-sm font-medium transition-colors">
            Ghost
          </button>
          <button className="px-4 py-2 rounded-xl bg-error/10 text-error hover:bg-error/20 text-sm font-medium transition-colors">
            Destructive
          </button>
          <button className="px-4 py-2 rounded-xl bg-curi-pink/50 text-white/50 text-sm font-medium cursor-not-allowed" disabled>
            Disabled
          </button>
        </div>
      </section>

      {/* Badge */}
      <section>
        <h2 className="text-base font-semibold text-text-primary mb-4">Badge</h2>
        <div className="flex flex-wrap gap-2">
          <span className="text-xs px-2 py-0.5 rounded-full bg-surface-elevated text-text-secondary border border-border">Default</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success">Success</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-warning/10 text-warning">Warning</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-error/10 text-error">Error</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-info/10 text-info">Info</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-curi-pink/10 text-curi-pink">Pink</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-warning/10 text-warning">
            제한 공개
          </span>
        </div>
      </section>

      {/* Input */}
      <section>
        <h2 className="text-base font-semibold text-text-primary mb-4">Input</h2>
        <div className="space-y-3 max-w-md">
          <input
            type="text"
            placeholder="Default input"
            className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-curi-pink/50"
          />
          <input
            type="text"
            placeholder="Focused input"
            className="w-full px-3 py-2 rounded-lg border border-curi-pink/50 bg-surface text-sm text-text-primary placeholder:text-text-muted outline-none ring-2 ring-curi-pink/20"
          />
          <input
            type="text"
            placeholder="Disabled input"
            disabled
            className="w-full px-3 py-2 rounded-lg border border-border bg-surface-elevated text-sm text-text-muted cursor-not-allowed"
          />
        </div>
      </section>

      {/* Card */}
      <section>
        <h2 className="text-base font-semibold text-text-primary mb-4">Card</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-border bg-surface p-5 hover:border-curi-pink/30 transition-all cursor-pointer">
            <h3 className="text-sm font-semibold text-text-primary mb-1">Default Card</h3>
            <p className="text-xs text-text-secondary">16-20px radius, 얇고 낮은 대비의 border, hover 시 border 변화</p>
          </div>
          <div className="rounded-2xl border border-border bg-surface-elevated p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-1">Elevated Card</h3>
            <p className="text-xs text-text-secondary">Surface elevated 배경을 사용하는 카드</p>
          </div>
        </div>
      </section>

      {/* Empty State */}
      <section>
        <h2 className="text-base font-semibold text-text-primary mb-4">Empty State</h2>
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <div className="w-10 h-10 rounded-full bg-surface-elevated flex items-center justify-center mx-auto mb-3">
            <span className="text-text-muted text-lg">📄</span>
          </div>
          <p className="text-sm font-medium text-text-primary mb-1">아직 문서가 없습니다</p>
          <p className="text-xs text-text-muted">새 문서를 작성하여 시작하세요</p>
        </div>
      </section>

      {/* Do / Don't */}
      <section>
        <h2 className="text-base font-semibold text-text-primary mb-4">Do / Don&apos;t</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-success/30 bg-success/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Check className="w-4 h-4 text-success" />
              <span className="text-sm font-medium text-success">Do</span>
            </div>
            <ul className="space-y-1 text-xs text-text-secondary">
              <li>핑크를 Primary CTA에 사용</li>
              <li>여백을 충분히 확보</li>
              <li>정보 위계를 명확히 구분</li>
              <li>Icon-only 버튼에 aria-label 제공</li>
            </ul>
          </div>
          <div className="rounded-xl border border-error/30 bg-error/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <X className="w-4 h-4 text-error" />
              <span className="text-sm font-medium text-error">Don&apos;t</span>
            </div>
            <ul className="space-y-1 text-xs text-text-secondary">
              <li>핑크를 배경 전체에 사용</li>
              <li>과도한 네온, 유리 효과, 그라데이션</li>
              <li>과한 shadow 사용</li>
              <li>aria-label 누락</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
