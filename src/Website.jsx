import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const C = {
  bg:     '#F8F5F0',
  dark:   '#1A1714',
  text:   '#2E2B28',
  muted:  '#8C857D',
  border: '#E6E0D8',
  sand:   '#BFA882',
  warm:   '#F2EDE5',
  white:  '#FFFFFF',
}

// Unsplash images — clean, warm, coastal Australian home interiors
const IMGS = {
  hero:     'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=2000&q=85',
  kitchen:  'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=900&q=80',
  bathroom: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?auto=format&fit=crop&w=900&q=80',
  living:   'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=900&q=80',
  bedroom:  'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=900&q=80',
  coastal:  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1400&q=80',
  clean2:   'https://images.unsplash.com/photo-1600573472591-ee6981cf35b6?auto=format&fit=crop&w=1400&q=80',
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body { background: ${C.bg}; font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; }
  .serif { font-family: 'Playfair Display', Georgia, serif; }
  a { text-decoration: none; color: inherit; }

  .nav-links { display: flex; align-items: center; gap: 32px; }
  .hamburger  { display: none !important; }

  /* 3-photo grid below hero */
  .photo-trio {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    height: 420px;
  }

  /* Split sections */
  .split { display: grid; grid-template-columns: 1fr 1fr; min-height: 560px; }
  .split-rev { display: grid; grid-template-columns: 1fr 1fr; min-height: 560px; }

  /* Reviews */
  .reviews-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }

  /* Footer */
  .footer-cols { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 48px; }

  @media (max-width: 900px) {
    .nav-links { display: none !important; }
    .hamburger  { display: block !important; }
    .photo-trio { grid-template-columns: 1fr; height: auto; }
    .photo-trio > div { height: 260px; }
    .split  { grid-template-columns: 1fr; }
    .split-rev { grid-template-columns: 1fr; }
    .reviews-grid { grid-template-columns: 1fr; }
    .footer-cols  { grid-template-columns: 1fr; gap: 32px; }
  }
`

// ─── Nav ──────────────────────────────────────────────────────────────────────
function Nav({ onQuote }) {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <>
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: scrolled ? 'rgba(248,245,240,0.94)' : 'transparent',
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
        borderBottom: scrolled ? `1px solid ${C.border}` : '1px solid transparent',
        transition: 'all 0.35s ease',
      }}>
        <div style={{
          maxWidth: 1240, margin: '0 auto', padding: '0 40px',
          height: 70, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <a href="/" className="serif" style={{
            fontSize: 18, fontWeight: 700,
            color: scrolled ? C.dark : C.white,
            letterSpacing: -0.3, transition: 'color 0.35s',
          }}>Dust Bunnies</a>

          <div className="nav-links">
            {['Services', 'Reviews', 'Areas'].map(l => (
              <a key={l} href={`#${l.toLowerCase()}`} style={{
                color: scrolled ? C.muted : 'rgba(255,255,255,0.75)',
                fontSize: 13, fontWeight: 500, transition: 'color 0.2s',
              }}
                onMouseEnter={e => e.target.style.color = scrolled ? C.dark : C.white}
                onMouseLeave={e => e.target.style.color = scrolled ? C.muted : 'rgba(255,255,255,0.75)'}
              >{l}</a>
            ))}
            <button onClick={onQuote} style={{
              background: scrolled ? C.dark : 'rgba(255,255,255,0.15)',
              border: `1px solid ${scrolled ? C.dark : 'rgba(255,255,255,0.4)'}`,
              color: C.white, borderRadius: 6,
              padding: '8px 20px', fontWeight: 500, fontSize: 13,
              cursor: 'pointer', backdropFilter: 'blur(4px)',
              transition: 'all 0.2s',
            }}>Get a quote</button>
          </div>

          <button className="hamburger" onClick={() => setOpen(o => !o)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: scrolled ? C.dark : C.white, fontSize: 20, padding: 4,
          }}>{open ? '✕' : '☰'}</button>
        </div>
      </nav>

      {open && (
        <div style={{
          position: 'fixed', top: 70, left: 0, right: 0, zIndex: 99,
          background: C.white, borderBottom: `1px solid ${C.border}`,
          padding: '20px 40px 28px',
        }}>
          {['Services', 'Reviews', 'Areas'].map(l => (
            <a key={l} href={`#${l.toLowerCase()}`} onClick={() => setOpen(false)} style={{
              display: 'block', padding: '13px 0',
              borderBottom: `1px solid ${C.border}`,
              color: C.text, fontSize: 16, fontWeight: 500,
            }}>{l}</a>
          ))}
          <button onClick={() => { onQuote(); setOpen(false) }} style={{
            marginTop: 18, width: '100%', background: C.dark, color: C.white,
            border: 'none', borderRadius: 6, padding: '14px',
            fontWeight: 500, fontSize: 15, cursor: 'pointer',
          }}>Get a free quote</button>
        </div>
      )}
    </>
  )
}

