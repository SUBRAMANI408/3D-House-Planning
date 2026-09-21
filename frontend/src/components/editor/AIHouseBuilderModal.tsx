import React, { useState } from 'react';
import { useBuildingStore } from '../../store/buildingStore';
import { useUIStore } from '../../store/uiStore';
import type { Building, Room, Wall, Door, Window, Staircase, Roof, BuildingType, RoomType, Vector2 } from '../../schema/building.types';
import { normalizeBuilding } from '../../schema/normalizeBuilding';

export const AIHouseBuilderModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { setBuilding } = useBuildingStore();
  const { addToast } = useUIStore();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Q&A State
  const [buildingType, setBuildingType] = useState<BuildingType>('house');
  const [floorsCount, setFloorsCount] = useState<number>(2);
  const [bedroomsCount, setBedroomsCount] = useState<number>(3);
  const [bathroomsCount, setBathroomsCount] = useState<number>(2);
  const [hasGarage, setHasGarage] = useState<boolean>(true);
  const [hasBalcony, setHasBalcony] = useState<boolean>(true);
  const [style, setStyle] = useState<string>('Modern Minimalist');

  const [generating, setGenerating] = useState<boolean>(false);
  const [generatedBuilding, setGeneratedBuilding] = useState<Building | null>(null);

  if (!isOpen) return null;

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => {
      const timestamp = Date.now();
      const bId = `ai-house-${timestamp}`;

      const createdFloors = [];

      const gfWidth = hasGarage ? 15 : 11;

      // ── GROUND FLOOR (Floor 0) ──────────────────────────────────────────────
      const floor0Rooms: Room[] = [
        {
          id: `r-gf-liv-${timestamp}`,
          name: 'Living Room',
          type: 'living' as RoomType,
          wallIds: [],
          polygon: [[0, 0], [6, 0], [6, 5], [0, 5]],
          area: 322.9,
          furniture: [
            { id: `f-gf-sofa-${timestamp}`, type: 'sofa_l', position: [3, 0, 2.5], rotation: [0, 0, 0] },
            { id: `f-gf-tv-${timestamp}`, type: 'tv_unit', position: [5.5, 0, 2.5], rotation: [0, 270, 0] },
            { id: `f-gf-table-${timestamp}`, type: 'coffee_table', position: [3, 0, 1.8], rotation: [0, 0, 0] }
          ],
          connections: []
        },
        {
          id: `r-gf-kit-${timestamp}`,
          name: 'Kitchen',
          type: 'kitchen' as RoomType,
          wallIds: [],
          polygon: [[6, 0], [11, 0], [11, 5], [6, 5]],
          area: 269.1,
          furniture: [
            { id: `f-gf-counter-${timestamp}`, type: 'kitchen_counter', position: [9, 0, 4.4], rotation: [0, 0, 0] },
            { id: `f-gf-fridge-${timestamp}`, type: 'refrigerator', position: [10.2, 0, 1.0], rotation: [0, 270, 0] }
          ],
          connections: []
        },
        {
          id: `r-gf-din-${timestamp}`,
          name: 'Dining Room',
          type: 'dining' as RoomType,
          wallIds: [],
          polygon: [[0, 5], [6, 5], [6, 9], [0, 9]],
          area: 258.3,
          furniture: [
            { id: `f-gf-din-tbl-${timestamp}`, type: 'dining_table', position: [3, 0, 7], rotation: [0, 0, 0] }
          ],
          connections: []
        },
        {
          id: `r-gf-bath-${timestamp}`,
          name: 'Guest Bathroom',
          type: 'bathroom' as RoomType,
          wallIds: [],
          polygon: [[6, 5], [9, 5], [9, 7], [6, 7]],
          area: 64.6,
          furniture: [
            { id: `f-gf-toilet-${timestamp}`, type: 'toilet', position: [7, 0, 6], rotation: [0, 0, 0] },
            { id: `f-gf-sink-${timestamp}`, type: 'sink', position: [8.2, 0, 6], rotation: [0, 0, 0] }
          ],
          connections: []
        },
        {
          id: `r-gf-foyer-${timestamp}`,
          name: 'Entrance Foyer',
          type: 'corridor' as RoomType,
          wallIds: [],
          polygon: [[6, 7], [9, 7], [9, 9], [6, 9]],
          area: 64.6,
          furniture: [],
          connections: []
        }
      ];

      if (hasGarage) {
        floor0Rooms.push({
          id: `r-gf-gar-${timestamp}`,
          name: 'Garage',
          type: 'garage' as RoomType,
          wallIds: [],
          polygon: [[11, 0], [15, 0], [15, 7], [11, 7]],
          area: 301.3,
          furniture: [],
          connections: []
        });
      }

      const floor0Walls: Wall[] = [
        { id: `w0-s1-${timestamp}`, startPoint: [0, 0], endPoint: [gfWidth, 0], thickness: 0.25, height: 3.0, isExterior: true },
        { id: `w0-e1-${timestamp}`, startPoint: [gfWidth, 0], endPoint: [gfWidth, 7], thickness: 0.25, height: 3.0, isExterior: true },
        { id: `w0-n1-${timestamp}`, startPoint: [gfWidth, 7], endPoint: [9, 7], thickness: 0.25, height: 3.0, isExterior: true },
        { id: `w0-e2-${timestamp}`, startPoint: [9, 7], endPoint: [9, 9], thickness: 0.25, height: 3.0, isExterior: true },
        { id: `w0-n2-${timestamp}`, startPoint: [9, 9], endPoint: [0, 9], thickness: 0.25, height: 3.0, isExterior: true },
        { id: `w0-w1-${timestamp}`, startPoint: [0, 9], endPoint: [0, 0], thickness: 0.25, height: 3.0, isExterior: true },

        { id: `w0-i1-${timestamp}`, startPoint: [6, 0], endPoint: [6, 9], thickness: 0.15, height: 3.0, isExterior: false },
        { id: `w0-i2-${timestamp}`, startPoint: [0, 5], endPoint: [11, 5], thickness: 0.15, height: 3.0, isExterior: false },
        { id: `w0-i3-${timestamp}`, startPoint: [6, 7], endPoint: [9, 7], thickness: 0.15, height: 3.0, isExterior: false },
        ...(hasGarage ? [{ id: `w0-i4-${timestamp}`, startPoint: [11, 0] as Vector2, endPoint: [11, 7] as Vector2, thickness: 0.15, height: 3.0, isExterior: false }] : [])
      ];

      const floor0Doors: Door[] = [
        { id: `d0-main-${timestamp}`, wallId: `w0-s1-${timestamp}`, position: [3, 0], width: 1.0, height: 2.2, swing: 'in-left' },
        { id: `d0-kit-${timestamp}`, wallId: `w0-i1-${timestamp}`, position: [6, 2.5], width: 0.9, height: 2.1, swing: 'in-left' },
        { id: `d0-bath-${timestamp}`, wallId: `w0-i3-${timestamp}`, position: [7.5, 7], width: 0.8, height: 2.0, swing: 'in-right' }
      ];

      const floor0Windows: Window[] = [
        { id: `win0-liv-${timestamp}`, wallId: `w0-s1-${timestamp}`, position: [1.5, 0], width: 1.6, height: 1.4, sillHeight: 0.8 },
        { id: `win0-kit-${timestamp}`, wallId: `w0-s1-${timestamp}`, position: [8.5, 0], width: 1.4, height: 1.2, sillHeight: 0.9 },
        { id: `win0-din-${timestamp}`, wallId: `w0-w1-${timestamp}`, position: [0, 7.0], width: 1.5, height: 1.2, sillHeight: 0.9 }
      ];

      const floor0Stairs: Staircase[] = floorsCount > 1 ? [
        { id: `stair0-${timestamp}`, startFloorIndex: 0, endFloorIndex: 1, position: [3.2, 5.2], width: 1.2, length: 2.6, type: 'straight' }
      ] : [];

      createdFloors.push({
        index: 0,
        name: 'Ground Floor',
        height: 0,
        rooms: floor0Rooms,
        walls: floor0Walls,
        doors: floor0Doors,
        windows: floor0Windows,
        staircases: floor0Stairs,
        roof: undefined as Roof | undefined
      });

      // ── FIRST FLOOR (Floor 1 if floorsCount >= 2) ───────────────────────────
      if (floorsCount >= 2) {
        const floor1Rooms: Room[] = [
          {
            id: `r-f1-mbed-${timestamp}`,
            name: 'Master Suite',
            type: 'bedroom' as RoomType,
            wallIds: [],
            polygon: [[0, 0], [6, 0], [6, 5], [0, 5]],
            area: 322.9,
            furniture: [
              { id: `f-f1-king-${timestamp}`, type: 'bed_king', position: [3, 0, 2], rotation: [0, 0, 0] },
              { id: `f-f1-ward-${timestamp}`, type: 'wardrobe', position: [5.2, 0, 4], rotation: [0, 270, 0] }
            ],
            connections: []
          },
          {
            id: `r-f1-mbath-${timestamp}`,
            name: 'Ensuite Bathroom',
            type: 'bathroom' as RoomType,
            wallIds: [],
            polygon: [[6, 0], [9, 0], [9, 3], [6, 3]],
            area: 96.8,
            furniture: [
              { id: `f-f1-tub-${timestamp}`, type: 'bathtub', position: [7.5, 0, 1.5], rotation: [0, 0, 0] },
              { id: `f-f1-toilet-${timestamp}`, type: 'toilet', position: [8.2, 0, 2.5], rotation: [0, 0, 0] }
            ],
            connections: []
          },
          {
            id: `r-f1-bed2-${timestamp}`,
            name: 'Bedroom 2',
            type: 'bedroom' as RoomType,
            wallIds: [],
            polygon: [[0, 5], [5, 5], [5, 9], [0, 9]],
            area: 215.2,
            furniture: [
              { id: `f-f1-b2bed-${timestamp}`, type: 'bed_queen', position: [2.5, 0, 7], rotation: [0, 0, 0] }
            ],
            connections: []
          },
          {
            id: `r-f1-bed3-${timestamp}`,
            name: bedroomsCount >= 3 ? 'Bedroom 3' : 'Study Office',
            type: (bedroomsCount >= 3 ? 'bedroom' : 'office') as RoomType,
            wallIds: [],
            polygon: [[5, 5], [10, 5], [10, 9], [5, 9]],
            area: 215.2,
            furniture: [
              { id: `f-f1-b3bed-${timestamp}`, type: bedroomsCount >= 3 ? 'bed_queen' : 'desk', position: [7.5, 0, 7], rotation: [0, 0, 0] }
            ],
            connections: []
          },
          {
            id: `r-f1-lounge-${timestamp}`,
            name: 'Family Lounge',
            type: 'living' as RoomType,
            wallIds: [],
            polygon: [[6, 3], [11, 3], [11, 5], [6, 5]],
            area: 86.1,
            furniture: [
              { id: `f-f1-lsofa-${timestamp}`, type: 'sofa', position: [8.5, 0, 4], rotation: [0, 180, 0] }
            ],
            connections: []
          }
        ];

        if (hasBalcony) {
          floor1Rooms.push({
            id: `r-f1-balc-${timestamp}`,
            name: 'Terrace Balcony',
            type: 'balcony' as RoomType,
            wallIds: [],
            polygon: [[9, 0], [14, 0], [14, 3], [9, 3]],
            area: 161.4,
            furniture: [],
            connections: []
          });
        }

        const endS1X = hasBalcony ? 14 : 9;

        const floor1Walls: Wall[] = [
          { id: `w1-s1-${timestamp}`, startPoint: [0, 0], endPoint: [endS1X, 0], thickness: 0.25, height: 3.0, isExterior: true },
          { id: `w1-e1-${timestamp}`, startPoint: [endS1X, 0], endPoint: [endS1X, 3], thickness: 0.25, height: 3.0, isExterior: true },
          { id: `w1-e2-${timestamp}`, startPoint: [endS1X, 3], endPoint: [11, 3], thickness: 0.25, height: 3.0, isExterior: true },
          { id: `w1-e3-${timestamp}`, startPoint: [11, 3], endPoint: [10, 5], thickness: 0.25, height: 3.0, isExterior: true },
          { id: `w1-n1-${timestamp}`, startPoint: [10, 5], endPoint: [10, 9], thickness: 0.25, height: 3.0, isExterior: true },
          { id: `w1-n2-${timestamp}`, startPoint: [10, 9], endPoint: [0, 9], thickness: 0.25, height: 3.0, isExterior: true },
          { id: `w1-w1-${timestamp}`, startPoint: [0, 9], endPoint: [0, 0], thickness: 0.25, height: 3.0, isExterior: true },

          { id: `w1-i1-${timestamp}`, startPoint: [6, 0], endPoint: [6, 5], thickness: 0.15, height: 3.0, isExterior: false },
          { id: `w1-i2-${timestamp}`, startPoint: [6, 3], endPoint: [9, 3], thickness: 0.15, height: 3.0, isExterior: false },
          { id: `w1-i3-${timestamp}`, startPoint: [0, 5], endPoint: [11, 5], thickness: 0.15, height: 3.0, isExterior: false },
          { id: `w1-i4-${timestamp}`, startPoint: [5, 5], endPoint: [5, 9], thickness: 0.15, height: 3.0, isExterior: false }
        ];

        const floor1Doors: Door[] = [
          { id: `d1-mbed-${timestamp}`, wallId: `w1-i1-${timestamp}`, position: [6, 4], width: 0.9, height: 2.1, swing: 'in-left' },
          { id: `d1-mbath-${timestamp}`, wallId: `w1-i2-${timestamp}`, position: [7.5, 3], width: 0.8, height: 2.0, swing: 'in-left' },
          { id: `d1-bed2-${timestamp}`, wallId: `w1-i3-${timestamp}`, position: [2.5, 5], width: 0.9, height: 2.1, swing: 'in-left' },
          { id: `d1-bed3-${timestamp}`, wallId: `w1-i3-${timestamp}`, position: [7.5, 5], width: 0.9, height: 2.1, swing: 'in-left' }
        ];

        const floor1Windows: Window[] = [
          { id: `win1-mbed-${timestamp}`, wallId: `w1-s1-${timestamp}`, position: [3, 0], width: 1.8, height: 1.4, sillHeight: 0.8 },
          { id: `win1-bed2-${timestamp}`, wallId: `w1-w1-${timestamp}`, position: [0, 7], width: 1.5, height: 1.2, sillHeight: 0.9 },
          { id: `win1-bed3-${timestamp}`, wallId: `w1-n2-${timestamp}`, position: [7.5, 9], width: 1.5, height: 1.2, sillHeight: 0.9 }
        ];

        const floor1Stairs: Staircase[] = [
          { id: `stair1-${timestamp}`, startFloorIndex: 0, endFloorIndex: 1, position: [3.2, 5.2], width: 1.2, length: 2.6, type: 'straight' },
          ...(floorsCount > 2 ? [{ id: `stair1-2-${timestamp}`, startFloorIndex: 1, endFloorIndex: 2, position: [7.2, 3.2] as Vector2, width: 1.2, length: 2.6, type: 'straight' as const }] : [])
        ];

        createdFloors.push({
          index: 1,
          name: 'First Floor',
          height: 3.0,
          rooms: floor1Rooms,
          walls: floor1Walls,
          doors: floor1Doors,
          windows: floor1Windows,
          staircases: floor1Stairs,
          roof: undefined as Roof | undefined
        });
      }

      // ── SECOND FLOOR (Floor 2 if floorsCount === 3) ─────────────────────────
      if (floorsCount >= 3) {
        createdFloors.push({
          index: 2,
          name: 'Second Floor (Penthouse)',
          height: 6.0,
          rooms: [
            {
              id: `r-f2-suite-${timestamp}`,
              name: 'Sky Lounge & Penthouse Suite',
              type: 'bedroom' as RoomType,
              wallIds: [],
              polygon: [[0, 0], [6, 0], [6, 5], [0, 5]],
              area: 322.9,
              furniture: [
                { id: `f-f2-king-${timestamp}`, type: 'bed_king', position: [3, 0, 2], rotation: [0, 0, 0] }
              ],
              connections: []
            },
            {
              id: `r-f2-terrace-${timestamp}`,
              name: 'Roof Terrace',
              type: 'balcony' as RoomType,
              wallIds: [],
              polygon: [[6, 0], [12, 0], [12, 5], [6, 5]],
              area: 322.9,
              furniture: [],
              connections: []
            }
          ],
          walls: [
            { id: `w2-s1-${timestamp}`, startPoint: [0, 0], endPoint: [12, 0], thickness: 0.25, height: 3.0, isExterior: true },
            { id: `w2-e1-${timestamp}`, startPoint: [12, 0], endPoint: [12, 5], thickness: 0.25, height: 3.0, isExterior: true },
            { id: `w2-n1-${timestamp}`, startPoint: [12, 5], endPoint: [0, 5], thickness: 0.25, height: 3.0, isExterior: true },
            { id: `w2-w1-${timestamp}`, startPoint: [0, 5], endPoint: [0, 0], thickness: 0.25, height: 3.0, isExterior: true },
            { id: `w2-i1-${timestamp}`, startPoint: [6, 0], endPoint: [6, 5], thickness: 0.15, height: 3.0, isExterior: false }
          ],
          doors: [
            { id: `d2-terr-${timestamp}`, wallId: `w2-i1-${timestamp}`, position: [6, 2.5], width: 1.2, height: 2.2, swing: 'sliding' }
          ],
          windows: [
            { id: `win2-suite-${timestamp}`, wallId: `w2-s1-${timestamp}`, position: [3, 0], width: 1.8, height: 1.4, sillHeight: 0.8 }
          ],
          staircases: [
            { id: `stair2-${timestamp}`, startFloorIndex: 1, endFloorIndex: 2, position: [7.2, 3.2], width: 1.2, length: 2.6, type: 'straight' }
          ],
          roof: undefined as Roof | undefined
        });
      }

      // ── Assign Roof to Topmost Floor ───────────────────────────────────────
      const topFloor = createdFloors[createdFloors.length - 1];
      const roofType = style.includes('Minimalist') || style.includes('Contemporary') ? 'flat' : 'pitched_hip';
      topFloor.roof = {
        id: `roof-ai-${timestamp}`,
        type: roofType as Roof['type'],
        height: roofType === 'flat' ? 0.4 : 2.2,
        overhang: 0.6,
        color: roofType === 'flat' ? '#475569' : '#b91c1c'
      } as Roof;

      const rawAiBuilding = {
        buildingId: bId,
        buildingType,
        name: `AI ${style} ${bedroomsCount} BHK (${floorsCount} Story)`,
        units: 'metric',
        metadata: {
          createdVia: 'ai',
          description: `AI-generated ${bedroomsCount} BHK, ${floorsCount}-floor residence in ${style} style with connecting stairs, doors, windows, complete furniture, and roof.`
        },
        floors: createdFloors
      };

      const finalBuilding = normalizeBuilding(rawAiBuilding);
      setGeneratedBuilding(finalBuilding);
      setGenerating(false);
      setStep(4);
      addToast({ type: 'success', message: 'AI House generated successfully!' });
    }, 1200);
  };

  const handleEditBuilding = () => {
    if (generatedBuilding) {
      setBuilding(generatedBuilding);
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

        {/* Step 1: Building Type */}
        {step === 1 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
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
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${buildingType === item.id ? 'var(--accent-secondary)' : 'var(--border-default)'}`,
                  backgroundColor: buildingType === item.id ? 'rgba(139,92,246,0.1)' : 'var(--bg-elevated)',
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>{item.emoji}</div>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>{item.label}</div>
              </div>
            ))}
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
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>{generatedBuilding.metadata.name}</h3>
                <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '13px' }}>{generatedBuilding.metadata.description}</p>
              </div>
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
