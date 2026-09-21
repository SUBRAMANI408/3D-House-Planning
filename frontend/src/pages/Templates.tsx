import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBuildingStore } from '../store/buildingStore';
import type { TemplateModalEntry } from '../components/templates/TemplatePreviewModal';
import { TemplatePreviewModal } from '../components/templates/TemplatePreviewModal';

// ── Bundled local templates ───────────────────────────────────────────────────
import house2bhk from '../data/templates/house_2bhk.json';
import house3bhk from '../data/templates/house_3bhk_2floor.json';
import studioApt from '../data/templates/apartment_studio.json';
import villa4bhk from '../data/templates/villa_4bhk.json';
import shopUnit  from '../data/templates/shop_unit.json';
import { normalizeBuilding } from '../schema/normalizeBuilding';

const LOCAL_TEMPLATES: TemplateModalEntry[] = [
  {
    id: 'house_2bhk',
    name: '2 BHK House',
    description: 'Compact 2-bedroom single-floor family home with kitchen, dining, and two bathrooms.',
    type: 'house',
    floors: 1,
    tags: ['2 BHK', 'Single Floor', 'Family'],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: normalizeBuilding(house2bhk as any),
  },
  {
    id: 'house_3bhk_2floor',
    name: '3 BHK Two-Story House',
    description: 'Spacious 3-bedroom house spread across two floors with internal staircase.',
    type: 'house',
    floors: 2,
    tags: ['3 BHK', 'Two Floors', 'Staircase'],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: normalizeBuilding(house3bhk as any),
  },
  {
    id: 'apartment_studio',
    name: 'Studio Apartment',
    description: 'Open-plan studio apartment with integrated kitchen and compact bathroom.',
    type: 'apartment',
    floors: 1,
    tags: ['Studio', 'Open Plan', 'Urban'],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: normalizeBuilding(studioApt as any),
  },
  {
    id: 'villa_4bhk',
    name: '4 BHK Villa',
    description: 'Luxurious 4-bedroom villa with master suite, garage, and family lounge.',
    type: 'house',
    floors: 2,
    tags: ['4 BHK', 'Villa', 'Luxury', 'Garage'],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: normalizeBuilding(villa4bhk as any),
  },
  {
    id: 'shop_unit',
    name: 'Retail Shop Unit',
    description: 'Small retail space with storage room, office, and customer bathroom.',
    type: 'shop',
    floors: 1,
    tags: ['Commercial', 'Retail', 'Shop'],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: normalizeBuilding(shopUnit as any),
  },
];