// ─── Hero — full-bleed photo ──────────────────────────────────────────────────
function Hero({ onQuote }) {
  return (
    <section style={{
      height: '100vh', minHeight: 600, position: 'relative',
      backgroundImage: `url(${IMGS.hero})`,
      backgroundSize: 'cover', backgroundPosition: 'center',
    }}>
      {/* Dark overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.55) 100%)',
      }} />

      {/* Content — bottom aligned */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '0 40px 72px',
        maxWidth: 1240, margin: '0 auto',
      }}>
        <div style={{ maxWidth: 1240 }}>
          <h1 className="serif" style={{
            fontSize: 'clamp(48px, 7vw, 96px)',
            fontWeight: 700, color: C.white,
            lineHeight: 1.0, letterSpacing: -2,
            marginBottom: 28,
          }}>
            Your home,<br /><em style={{ fontStyle: 'italic' }}>beautifully</em> clean.
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <button onClick={onQuote} style={{
              background: C.white, color: C.dark,
              border: 'none', borderRadius: 6,
              padding: '14px 32px', fontWeight: 600, fontSize: 15,
              cursor: 'pointer', transition: 'opacity 0.2s',
            }}
              onMouseEnter={e => e.target.style.opacity = '0.88'}
              onMouseLeave={e => e.target.style.opacity = '1'}
            >Get a free quote</button>

            <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>
              Sunshine Coast · Est. locally · Fully insured
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Photo trio ───────────────────────────────────────────────────────────────
function PhotoTrio({ onQuote }) {
  const photos = [
    { img: IMGS.kitchen,  label: 'Kitchen cleans' },
    { img: IMGS.bathroom, label: 'Bathrooms' },
    { img: IMGS.living,   label: 'Living areas' },
  ]
  return (
    <div className="photo-trio">
      {photos.map(p => (
        <div key={p.label} style={{
          position: 'relative', overflow: 'hidden',
          backgroundImage: `url(${p.img})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          cursor: 'pointer',
        }}
          onClick={onQuote}
        >
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.18)',
            transition: 'background 0.3s',
          }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.06)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.18)'}
          />
          <div style={{
            position: 'absolute', bottom: 20, left: 20,
            color: C.white, fontSize: 13, fontWeight: 500,
            letterSpacing: 0.3,
          }}>{p.label}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Intro strip ──────────────────────────────────────────────────────────────
function Intro() {
  return (
    <section style={{
      background: C.white,
      padding: '80px 40px',
      borderBottom: `1px solid ${C.border}`,
    }}>
      <div style={{
        maxWidth: 1240, margin: '0 auto',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: 48, flexWrap: 'wrap',
      }}>
        <p className="serif" style={{
          fontSize: 'clamp(22px, 3vw, 34px)',
          fontWeight: 400, fontStyle: 'italic',
          color: C.dark, lineHeight: 1.5, maxWidth: 620,
          letterSpacing: -0.3,
        }}>
          "Professional home cleaning for Sunshine Coast families who value their time — and their home."
        </p>
        <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap' }}>
          {[['200+', 'Happy clients'], ['5 ★', 'Rating'], ['3 yrs', 'On the Coast']].map(([n, l]) => (
            <div key={l} style={{ textAlign: 'center' }}>
              <div className="serif" style={{ fontSize: 28, fontWeight: 700, color: C.dark }}>{n}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 4, fontWeight: 500 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Services — split with photo ─────────────────────────────────────────────
const SERVICES = [
  {
    img: IMGS.living,
    name: 'Regular Clean',
    sub: 'Weekly or fortnightly',
    desc: 'Your home, consistently fresh. We handle everything — vacuuming, dusting, bathrooms, kitchen, floors — so you never have to think about it.',
  },
  {
    img: IMGS.kitchen,
    name: 'Deep Clean',
    sub: 'Ideal as your first booking',
    desc: 'A top-to-bottom reset. Oven, skirting boards, window sills, handles — all the details that regular cleaning doesn\'t reach.',
  },
  {
    img: IMGS.bedroom,
    name: 'Spring Clean',
    sub: 'Seasonal · One-off',
    desc: 'Inside cupboards, behind furniture, blinds, fans — a thorough refresh that leaves every corner of your home immaculate.',
  },
  {
    img: IMGS.bathroom,
    name: 'Move In / Out',
    sub: 'Bond & handover cleans',
    desc: 'Leave your old place spotless or arrive to a fresh start. We focus on exactly what property managers look for.',
  },
]

function Services({ onQuote }) {
  return (
    <section id="services">
      {/* Section header */}
      <div style={{
        background: C.bg, padding: '72px 40px 48px',
        borderTop: `1px solid ${C.border}`,
      }}>
        <div style={{ maxWidth: 1240, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
          <h2 className="serif" style={{ fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 700, color: C.dark, letterSpacing: -1.5 }}>
            Our services
          </h2>
          <button onClick={onQuote} style={{
            background: 'transparent', color: C.dark,
            border: `1px solid ${C.border}`, borderRadius: 6,
            padding: '11px 24px', fontWeight: 500, fontSize: 13,
            cursor: 'pointer', transition: 'border-color 0.2s',
          }}
            onMouseEnter={e => e.target.style.borderColor = C.dark}
            onMouseLeave={e => e.target.style.borderColor = C.border}
          >Get a personalised quote →</button>
        </div>
      </div>

      {/* Alternating photo + text rows */}
      {SERVICES.map((s, i) => (
        <div key={s.name} className={i % 2 === 0 ? 'split' : 'split-rev'}
          style={{ borderTop: `1px solid ${C.border}` }}>
          {/* Photo side */}
          <div style={{
            backgroundImage: `url(${s.img})`,
            backgroundSize: 'cover', backgroundPosition: 'center',
            minHeight: 420,
            order: i % 2 === 0 ? 0 : 1,
          }} />
          {/* Text side */}
          <div style={{
            background: i % 2 === 0 ? C.white : C.warm,
            padding: '56px 48px',
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
            order: i % 2 === 0 ? 1 : 0,
          }}>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>
              {String(i + 1).padStart(2, '0')} — {s.sub}
            </div>
            <h3 className="serif" style={{ fontSize: 'clamp(26px, 3vw, 40px)', fontWeight: 700, color: C.dark, letterSpacing: -1, marginBottom: 20 }}>
              {s.name}
            </h3>
            <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.8, maxWidth: 380 }}>
              {s.desc}
            </p>
          </div>
        </div>
      ))}
    </section>
  )
}

// ─── Full-bleed coastal photo with text overlay ───────────────────────────────
function CoastalBreak({ onQuote }) {
  return (
    <section style={{
      position: 'relative', height: 480,
      backgroundImage: `url(${IMGS.coastal})`,
      backgroundSize: 'cover', backgroundPosition: 'center 70%',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(26,23,20,0.52)',
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: '0 40px',
      }}>
        <p className="serif" style={{
          fontSize: 'clamp(18px, 3vw, 28px)',
          fontStyle: 'italic', color: 'rgba(255,255,255,0.9)',
          lineHeight: 1.6, maxWidth: 640, marginBottom: 32,
        }}>
          Locally owned and operated on the Sunshine Coast — we treat your home
          the way we'd want ours treated.
        </p>
        <button onClick={onQuote} style={{
          background: 'rgba(255,255,255,0.15)',
          border: '1px solid rgba(255,255,255,0.5)',
          backdropFilter: 'blur(8px)',
          color: C.white, borderRadius: 6,
          padding: '12px 32px', fontWeight: 500, fontSize: 14,
          cursor: 'pointer', transition: 'background 0.2s',
        }}
          onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.25)'}
          onMouseLeave={e => e.target.style.background = 'rgba(255,255,255,0.15)'}
        >Get a free quote</button>
      </div>
    </section>
  )
}

// ─── Reviews ──────────────────────────────────────────────────────────────────
const REVIEWS = [
  { name: 'Sarah M.', suburb: 'Maroochydore', text: 'Dust Bunnies have been coming for nearly a year and I genuinely can\'t imagine going back. The team is always on time and the care they put in is obvious every single visit.' },
  { name: 'James T.', suburb: 'Buderim', text: 'After trying three different companies I finally found one that actually delivers. They notice the small things — light switches, door handles, behind the taps. Exceptional.' },
  { name: 'Emma R.', suburb: 'Mooloolaba', text: 'Booked a move-out clean and got our full bond back without a single issue. The property manager even commented on how good the oven was.' },
  { name: 'Kylie B.', suburb: 'Mountain Creek', text: 'Fortnightly for six months and the standard has never dropped once. Coming home on clean day is the best feeling — the whole house just smells amazing.' },
]

function Reviews() {
  return (
    <section id="reviews" style={{
      background: C.bg,
      padding: '100px 40px',
      borderTop: `1px solid ${C.border}`,
    }}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        <h2 className="serif" style={{
          fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 700,
          color: C.dark, letterSpacing: -1.5, marginBottom: 56,
        }}>
          What our clients say
        </h2>
        <div className="reviews-grid">
          {REVIEWS.map(r => (
            <div key={r.name} style={{
              background: C.white, borderRadius: 12,
              padding: '36px 32px',
              border: `1px solid ${C.border}`,
            }}>
              <div style={{ marginBottom: 16 }}>
                {[...Array(5)].map((_, i) => (
                  <span key={i} style={{ color: C.sand, fontSize: 13, marginRight: 1 }}>★</span>
                ))}
              </div>
              <p style={{ fontSize: 15, color: C.text, lineHeight: 1.8, marginBottom: 24 }}>
                "{r.text}"
              </p>
              <div style={{ fontSize: 13, color: C.muted }}>
                <span style={{ fontWeight: 600, color: C.dark }}>{r.name}</span> · {r.suburb}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Areas — photo left, list right ─────────────────────────────────────────
const AREAS = ['Twin Waters','Maroochydore','Kuluin','Forest Glen','Mons','Buderim','Alexandra Headland','Mooloolaba','Mountain Creek','Minyama']

function Areas() {
  return (
    <section id="areas" style={{ borderTop: `1px solid ${C.border}` }}>
      <div className="split">
        <div style={{
          backgroundImage: `url(${IMGS.clean2})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          minHeight: 500,
        }} />
        <div style={{
          background: C.white, padding: '72px 48px',
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
        }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>
            Where we work
          </div>
          <h2 className="serif" style={{
            fontSize: 'clamp(28px, 3vw, 42px)', fontWeight: 700,
            color: C.dark, letterSpacing: -1, marginBottom: 32, lineHeight: 1.1,
          }}>
            Across the<br />Sunshine Coast
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {AREAS.map(a => (
              <span key={a} style={{
                background: C.warm, color: C.text,
                border: `1px solid ${C.border}`,
                borderRadius: 6, padding: '7px 14px',
                fontSize: 13, fontWeight: 500,
              }}>{a}</span>
            ))}
          </div>
          <p style={{ marginTop: 28, fontSize: 13, color: C.muted, lineHeight: 1.7 }}>
            Not sure if we cover your suburb? Get a quote and we'll let you know.
          </p>
        </div>
      </div>
    </section>
  )
}

// ─── CTA — full-bleed dark ───────────────────────────────────────────────────
function CTA({ onQuote }) {
  return (
    <section style={{
      background: C.dark, padding: '120px 40px',
      textAlign: 'center',
    }}>
      <h2 className="serif" style={{
        fontSize: 'clamp(36px, 6vw, 76px)',
        fontWeight: 700, color: C.white,
        letterSpacing: -2.5, lineHeight: 1.0, marginBottom: 32,
      }}>
        Ready for a home<br />that feels effortless?
      </h2>
      <button onClick={onQuote} style={{
        background: C.sand, color: C.dark,
        border: 'none', borderRadius: 6,
        padding: '16px 40px', fontWeight: 600, fontSize: 16,
        cursor: 'pointer', transition: 'opacity 0.2s',
      }}
        onMouseEnter={e => e.target.style.opacity = '0.85'}
        onMouseLeave={e => e.target.style.opacity = '1'}
      >Get a free quote</button>
      <div style={{ marginTop: 16, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
        Free · No commitment · Reply within a few hours
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{ background: '#111009', padding: '64px 40px 36px' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        <div className="footer-cols">
          <div>
            <span className="serif" style={{ fontSize: 20, fontWeight: 700, color: C.bg, display: 'block', marginBottom: 14 }}>
              Dust Bunnies
            </span>
            <p style={{ fontSize: 13, color: 'rgba(248,245,240,0.4)', lineHeight: 1.75, maxWidth: 260, marginBottom: 16 }}>
              Locally owned home cleaning for Sunshine Coast families.
            </p>
            <div style={{ fontSize: 11, color: 'rgba(248,245,240,0.2)' }}>ABN 38 682 974 761</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(248,245,240,0.28)', fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 18 }}>Contact</div>
            {[
              { t: '0484 264 458', h: 'tel:0484264458' },
              { t: 'dustbunzcleaning@gmail.com', h: 'mailto:dustbunzcleaning@gmail.com' },
              { t: 'Maroochydore, QLD', h: null },
            ].map(c => (
              <div key={c.t} style={{ marginBottom: 9 }}>
                {c.h
                  ? <a href={c.h} style={{ color: 'rgba(248,245,240,0.5)', fontSize: 13 }}
                      onMouseEnter={e => e.target.style.color = C.bg}
                      onMouseLeave={e => e.target.style.color = 'rgba(248,245,240,0.5)'}>{c.t}</a>
                  : <span style={{ color: 'rgba(248,245,240,0.5)', fontSize: 13 }}>{c.t}</span>
                }
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(248,245,240,0.28)', fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 18 }}>Follow</div>
            {[
              { l: 'Instagram', h: 'https://instagram.com/dustbunzcleaning' },
              { l: 'Facebook', h: 'https://facebook.com/dustbunniescleaningsc' },
            ].map(s => (
              <div key={s.l} style={{ marginBottom: 9 }}>
                <a href={s.h} target="_blank" rel="noopener noreferrer"
                  style={{ color: 'rgba(248,245,240,0.5)', fontSize: 13 }}
                  onMouseEnter={e => e.target.style.color = C.bg}
                  onMouseLeave={e => e.target.style.color = 'rgba(248,245,240,0.5)'}
                >{s.l}</a>
              </div>
            ))}
          </div>
        </div>
        <div style={{
          marginTop: 52, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', justifyContent: 'space-between',
          fontSize: 11, color: 'rgba(248,245,240,0.18)', flexWrap: 'wrap', gap: 8,
        }}>
          <span>© {new Date().getFullYear()} Dust Bunnies Cleaning Co.</span>
          <span>Sunshine Coast, Queensland</span>
        </div>
      </div>
    </footer>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function Website() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!document.getElementById('db-site-css')) {
      const el = document.createElement('style')
      el.id = 'db-site-css'
      el.textContent = CSS
      document.head.appendChild(el)
    }
    return () => document.getElementById('db-site-css')?.remove()
  }, [])

  const goToQuote = () => navigate('/form')

  return (
    <div>
      <Nav onQuote={goToQuote} />
      <Hero onQuote={goToQuote} />
      <PhotoTrio onQuote={goToQuote} />
      <Intro />
      <Services onQuote={goToQuote} />
      <CoastalBreak onQuote={goToQuote} />
      <Reviews />
      <Areas />
      <CTA onQuote={goToQuote} />
      <Footer />
    </div>
  )
}
