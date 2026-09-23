import React, { useState } from 'react';
import { useBuildingStore } from '../../store/buildingStore';
import { useUIStore } from '../../store/uiStore';
import { apiClient } from '../../api/client';
import type { Building, BuildingType } from '../../schema/building.types';
import { normalizeBuilding } from '../../schema/normalizeBuilding';
import { computeSlabGeometries } from '../../utils/geometry';

export const AIHouseBuilderModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { setBuilding } = useBuildingStore();
  const { addToast } = useUIStore();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Q&A & Prompt State
  const [naturalPrompt, setNaturalPrompt] = useState<string>('3 BHK modern minimalist house with 2 floors, master suite, garage, and balcony');
  const [buildingType, setBuildingType] = useState<BuildingType>('house');
  const [floorsCount, setFloorsCount] = useState<number>(2);
  const [bedroomsCount, setBedroomsCount] = useState<number>(3);
  const [bathroomsCount, setBathroomsCount] = useState<number>(2);
  const [hasGarage, setHasGarage] = useState<boolean>(true);
  const [hasBalcony, setHasBalcony] = useState<boolean>(true);
  const [style, setStyle] = useState<string>('Modern Minimalist');

  const [generating, setGenerating] = useState<boolean>(false);
  const [generatedBuilding, setGeneratedBuilding] = useState<Building | null>(null);
  const [validationReport, setValidationReport] = useState<{ status: string; totalIssues: number } | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setGenerating(true);
    setValidationReport(null);
    try {
      // Call backend AI generation & pre-validation service
      const res = await apiClient.post('/api/ai/generate', {
        prompt: naturalPrompt,
        buildingType,
        floorsCount,
        bedroomsCount,
        bathroomsCount,
        hasGarage,
        hasBalcony,
        style,
      });

      if (res.data && res.data.building) {
        const valStatus = res.data.validation?.status;
        setValidationReport(res.data.validation || { status: 'error', totalIssues: 1, issues: [{level: 'error', type: 'geometry', message: 'No validation object'}] });

        if (valStatus !== 'passed') {
          setGenerating(false);
          addToast({
            type: 'error',
            message: 'Generated building has no successful validation result.',
          });
          return;
        }

        const norm = normalizeBuilding(res.data.building);
        setGeneratedBuilding(norm);
        setGenerating(false);
        setStep(4);
        addToast({ type: 'success', message: 'AI House generated and validated successfully!' });
        return;
      }
    } catch (err) {
      console.warn('Backend AI endpoint unavailable:', err);
      setGenerating(false);
      addToast({ type: 'error', message: 'Backend AI service unavailable. Cannot generate building offline.' });
    }
  };

  const handleEditBuilding = () => {
    if (generatedBuilding) {
      try {
        const validatedBuilding = computeSlabGeometries(generatedBuilding);
        setBuilding(validatedBuilding);
      } catch (e: any) {
        addToast({ type: 'error', message: `Geometry Compilation Failed: ${e.message}` });
        return;
      }
      onClose();
      addToast({ type: 'info', message: 'Building loaded into 3D Editor. You can now edit all components!' });
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)',
        maxWidth: '640px',
        width: '100%',
        padding: '32px',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--accent-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              🤖 AI House Builder
            </span>
            <h2 style={{ margin: '4px 0 0', fontSize: '22px', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
              {step === 1 && 'Select Building Type'}
              {step === 2 && 'Choose Room & Floor Configuration'}
              {step === 3 && 'Pick Architectural Style'}
              {step === 4 && 'Generated AI Building Ready!'}
            </h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }}>✕</button>
        </div>

        {/* Step Indicator */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {[1, 2, 3, 4].map(s => (
            <div key={s} style={{
              flex: 1,
              height: '4px',
              borderRadius: '2px',
              backgroundColor: s <= step ? 'var(--accent-secondary)' : 'var(--border-subtle)',
              transition: 'background 0.3s'
            }} />
          ))}
        </div>

        {/* Step 1: Building Prompt & Type */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontWeight: 600, fontSize: '14px', display: 'block', marginBottom: '8px' }}>
                ✨ Describe your building in plain English:
              </label>
              <textarea
                value={naturalPrompt}
                onChange={(e) => setNaturalPrompt(e.target.value)}
                rows={3}
                placeholder="e.g. 3 BHK modern house with 2 floors, master bedroom on first floor with balcony, attached bathrooms, garage on ground floor..."
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-elevated)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
              />
            </div>
            <div>
              <label style={{ fontWeight: 600, fontSize: '14px', display: 'block', marginBottom: '8px' }}>
                Building Typology:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
                {[
                  { id: 'house', label: 'Residential House', emoji: '🏠' },
                  { id: 'apartment', label: 'Apartment', emoji: '🏢' },
                  { id: 'shop', label: 'Retail Shop', emoji: '🏪' },
                  { id: 'hospital', label: 'Medical Facility', emoji: '🏥' },
                ].map(item => (
                  <div
                    key={item.id}
                    onClick={() => setBuildingType(item.id as BuildingType)}
                    style={{
                      padding: '12px',
                      borderRadius: 'var(--radius-md)',
                      border: `2px solid ${buildingType === item.id ? 'var(--accent-secondary)' : 'var(--border-default)'}`,
                      backgroundColor: buildingType === item.id ? 'rgba(139,92,246,0.1)' : 'var(--bg-elevated)',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ fontSize: '28px', marginBottom: '4px' }}>{item.emoji}</div>
                    <div style={{ fontWeight: 600, fontSize: '13px' }}>{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Configuration */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontWeight: 500 }}>Floors Count:</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[1, 2, 3].map(num => (
                  <button
                    key={num}
                    onClick={() => setFloorsCount(num)}
                    style={chipStyle(floorsCount === num)}
                  >
                    {num} Floor{num > 1 ? 's' : ''}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontWeight: 500 }}>Bedrooms (BHK):</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[1, 2, 3, 4].map(num => (
                  <button key={num} onClick={() => setBedroomsCount(num)} style={chipStyle(bedroomsCount === num)}>{num} BHK</button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontWeight: 500 }}>Bathrooms:</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[1, 2, 3].map(num => (
                  <button key={num} onClick={() => setBathroomsCount(num)} style={chipStyle(bathroomsCount === num)}>{num} Bath</button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={hasGarage} onChange={e => setHasGarage(e.target.checked)} />
                Include Garage
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={hasBalcony} onChange={e => setHasBalcony(e.target.checked)} />
                Include Balcony / Terrace
              </label>
            </div>
          </div>
        )}

        {/* Step 3: Style */}
        {step === 3 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
            {['Modern Minimalist', 'Contemporary', 'Luxury Villa', 'Traditional'].map(st => (
              <div
                key={st}
                onClick={() => setStyle(st)}
                style={{
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${style === st ? 'var(--accent-secondary)' : 'var(--border-default)'}`,
                  backgroundColor: style === st ? 'rgba(139,92,246,0.1)' : 'var(--bg-elevated)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  fontWeight: 600
                }}
              >
                {st}
              </div>
            ))}
          </div>
        )}

        {/* Step 4: AI Output Summary */}
        {step === 4 && generatedBuilding && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: 'var(--bg-elevated)', padding: '20px', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '36px' }}>✨</span>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>{generatedBuilding.metadata.name}</h3>
                <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '13px' }}>{generatedBuilding.metadata.description}</p>
              </div>
              {validationReport && (
                <div style={{
                  padding: '6px 12px',
                  borderRadius: '12px',
                  background: validationReport.status === 'passed' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                  border: `1px solid ${validationReport.status === 'passed' ? '#22c55e' : '#ef4444'}`,
                  color: validationReport.status === 'passed' ? '#22c55e' : '#ef4444',
                  fontSize: '12px',
                  fontWeight: 700
                }}>
                  {validationReport.status === 'passed' ? '✅ Validated' : `⚠️ ${validationReport.totalIssues} Issues`}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', textAlign: 'center', marginTop: '8px' }}>
              <div style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent-secondary)' }}>{generatedBuilding.floors.length}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Floors Generated</div>
              </div>
              <div style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent-secondary)' }}>{generatedBuilding.floors.reduce((acc, f) => acc + f.rooms.length, 0)}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Rooms</div>
              </div>
              <div style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent-secondary)' }}>{generatedBuilding.floors.reduce((acc, f) => acc + f.walls.length, 0)}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Walls Generated</div>
              </div>
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
          {step > 1 && step < 4 && (
            <button onClick={() => setStep((step - 1) as 1 | 2 | 3 | 4)} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}>
              ← Back
            </button>
          )}

          {step < 3 && (
            <button onClick={() => setStep((step + 1) as 1 | 2 | 3 | 4)} style={{ padding: '10px 24px', borderRadius: 'var(--radius-md)', background: 'var(--accent-secondary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, marginLeft: 'auto' }}>
              Next →
            </button>
          )}

          {step === 3 && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              style={{
                padding: '12px 28px',
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '15px',
                marginLeft: 'auto'
              }}
            >
              {generating ? '⚡ Generating Complete Multi-Floor House…' : '⚡ Generate House'}
            </button>
          )}

          {step === 4 && (
            <button
              onClick={handleEditBuilding}
              style={{
                padding: '14px 28px',
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '15px',
                width: '100%'
              }}
            >
              🛠 Open & Edit House in 3D Editor →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const chipStyle = (active: boolean): React.CSSProperties => ({
  background: active ? 'var(--accent-secondary)' : 'var(--bg-elevated)',
  color: active ? '#fff' : 'var(--text-primary)',
  border: `1px solid ${active ? 'var(--accent-secondary)' : 'var(--border-default)'}`,
  padding: '6px 14px',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 500
});