const Templates: React.FC = () => {
  const navigate = useNavigate();
  const { setBuilding } = useBuildingStore();

  const [templates] = useState<TemplateModalEntry[]>(LOCAL_TEMPLATES);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [floorFilter, setFloorFilter] = useState('all');
  const [selectedTemplateForModal, setSelectedTemplateForModal] = useState<TemplateModalEntry | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, []);

  const filteredTemplates = templates.filter(t => {
    const q = search.toLowerCase();
    const matchSearch = t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.tags.some(tag => tag.toLowerCase().includes(q));
    const matchType  = typeFilter === 'all' || t.type === typeFilter;
    const matchFloor = floorFilter === 'all' || t.floors.toString() === floorFilter;
    return matchSearch && matchType && matchFloor;
  });

  const handleEditTemplate = (t: TemplateModalEntry, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setBuilding(t.data);
    navigate(`/editor/${t.id}`);
  };

  const getGradient = (type: string) => {
    switch (type) {
      case 'house':     return 'linear-gradient(135deg, #4f46e5 0%, #818cf8 100%)';
      case 'apartment': return 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)';
      case 'shop':      return 'linear-gradient(135deg, #0369a1 0%, #38bdf8 100%)';
      default:          return 'linear-gradient(135deg, #475569 0%, #94a3b8 100%)';
    }
  };

  const getEmoji = (type: string) => type === 'house' ? '🏠' : type === 'apartment' ? '🏢' : '🏪';

  return (
    <div style={{ backgroundColor: 'var(--bg-base)', minHeight: '100vh', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>
      <style>{`
        .t-card { background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); overflow: hidden; transition: all var(--transition-normal); display: flex; flex-direction: column; cursor: pointer; }
        .t-card:hover { transform: translateY(-6px); border-color: var(--accent-primary); box-shadow: 0 20px 40px -12px rgba(99,102,241,0.3); }
        .t-card:hover .open-btn { background: var(--accent-primary) !important; color: white !important; border-color: var(--accent-primary) !important; }
        .filter-field { background: var(--bg-elevated); border: 1px solid var(--border-default); color: var(--text-primary); padding: 10px 16px; border-radius: var(--radius-md); outline: none; font-family: inherit; font-size: 14px; transition: border-color 0.2s; }
        .filter-field:focus { border-color: var(--accent-primary); }
        @keyframes shimmer { 0% { background-position: -1000px 0; } 100% { background-position: 1000px 0; } }
        .skeleton { background: var(--bg-card); background-image: linear-gradient(90deg, #1a1d26 0px, #252a38 160px, #1a1d26 320px); background-size: 1000px 100%; animation: shimmer 1.8s infinite linear; border-radius: var(--radius-lg); }
        .back-btn { background: none; border: 1px solid var(--border-default); color: var(--text-secondary); padding: 8px 16px; border-radius: var(--radius-md); cursor: pointer; font-family: inherit; font-size: 14px; transition: all 0.2s; }
        .back-btn:hover { border-color: var(--accent-primary); color: var(--text-primary); }
      `}</style>

      {/* Top nav */}
      <div style={{ padding: '20px 40px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--bg-elevated)' }}>
        <button className="back-btn" onClick={() => navigate('/')}>← Home</button>
        <span style={{ color: 'var(--border-default)' }}>|</span>
        <h1 style={{ margin: 0, fontSize: '18px', fontFamily: 'var(--font-display)', fontWeight: 600 }}>Template Library</h1>
      </div>

      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '40px 24px' }}>
        {/* Hero */}
        <div style={{ marginBottom: '40px' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 700, marginBottom: '10px', background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Choose a Starting Template
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '16px', marginBottom: '0' }}>
            Pick a professionally designed layout, preview it, or immediately modify it in the 3D editor.
          </p>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '36px', flexWrap: 'wrap', background: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' }}>
          <input type="text" placeholder="🔍  Search templates…" className="filter-field" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: '1 1 220px', minWidth: '180px' }} />
          <select className="filter-field" value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ flex: '0 1 160px' }}>
            <option value="all">All Types</option>
            <option value="house">🏠 Houses</option>
            <option value="apartment">🏢 Apartments</option>
            <option value="shop">🏪 Shops</option>
          </select>
          <select className="filter-field" value={floorFilter} onChange={e => setFloorFilter(e.target.value)} style={{ flex: '0 1 160px' }}>
            <option value="all">Any Floors</option>
            <option value="1">1 Floor</option>
            <option value="2">2 Floors</option>
          </select>
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
            {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: '340px' }} />)}
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '56px', marginBottom: '20px' }}>🏜️</div>
            <h3 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>No templates found</h3>
            <p>Try clearing your filters.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
            {filteredTemplates.map(t => (
              <div key={t.id} className="t-card" onClick={() => setSelectedTemplateForModal(t)}>
                {/* Thumbnail */}
                <div style={{ height: '190px', background: getGradient(t.type), position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '56px' }}>
                  {getEmoji(t.type)}
                  <span style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#fff' }}>
                    {t.type}
                  </span>
                  <span style={{ position: 'absolute', bottom: '12px', left: '12px', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', color: '#fff' }}>
                    {t.floors} Floor{t.floors > 1 ? 's' : ''}
                  </span>
                </div>

                {/* Body */}
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', flex: 1, gap: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 600 }}>{t.name}</h3>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.6, flex: 1 }}>{t.description}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {t.tags.map(tag => (
                      <span key={tag} style={{ fontSize: '11px', color: 'var(--accent-primary)', background: 'rgba(99,102,241,0.12)', padding: '3px 9px', borderRadius: '4px', fontWeight: 500 }}>{tag}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                    <button
                      className="open-btn"
                      onClick={(e) => handleEditTemplate(t, e)}
                      style={{
                        flex: 1,
                        background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                        color: 'white',
                        border: 'none',
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '13px',
                        fontFamily: 'inherit',
                        transition: 'all 0.2s'
                      }}
                    >
                      🛠 Edit Template
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedTemplateForModal(t); }}
                      style={{
                        background: 'var(--bg-elevated)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-default)',
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        fontWeight: 500,
                        fontSize: '13px',
                        fontFamily: 'inherit'
                      }}
                    >
                      👁 Preview
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Template Preview Modal */}
      <TemplatePreviewModal
        template={selectedTemplateForModal}
        onClose={() => setSelectedTemplateForModal(null)}
      />
    </div>
  );
};

export default Templates;
