'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  fetchCurrentUser,
  fetchHotel,
  fetchRoomTypes,
  createRoomType,
  deleteRoomType,
  fetchRooms,
  createRoom,
  updateRoom,
  deleteRoom,
  type CurrentUser,
  type Hotel,
  type RoomType,
  type Room,
} from '../../../lib/api-client';
import { Shell } from '../../../components/shell';

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'Available',
  OCCUPIED: 'Occupied',
  MAINTENANCE: 'Maintenance',
  OUT_OF_SERVICE: 'Out of Service',
};

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: '#16a34a',
  OCCUPIED: '#d97706',
  MAINTENANCE: '#2563eb',
  OUT_OF_SERVICE: '#dc2626',
};

export default function RoomsPage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'rooms' | 'types'>('rooms');

  // New room type form
  const [showTypeForm, setShowTypeForm] = useState(false);
  const [typeForm, setTypeForm] = useState({ name: '', description: '', baseRate: '', maxOccupancy: '2' });
  const [typeSaving, setTypeSaving] = useState(false);

  // New room form
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [roomForm, setRoomForm] = useState({ roomTypeId: '', number: '', floor: '', status: 'AVAILABLE', notes: '' });
  const [roomSaving, setRoomSaving] = useState(false);

  const load = useCallback(async (hotelId: string) => {
    const [rt, rm] = await Promise.all([fetchRoomTypes(hotelId), fetchRooms(hotelId)]);
    setRoomTypes(rt);
    setRooms(rm);
  }, []);

  useEffect(() => {
    fetchCurrentUser()
      .then((u) => {
        setUser(u);
        return fetchHotel()
          .then((h) => { setHotel(h); return load(h.id); })
          .catch(() => null);
      })
      .catch(() => router.replace('/login'));
  }, [router, load]);

  const handleCreateType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hotel) return;
    setTypeSaving(true);
    setError(null);
    try {
      await createRoomType(hotel.id, {
        name: typeForm.name,
        description: typeForm.description || undefined,
        baseRate: parseFloat(typeForm.baseRate),
        maxOccupancy: parseInt(typeForm.maxOccupancy, 10),
      });
      setTypeForm({ name: '', description: '', baseRate: '', maxOccupancy: '2' });
      setShowTypeForm(false);
      await load(hotel.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTypeSaving(false);
    }
  };

  const handleDeleteType = async (roomTypeId: string) => {
    if (!hotel || !confirm('Delete this room type?')) return;
    setError(null);
    try {
      await deleteRoomType(hotel.id, roomTypeId);
      await load(hotel.id);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hotel) return;
    setRoomSaving(true);
    setError(null);
    try {
      await createRoom(hotel.id, {
        roomTypeId: roomForm.roomTypeId,
        number: roomForm.number,
        floor: roomForm.floor ? parseInt(roomForm.floor, 10) : undefined,
        status: roomForm.status,
        notes: roomForm.notes || undefined,
      });
      setRoomForm({ roomTypeId: '', number: '', floor: '', status: 'AVAILABLE', notes: '' });
      setShowRoomForm(false);
      await load(hotel.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRoomSaving(false);
    }
  };

  const handleStatusChange = async (room: Room, status: string) => {
    if (!hotel) return;
    setError(null);
    try {
      await updateRoom(hotel.id, room.id, { status });
      await load(hotel.id);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!hotel || !confirm('Delete this room?')) return;
    setError(null);
    try {
      await deleteRoom(hotel.id, roomId);
      await load(hotel.id);
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (!user) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <p>Loading…</p>
      </main>
    );
  }

  if (!hotel) {
    return (
      <Shell user={user}>
        <h1 style={{ marginTop: 0, fontSize: '1.5rem' }}>Room Inventory</h1>
        <p style={{ color: '#6b7280' }}>
          Configure your hotel profile first before managing rooms.{' '}
          <a href="/dashboard/hotel" style={{ color: '#1a4d8f' }}>Go to Hotel Settings →</a>
        </p>
      </Shell>
    );
  }

  return (
    <Shell user={user}>
      <div style={s.pageHeader}>
        <h1 style={s.h1}>Room Inventory</h1>
        <span style={s.hotelLabel}>{hotel.name}</span>
      </div>

      {error && <div style={s.errorBanner}>{error}</div>}

      {/* Tabs */}
      <div style={s.tabs}>
        {(['rooms', 'types'] as const).map((tab) => (
          <button
            key={tab}
            style={{ ...s.tab, ...(activeTab === tab ? s.tabActive : {}) }}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'rooms' ? `Rooms (${rooms.length})` : `Room Types (${roomTypes.length})`}
          </button>
        ))}
      </div>

      {/* Room Types Tab */}
      {activeTab === 'types' && (
        <div style={s.section}>
          <div style={s.sectionHeader}>
            <h2 style={s.h2}>Room Types</h2>
            <button style={s.addBtn} onClick={() => setShowTypeForm((v) => !v)}>
              {showTypeForm ? 'Cancel' : '+ Add room type'}
            </button>
          </div>

          {showTypeForm && (
            <form onSubmit={handleCreateType} style={s.inlineForm}>
              <input style={s.input} placeholder="Name *" required value={typeForm.name} onChange={(e) => setTypeForm((f) => ({ ...f, name: e.target.value }))} maxLength={100} />
              <input style={s.input} placeholder="Base rate (USD) *" required type="number" step="0.01" min="0" value={typeForm.baseRate} onChange={(e) => setTypeForm((f) => ({ ...f, baseRate: e.target.value }))} />
              <input style={s.input} placeholder="Max occupancy *" required type="number" min="1" value={typeForm.maxOccupancy} onChange={(e) => setTypeForm((f) => ({ ...f, maxOccupancy: e.target.value }))} />
              <input style={s.input} placeholder="Description" value={typeForm.description} onChange={(e) => setTypeForm((f) => ({ ...f, description: e.target.value }))} maxLength={500} />
              <button type="submit" disabled={typeSaving} style={s.saveBtn}>{typeSaving ? 'Saving…' : 'Save'}</button>
            </form>
          )}

          {roomTypes.length === 0 ? (
            <p style={s.empty}>No room types yet. Add one to start configuring rooms.</p>
          ) : (
            <table style={s.table}>
              <thead>
                <tr>
                  {['Name', 'Base rate', 'Max occupancy', 'Rooms', ''].map((h) => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {roomTypes.map((rt) => (
                  <tr key={rt.id} style={s.tr}>
                    <td style={s.td}><strong>{rt.name}</strong>{rt.description && <span style={s.sub}>{rt.description}</span>}</td>
                    <td style={s.td}>${rt.baseRate.toFixed(2)}</td>
                    <td style={s.td}>{rt.maxOccupancy}</td>
                    <td style={s.td}>{rt.roomCount ?? 0}</td>
                    <td style={{ ...s.td, textAlign: 'right' }}>
                      <button style={s.dangerBtn} onClick={() => handleDeleteType(rt.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Rooms Tab */}
      {activeTab === 'rooms' && (
        <div style={s.section}>
          <div style={s.sectionHeader}>
            <h2 style={s.h2}>Rooms</h2>
            <button
              style={s.addBtn}
              onClick={() => {
                if (roomTypes.length === 0) { setError('Add at least one room type first.'); return; }
                setShowRoomForm((v) => !v);
              }}
            >
              {showRoomForm ? 'Cancel' : '+ Add room'}
            </button>
          </div>

          {showRoomForm && (
            <form onSubmit={handleCreateRoom} style={s.inlineForm}>
              <select style={s.input} required value={roomForm.roomTypeId} onChange={(e) => setRoomForm((f) => ({ ...f, roomTypeId: e.target.value }))}>
                <option value="">Select room type *</option>
                {roomTypes.map((rt) => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
              </select>
              <input style={s.input} placeholder="Room number *" required value={roomForm.number} onChange={(e) => setRoomForm((f) => ({ ...f, number: e.target.value }))} maxLength={20} />
              <input style={s.input} placeholder="Floor" type="number" value={roomForm.floor} onChange={(e) => setRoomForm((f) => ({ ...f, floor: e.target.value }))} />
              <input style={s.input} placeholder="Notes" value={roomForm.notes} onChange={(e) => setRoomForm((f) => ({ ...f, notes: e.target.value }))} maxLength={500} />
              <button type="submit" disabled={roomSaving} style={s.saveBtn}>{roomSaving ? 'Saving…' : 'Save'}</button>
            </form>
          )}

          {rooms.length === 0 ? (
            <p style={s.empty}>No rooms yet. Add room types first, then add rooms.</p>
          ) : (
            <table style={s.table}>
              <thead>
                <tr>
                  {['Room', 'Floor', 'Type', 'Status', ''].map((h) => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => (
                  <tr key={room.id} style={s.tr}>
                    <td style={s.td}><strong>{room.number}</strong></td>
                    <td style={s.td}>{room.floor ?? '—'}</td>
                    <td style={s.td}>{room.roomType.name}<span style={s.sub}>${room.roomType.baseRate.toFixed(2)}/night</span></td>
                    <td style={s.td}>
                      <select
                        style={{ ...s.statusSelect, color: STATUS_COLORS[room.status] }}
                        value={room.status}
                        onChange={(e) => handleStatusChange(room, e.target.value)}
                      >
                        {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </td>
                    <td style={{ ...s.td, textAlign: 'right' }}>
                      <button style={s.dangerBtn} onClick={() => handleDeleteRoom(room.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </Shell>
  );
}

const s: Record<string, React.CSSProperties> = {
  pageHeader: { display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '1.25rem' },
  h1: { margin: 0, fontSize: '1.5rem', color: '#111827' },
  hotelLabel: { fontSize: '0.85rem', color: '#6b7280' },
  errorBanner: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '0.6rem 1rem', color: '#dc2626', fontSize: '0.875rem', marginBottom: '1rem' },
  tabs: { display: 'flex', gap: 0, borderBottom: '2px solid #e2e4e8', marginBottom: '1.5rem' },
  tab: { padding: '0.5rem 1.25rem', border: 'none', borderBottom: '2px solid transparent', background: 'none', cursor: 'pointer', fontSize: '0.875rem', color: '#6b7280', marginBottom: -2 },
  tabActive: { color: '#1a4d8f', borderBottomColor: '#1a4d8f', fontWeight: 600 },
  section: {},
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  h2: { margin: 0, fontSize: '1rem', fontWeight: 600, color: '#374151' },
  addBtn: { padding: '0.4rem 0.9rem', background: '#1a4d8f', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: '0.85rem' },
  inlineForm: { display: 'flex', flexWrap: 'wrap' as const, gap: '0.5rem', marginBottom: '1rem', padding: '1rem', background: '#f9fafb', borderRadius: 6, border: '1px solid #e2e4e8' },
  input: { padding: '0.4rem 0.65rem', borderRadius: 5, border: '1px solid #d1d5db', fontSize: '0.875rem', minWidth: 140 },
  saveBtn: { padding: '0.4rem 0.9rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: '0.875rem' },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.875rem' },
  th: { textAlign: 'left' as const, padding: '0.5rem 0.75rem', borderBottom: '2px solid #e2e4e8', color: '#374151', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase' as const, letterSpacing: '0.04em' },
  tr: { borderBottom: '1px solid #f3f4f6' },
  td: { padding: '0.65rem 0.75rem', color: '#111827', verticalAlign: 'middle' as const, display: 'table-cell', flexDirection: 'column' as const },
  sub: { display: 'block', color: '#9ca3af', fontSize: '0.775rem' },
  empty: { color: '#9ca3af', fontSize: '0.875rem', fontStyle: 'italic' },
  dangerBtn: { padding: '0.3rem 0.65rem', background: 'transparent', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem' },
  statusSelect: { border: 'none', background: 'none', fontSize: '0.875rem', cursor: 'pointer', fontWeight: 600 },
};
