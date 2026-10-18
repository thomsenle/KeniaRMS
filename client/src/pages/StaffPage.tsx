import React, { useState, useEffect } from 'react';
import { 
  Users, Calendar, Clock, Plus, Edit2, Trash2, 
  CheckCircle2, XCircle, RefreshCw, Printer, 
  Phone, Briefcase, Filter, ArrowLeft, ArrowRight
} from 'lucide-react';
import { apiRequest, formatKES } from '../api/client';
import { StaffMember, StaffSchedule, StaffTimeEntry, StaffHoursSummary } from '../types';
import { useTranslation } from '../i18n';

interface StaffPageProps {
  activeWaiter?: any;
}

export const StaffPage: React.FC<StaffPageProps> = () => {
  const { t } = useTranslation();

  // Active sub-tab
  const [activeTab, setActiveTab] = useState<'roster' | 'hours' | 'employees'>('roster');

  // Staff list
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Roster state
  const [schedules, setSchedules] = useState<StaffSchedule[]>([]);
  const [currentWeekOffset, setCurrentWeekOffset] = useState<number>(0);
  const [stationFilter, setStationFilter] = useState<string>('all');
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState<boolean>(false);
  const [editingSchedule, setEditingSchedule] = useState<StaffSchedule | null>(null);

  // Schedule form state
  const [schedStaffId, setSchedStaffId] = useState<string>('');
  const [schedDate, setSchedDate] = useState<string>('');
  const [schedStartTime, setSchedStartTime] = useState<string>('08:00');
  const [schedEndTime, setSchedEndTime] = useState<string>('16:30');
  const [schedStation, setSchedStation] = useState<string>('service');
  const [schedStatus, setSchedStatus] = useState<'scheduled' | 'confirmed' | 'completed' | 'absent' | 'sick' | 'holiday'>('scheduled');
  const [schedNotes, setSchedNotes] = useState<string>('');

  // Hours state
  const [hoursPeriod, setHoursPeriod] = useState<'this_week' | 'last_week' | 'this_month' | 'last_month' | 'all'>('this_week');
  const [hoursSummary, setHoursSummary] = useState<any>(null);
  const [timeEntries, setTimeEntries] = useState<StaffTimeEntry[]>([]);
  const [isTimeModalOpen, setIsTimeModalOpen] = useState<boolean>(false);
  const [editingTimeEntry, setEditingTimeEntry] = useState<StaffTimeEntry | null>(null);

  // Time Entry form state
  const [timeStaffId, setTimeStaffId] = useState<string>('');
  const [timeClockIn, setTimeClockIn] = useState<string>('');
  const [timeClockOut, setTimeClockOut] = useState<string>('');
  const [timeBreakMinutes, setTimeBreakMinutes] = useState<number>(30);
  const [timeShiftType, setTimeShiftType] = useState<string>('regular');
  const [timeNotes, setTimeNotes] = useState<string>('');

  // Clock in/out quick action state
  const [clockStaffId, setClockStaffId] = useState<string>('');
  const [clockNotes, setClockNotes] = useState<string>('');
  const [clockBreakMin, setClockBreakMin] = useState<number>(0);
  const [isClockModalOpen, setIsClockModalOpen] = useState<boolean>(false);
  const [clockModalMode, setClockModalMode] = useState<'in' | 'out'>('in');

  // Employee CRUD modal state
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState<boolean>(false);
  const [editingEmployee, setEditingEmployee] = useState<StaffMember | null>(null);
  const [empName, setEmpName] = useState<string>('');
  const [empPin, setEmpPin] = useState<string>('1234');
  const [empRole, setEmpRole] = useState<string>('waiter');
  const [empDept, setEmpDept] = useState<string>('service');
  const [empRate, setEmpRate] = useState<number>(300);
  const [empTargetHours, setEmpTargetHours] = useState<number>(40);
  const [empPhone, setEmpPhone] = useState<string>('');
  const [empEmail, setEmpEmail] = useState<string>('');
  const [empHireDate, setEmpHireDate] = useState<string>('');
  const [empNotes, setEmpNotes] = useState<string>('');

  // Notification helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 1. Load initial staff
  const loadStaff = async () => {
    try {
      const res = await apiRequest<{ success: boolean; staff: StaffMember[] }>('/staff');
      setStaffList(res.staff);
    } catch (err) {
      console.error('Failed to load staff:', err);
    }
  };

  // 2. Week calculation for Roster
  const getWeekDays = (offsetWeeks: number) => {
    const today = new Date();
    const currentDayOfWeek = today.getDay(); // 0 is Sun, 1 is Mon...
    const distanceToMonday = (currentDayOfWeek + 6) % 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - distanceToMonday + offsetWeeks * 7);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const weekDays = getWeekDays(currentWeekOffset);
  const startOfWeekStr = weekDays[0].toISOString().split('T')[0];
  const endOfWeekStr = weekDays[6].toISOString().split('T')[0];

  const loadSchedules = async () => {
    try {
      const res = await apiRequest<{ success: boolean; schedules: StaffSchedule[] }>(
        `/staff/schedules/all?startDate=${startOfWeekStr}&endDate=${endOfWeekStr}`
      );
      setSchedules(res.schedules);
    } catch (err) {
      console.error('Failed to load schedules:', err);
    }
  };

  // 3. Date range for hours summary
  const getHoursDateRange = (period: string) => {
    const now = new Date();
    if (period === 'this_week') {
      const days = getWeekDays(0);
      return { start: days[0].toISOString().split('T')[0], end: days[6].toISOString().split('T')[0] };
    } else if (period === 'last_week') {
      const days = getWeekDays(-1);
      return { start: days[0].toISOString().split('T')[0], end: days[6].toISOString().split('T')[0] };
    } else if (period === 'this_month') {
      const y = now.getFullYear();
      const m = now.getMonth();
      const first = new Date(y, m, 1).toISOString().split('T')[0];
      const last = new Date(y, m + 1, 0).toISOString().split('T')[0];
      return { start: first, end: last };
    } else if (period === 'last_month') {
      const y = now.getFullYear();
      const m = now.getMonth() - 1;
      const first = new Date(y, m, 1).toISOString().split('T')[0];
      const last = new Date(y, m + 1, 0).toISOString().split('T')[0];
      return { start: first, end: last };
    }
    return { start: '', end: '' };
  };

  const loadHoursData = async () => {
    try {
      const range = getHoursDateRange(hoursPeriod);
      let query = '';
      if (range.start && range.end) {
        query = `?startDate=${range.start}&endDate=${range.end}`;
      }
      const [summaryRes, entriesRes] = await Promise.all([
        apiRequest<{ success: boolean; summary: any; staff: StaffHoursSummary[] }>(`/staff/analytics/hours-summary${query}`),
        apiRequest<{ success: boolean; entries: StaffTimeEntry[] }>(`/staff/time-entries/all${query}`)
      ]);
      setHoursSummary(summaryRes);
      setTimeEntries(entriesRes.entries);
    } catch (err) {
      console.error('Failed to load hours:', err);
    }
  };

  useEffect(() => {
    Promise.all([loadStaff(), loadSchedules(), loadHoursData()]);
  }, []);

  useEffect(() => {
    loadSchedules();
  }, [currentWeekOffset]);

  useEffect(() => {
    loadHoursData();
  }, [hoursPeriod]);

  // Handle open add/edit schedule modal
  const handleOpenScheduleModal = (sched?: StaffSchedule, defaultDate?: string) => {
    if (sched) {
      setEditingSchedule(sched);
      setSchedStaffId(sched.staff_id);
      setSchedDate(sched.shift_date);
      setSchedStartTime(sched.start_time);
      setSchedEndTime(sched.end_time);
      setSchedStation(sched.station);
      setSchedStatus(sched.status);
      setSchedNotes(sched.notes || '');
    } else {
      setEditingSchedule(null);
      setSchedStaffId(staffList[0]?.id || '');
      setSchedDate(defaultDate || new Date().toISOString().split('T')[0]);
      setSchedStartTime('08:00');
      setSchedEndTime('16:30');
      setSchedStation('service');
      setSchedStatus('scheduled');
      setSchedNotes('');
    }
    setIsScheduleModalOpen(true);
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSchedule) {
        await apiRequest(`/staff/schedules/${editingSchedule.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            staff_id: schedStaffId,
            shift_date: schedDate,
            start_time: schedStartTime,
            end_time: schedEndTime,
            station: schedStation,
            status: schedStatus,
            notes: schedNotes
          })
        });
      } else {
        await apiRequest('/staff/schedules', {
          method: 'POST',
          body: JSON.stringify({
            staff_id: schedStaffId,
            shift_date: schedDate,
            start_time: schedStartTime,
            end_time: schedEndTime,
            station: schedStation,
            status: schedStatus,
            notes: schedNotes
          })
        });
      }
      setIsScheduleModalOpen(false);
      await loadSchedules();
      showToast(t('staff.save_success'));
    } catch (err: any) {
      alert(err.message || 'Error saving schedule');
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!window.confirm(t('staff.delete_shift_confirm'))) return;
    try {
      await apiRequest(`/staff/schedules/${id}`, { method: 'DELETE' });
      await loadSchedules();
      showToast(t('staff.delete_success'));
    } catch (err: any) {
      alert(err.message || 'Error deleting schedule');
    }
  };

  // Clock In / Clock Out Handlers
  const handleOpenClockModal = (staffId: string, mode: 'in' | 'out') => {
    setClockStaffId(staffId);
    setClockModalMode(mode);
    setClockNotes('');
    setClockBreakMin(mode === 'out' ? 30 : 0);
    setIsClockModalOpen(true);
  };

  const handleExecuteClock = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (clockModalMode === 'in') {
        await apiRequest('/staff/clock-in', {
          method: 'POST',
          body: JSON.stringify({ staff_id: clockStaffId, notes: clockNotes })
        });
      } else {
        await apiRequest('/staff/clock-out', {
          method: 'POST',
          body: JSON.stringify({ staff_id: clockStaffId, break_minutes: clockBreakMin, notes: clockNotes })
        });
      }
      setIsClockModalOpen(false);
      await Promise.all([loadStaff(), loadHoursData()]);
      showToast(t('staff.save_success'));
    } catch (err: any) {
      alert(err.message || 'Clock action failed');
    }
  };

  // Manual Time Entry Handlers
  const handleOpenTimeModal = (entry?: StaffTimeEntry) => {
    if (entry) {
      setEditingTimeEntry(entry);
      setTimeStaffId(entry.staff_id);
      setTimeClockIn(entry.clock_in ? entry.clock_in.substring(0, 16) : '');
      setTimeClockOut(entry.clock_out ? entry.clock_out.substring(0, 16) : '');
      setTimeBreakMinutes(entry.break_minutes || 0);
      setTimeShiftType(entry.shift_type || 'regular');
      setTimeNotes(entry.notes || '');
    } else {
      setEditingTimeEntry(null);
      setTimeStaffId(staffList[0]?.id || '');
      const todayStr = new Date().toISOString().split('T')[0];
      setTimeClockIn(`${todayStr}T08:00`);
      setTimeClockOut(`${todayStr}T16:30`);
      setTimeBreakMinutes(30);
      setTimeShiftType('regular');
      setTimeNotes('');
    }
    setIsTimeModalOpen(true);
  };

  const handleSaveTimeEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingTimeEntry) {
        await apiRequest(`/staff/time-entries/${editingTimeEntry.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            clock_in: timeClockIn,
            clock_out: timeClockOut,
            break_minutes: timeBreakMinutes,
            shift_type: timeShiftType,
            notes: timeNotes
          })
        });
      } else {
        await apiRequest('/staff/time-entries', {
          method: 'POST',
          body: JSON.stringify({
            staff_id: timeStaffId,
            clock_in: timeClockIn,
            clock_out: timeClockOut,
            break_minutes: timeBreakMinutes,
            shift_type: timeShiftType,
            notes: timeNotes
          })
        });
      }
      setIsTimeModalOpen(false);
      await loadHoursData();
      showToast(t('staff.save_success'));
    } catch (err: any) {
      alert(err.message || 'Error saving time entry');
    }
  };

  const handleDeleteTimeEntry = async (id: string) => {
    if (!window.confirm(t('staff.delete_time_confirm'))) return;
    try {
      await apiRequest(`/staff/time-entries/${id}`, { method: 'DELETE' });
      await loadHoursData();
      showToast(t('staff.delete_success'));
    } catch (err: any) {
      alert(err.message || 'Error deleting time entry');
    }
  };

  const handleSyncWaiterShifts = async () => {
    try {
      const res = await apiRequest<{ success: boolean; syncedCount: number; message: string }>('/staff/sync-waiter-shifts', {
        method: 'POST'
      });
      await loadHoursData();
      showToast(`${res.message}`);
    } catch (err: any) {
      alert(err.message || 'Error syncing waiter shifts');
    }
  };

  // Employee CRUD Handlers
  const handleOpenEmployeeModal = (emp?: StaffMember) => {
    if (emp) {
      setEditingEmployee(emp);
      setEmpName(emp.name);
      setEmpPin(emp.pin || '1234');
      setEmpRole(emp.role);
      setEmpDept(emp.department || 'service');
      setEmpRate(emp.hourly_rate || 300);
      setEmpTargetHours(emp.target_weekly_hours || 40);
      setEmpPhone(emp.phone || '');
      setEmpEmail(emp.email || '');
      setEmpHireDate(emp.hire_date || '');
      setEmpNotes(emp.notes || '');
    } else {
      setEditingEmployee(null);
      setEmpName('');
      setEmpPin('1234');
      setEmpRole('waiter');
      setEmpDept('service');
      setEmpRate(300);
      setEmpTargetHours(40);
      setEmpPhone('0712345678');
      setEmpEmail('');
      setEmpHireDate(new Date().toISOString().split('T')[0]);
      setEmpNotes('');
    }
    setIsEmployeeModalOpen(true);
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingEmployee) {
        await apiRequest(`/staff/${editingEmployee.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: empName,
            pin: empPin,
            role: empRole,
            department: empDept,
            hourly_rate: empRate,
            target_weekly_hours: empTargetHours,
            phone: empPhone,
            email: empEmail,
            hire_date: empHireDate,
            notes: empNotes
          })
        });
      } else {
        await apiRequest('/staff', {
          method: 'POST',
          body: JSON.stringify({
            name: empName,
            pin: empPin,
            role: empRole,
            department: empDept,
            hourly_rate: empRate,
            target_weekly_hours: empTargetHours,
            phone: empPhone,
            email: empEmail,
            hire_date: empHireDate,
            notes: empNotes
          })
        });
      }
      setIsEmployeeModalOpen(false);
      await loadStaff();
      showToast(t('staff.save_success'));
    } catch (err: any) {
      alert(err.message || 'Error saving staff member');
    }
  };

  const handleToggleEmployeeActive = async (id: string) => {
    try {
      await apiRequest(`/staff/${id}/toggle-active`, { method: 'POST' });
      await loadStaff();
      showToast(t('staff.save_success'));
    } catch (err: any) {
      alert(err.message || 'Error toggling staff status');
    }
  };

  // Station colors and label helper
  const getStationBadge = (station: string) => {
    switch (station) {
      case 'kitchen':
        return { label: t('staff.station_kitchen'), bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' };
      case 'bar':
        return { label: t('staff.station_bar'), bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: 'rgba(16, 185, 129, 0.3)' };
      case 'cashier':
        return { label: t('staff.station_cashier'), bg: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa', border: 'rgba(139, 92, 246, 0.3)' };
      case 'management':
        return { label: t('staff.station_management'), bg: 'rgba(236, 72, 153, 0.15)', color: '#f472b6', border: 'rgba(236, 72, 153, 0.3)' };
      case 'cleaning':
        return { label: t('staff.station_cleaning'), bg: 'rgba(107, 114, 128, 0.15)', color: '#9ca3af', border: 'rgba(107, 114, 128, 0.3)' };
      default:
        return { label: t('staff.station_service'), bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: 'rgba(59, 130, 246, 0.3)' };
    }
  };

  // Status badge helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return { label: t('staff.status_confirmed'), bg: 'rgba(16, 185, 129, 0.2)', color: '#34d399' };
      case 'completed':
        return { label: t('staff.status_completed'), bg: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' };
      case 'absent':
        return { label: t('staff.status_absent'), bg: 'rgba(239, 68, 68, 0.2)', color: '#f87171' };
      case 'sick':
        return { label: t('staff.status_sick'), bg: 'rgba(249, 115, 22, 0.2)', color: '#fb923c' };
      case 'holiday':
        return { label: t('staff.status_holiday'), bg: 'rgba(168, 85, 247, 0.2)', color: '#c084fc' };
      default:
        return { label: t('staff.status_scheduled'), bg: 'rgba(107, 114, 128, 0.2)', color: '#d1d5db' };
    }
  };

  return (
    <div className="page-container">
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: '#fff',
          padding: '12px 20px',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontWeight: 600
        }}>
          <CheckCircle2 size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="section-header" style={{ marginBottom: '20px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users size={28} color="var(--primary)" />
            {t('staff.title')}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            {t('staff.subtitle')}
          </p>
        </div>

        {/* Action button based on active tab */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {activeTab === 'roster' && (
            <button className="btn btn-primary" onClick={() => handleOpenScheduleModal()}>
              <Plus size={18} />
              {t('staff.add_shift_btn')}
            </button>
          )}
          {activeTab === 'hours' && (
            <>
              <button className="btn btn-secondary" onClick={handleSyncWaiterShifts} title={t('staff.sync_pos_shifts_btn')}>
                <RefreshCw size={16} />
                {t('staff.sync_pos_shifts_btn')}
              </button>
              <button className="btn btn-secondary" onClick={() => window.print()} title={t('staff.print_report_btn')}>
                <Printer size={16} />
                {t('staff.print_report_btn')}
              </button>
              <button className="btn btn-primary" onClick={() => handleOpenTimeModal()}>
                <Plus size={18} />
                {t('staff.add_time_entry_btn')}
              </button>
            </>
          )}
          {activeTab === 'employees' && (
            <button className="btn btn-primary" onClick={() => handleOpenEmployeeModal()}>
              <Plus size={18} />
              {t('staff.add_employee_btn')}
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{
        display: 'flex',
        gap: '6px',
        borderBottom: '1px solid var(--border-subtle)',
        marginBottom: '20px'
      }}>
        <button
          type="button"
          className={`btn ${activeTab === 'roster' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('roster')}
          style={{ borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Calendar size={18} />
          {t('staff.tab_roster')}
        </button>
        <button
          type="button"
          className={`btn ${activeTab === 'hours' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('hours')}
          style={{ borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Clock size={18} />
          {t('staff.tab_hours')}
        </button>
        <button
          type="button"
          className={`btn ${activeTab === 'employees' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('employees')}
          style={{ borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Briefcase size={18} />
          {t('staff.tab_employees')}
          <span className="badge badge-neutral" style={{ marginLeft: '4px' }}>{staffList.length}</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: DIENSTPLAN / SCHICHTPLAN (ROSTER)                                  */}
      {/* ========================================================================= */}
      {activeTab === 'roster' && (
        <div>
          {/* Week Selector Bar */}
          <div className="glass-panel" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 18px',
            marginBottom: '18px',
            borderRadius: 'var(--radius-md)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setCurrentWeekOffset(prev => prev - 1)}
                style={{ padding: '6px 12px' }}
              >
                <ArrowLeft size={16} />
                {t('staff.prev_week')}
              </button>
              <button 
                type="button" 
                className="btn btn-ghost" 
                onClick={() => setCurrentWeekOffset(0)}
                style={{ fontWeight: currentWeekOffset === 0 ? 800 : 500 }}
              >
                {t('staff.this_week')}
              </button>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setCurrentWeekOffset(prev => prev + 1)}
                style={{ padding: '6px 12px' }}
              >
                {t('staff.next_week')}
                <ArrowRight size={16} />
              </button>
            </div>

            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t('staff.week_label')}</span>
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--primary)' }}>
                {weekDays[0].toLocaleDateString(undefined, { day: '2-digit', month: 'short' })} – {weekDays[6].toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
            </div>

            {/* Filter by Station */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Filter size={16} color="var(--text-muted)" />
              <select 
                value={stationFilter} 
                onChange={e => setStationFilter(e.target.value)}
                style={{ padding: '6px 10px', fontSize: '0.85rem' }}
              >
                <option value="all">Alle Stationen</option>
                <option value="service">{t('staff.station_service')}</option>
                <option value="kitchen">{t('staff.station_kitchen')}</option>
                <option value="bar">{t('staff.station_bar')}</option>
                <option value="cashier">{t('staff.station_cashier')}</option>
                <option value="management">{t('staff.station_management')}</option>
              </select>
            </div>
          </div>

          {/* 7-Day Roster Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '10px',
            alignItems: 'start'
          }}>
            {weekDays.map((dateObj) => {
              const dateStr = dateObj.toISOString().split('T')[0];
              const isToday = dateStr === new Date().toISOString().split('T')[0];
              const dayName = dateObj.toLocaleDateString(undefined, { weekday: 'short' });
              const dayFormatted = dateObj.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' });

              const dayShifts = schedules.filter(s => {
                const matchDate = s.shift_date === dateStr;
                const matchStation = stationFilter === 'all' || s.station === stationFilter;
                return matchDate && matchStation;
              });

              const dayHoursSum = dayShifts.reduce((acc, curr) => acc + (curr.planned_hours || 0), 0);

              return (
                <div 
                  key={dateStr}
                  className="glass-panel"
                  style={{
                    borderRadius: 'var(--radius-md)',
                    border: isToday ? '2px solid var(--primary)' : '1px solid var(--border-subtle)',
                    background: isToday ? 'rgba(245, 158, 11, 0.04)' : 'var(--bg-surface)',
                    minHeight: '420px',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  {/* Day Header */}
                  <div style={{
                    padding: '10px',
                    borderBottom: '1px solid var(--border-subtle)',
                    background: isToday ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.95rem', color: isToday ? 'var(--primary)' : 'var(--text-main)' }}>
                        {dayName}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {dayFormatted}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>
                        {dayHoursSum}h
                      </span>
                    </div>
                  </div>

                  {/* Shifts Container */}
                  <div style={{ padding: '8px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {dayShifts.length === 0 ? (
                      <div style={{ 
                        padding: '24px 8px', 
                        textAlign: 'center', 
                        fontSize: '0.75rem', 
                        color: 'var(--text-dim)',
                        fontStyle: 'italic'
                      }}>
                        {t('staff.no_shifts_day')}
                      </div>
                    ) : (
                      dayShifts.map(s => {
                        const stBadge = getStationBadge(s.station);
                        const statusBadge = getStatusBadge(s.status);

                        return (
                          <div 
                            key={s.id}
                            style={{
                              background: 'var(--bg-surface-elevated)',
                              border: `1px solid ${stBadge.border}`,
                              borderRadius: 'var(--radius-sm)',
                              padding: '8px',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                              position: 'relative'
                            }}
                          >
                            {/* Staff Name & Status */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                              <div style={{ fontWeight: 700, fontSize: '0.85rem', lineHeight: 1.2 }}>
                                {s.staff_name}
                              </div>
                              <span style={{
                                fontSize: '0.65rem',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                background: statusBadge.bg,
                                color: statusBadge.color,
                                fontWeight: 700
                              }}>
                                {statusBadge.label}
                              </span>
                            </div>

                            {/* Time & Hours */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                              <span>{s.start_time} - {s.end_time}</span>
                              <strong style={{ color: 'var(--text-main)' }}>{s.planned_hours}h</strong>
                            </div>

                            {/* Station Badge */}
                            <div style={{
                              display: 'inline-block',
                              fontSize: '0.68rem',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              background: stBadge.bg,
                              color: stBadge.color,
                              fontWeight: 600,
                              marginBottom: '6px'
                            }}>
                              {stBadge.label}
                            </div>

                            {s.notes && (
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontStyle: 'italic', marginBottom: '6px' }}>
                                {s.notes}
                              </div>
                            )}

                            {/* Actions */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px', borderTop: '1px dashed var(--border-subtle)', paddingTop: '4px' }}>
                              <button 
                                type="button" 
                                className="btn btn-ghost" 
                                onClick={() => handleOpenScheduleModal(s)}
                                style={{ padding: '2px 4px', minHeight: '22px' }}
                                title="Edit"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button 
                                type="button" 
                                className="btn btn-ghost" 
                                onClick={() => handleDeleteSchedule(s.id)}
                                style={{ padding: '2px 4px', minHeight: '22px', color: '#f87171' }}
                                title="Delete"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Add Shift Quick Button for this day */}
                  <div style={{ padding: '6px 8px', borderTop: '1px solid var(--border-subtle)' }}>
                    <button 
                      type="button" 
                      className="btn btn-ghost" 
                      onClick={() => handleOpenScheduleModal(undefined, dateStr)}
                      style={{ width: '100%', fontSize: '0.75rem', padding: '4px', justifyContent: 'center' }}
                    >
                      <Plus size={14} />
                      {t('common.add')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: STUNDENÜBERSICHT & ZEITERFASSUNG (HOURS & PAYROLL)                  */}
      {/* ========================================================================= */}
      {activeTab === 'hours' && (
        <div>
          {/* Filter & Period Selector */}
          <div className="glass-panel" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 18px',
            marginBottom: '20px',
            borderRadius: 'var(--radius-md)'
          }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              {(['this_week', 'last_week', 'this_month', 'last_month', 'all'] as const).map(p => (
                <button
                  key={p}
                  type="button"
                  className={`btn ${hoursPeriod === p ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setHoursPeriod(p)}
                  style={{ fontSize: '0.82rem', padding: '6px 12px' }}
                >
                  {t(`staff.filter_${p}`)}
                </button>
              ))}
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {t('staff.report_for_period')}: <strong style={{ color: 'var(--primary)' }}>{t(`staff.filter_${hoursPeriod}`)}</strong>
            </div>
          </div>

          {/* Metric Summary Cards */}
          {hoursSummary?.summary && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: '12px',
              marginBottom: '24px'
            }}>
              <div className="glass-panel" style={{ padding: '16px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  {t('staff.total_actual_hours')}
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#10b981' }}>
                  {hoursSummary.summary.totalActualHours}h
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '16px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  {t('staff.total_planned_hours')}
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  {hoursSummary.summary.totalPlannedHours}h
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '16px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  {t('staff.overtime_diff')}
                </div>
                {(() => {
                  const diff = Math.round((hoursSummary.summary.totalActualHours - hoursSummary.summary.totalPlannedHours) * 10) / 10;
                  return (
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: diff >= 0 ? '#10b981' : '#f87171' }}>
                      {diff >= 0 ? `+${diff}h` : `${diff}h`}
                    </div>
                  );
                })()}
              </div>

              <div className="glass-panel" style={{ padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  {t('staff.total_payroll')}
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary)' }}>
                  {formatKES(hoursSummary.summary.totalWagesKES)}
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '16px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  {t('staff.total_shifts_count')}
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  {hoursSummary.summary.totalShifts}
                </div>
              </div>
            </div>
          )}

          {/* Employee Hours Aggregation Table */}
          <div className="glass-panel" style={{ padding: '20px', borderRadius: 'var(--radius-md)', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={20} color="var(--primary)" />
              {t('staff.tab_hours')} ({t(`staff.filter_${hoursPeriod}`)})
            </h3>

            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('staff.name_label')}</th>
                    <th>{t('staff.department_label')}</th>
                    <th>{t('staff.rate_col')}</th>
                    <th>{t('staff.planned_col')}</th>
                    <th>{t('staff.actual_col')}</th>
                    <th>{t('staff.diff_col')}</th>
                    <th>{t('staff.wages_col')}</th>
                    <th>{t('staff.shifts_col')}</th>
                    <th style={{ textAlign: 'right' }}>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {hoursSummary?.staff?.map((s: StaffHoursSummary) => {
                    const isClockedIn = staffList.find(st => st.id === s.id)?.activeClockIn;

                    return (
                      <tr key={s.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: 'rgba(245, 158, 11, 0.15)',
                              color: 'var(--primary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.85rem'
                            }}>
                              {s.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700 }}>{s.name}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.phone || '-'}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-neutral" style={{ textTransform: 'capitalize' }}>
                            {s.department || s.role}
                          </span>
                        </td>
                        <td>
                          <strong style={{ color: 'var(--primary)' }}>{formatKES(s.hourly_rate)}/h</strong>
                        </td>
                        <td>{s.planned_hours}h</td>
                        <td>
                          <strong style={{ color: '#10b981' }}>{s.actual_hours}h</strong>
                        </td>
                        <td>
                          <span style={{
                            fontWeight: 700,
                            color: s.diff_hours >= 0 ? '#10b981' : '#f87171'
                          }}>
                            {s.diff_hours >= 0 ? `+${s.diff_hours}h` : `${s.diff_hours}h`}
                          </span>
                        </td>
                        <td>
                          <strong style={{ fontSize: '1rem', color: 'var(--primary)' }}>
                            {formatKES(s.total_wage)}
                          </strong>
                        </td>
                        <td>{s.shift_count}</td>
                        <td style={{ textAlign: 'right' }}>
                          {isClockedIn ? (
                            <button 
                              type="button" 
                              className="btn btn-secondary"
                              onClick={() => handleOpenClockModal(s.id, 'out')}
                              style={{ padding: '4px 10px', fontSize: '0.8rem', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                            >
                              <XCircle size={14} />
                              {t('staff.clock_out_btn')}
                            </button>
                          ) : (
                            <button 
                              type="button" 
                              className="btn btn-secondary"
                              onClick={() => handleOpenClockModal(s.id, 'in')}
                              style={{ padding: '4px 10px', fontSize: '0.8rem', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}
                            >
                              <CheckCircle2 size={14} />
                              {t('staff.clock_in_btn')}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detailed Time Entries Log */}
          <div className="glass-panel" style={{ padding: '20px', borderRadius: 'var(--radius-md)' }}>
            <h3 style={{ fontSize: '1.05rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} color="var(--primary)" />
              {t('staff.recent_time_logs')}
            </h3>

            {timeEntries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                {t('staff.no_time_entries')}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('staff.date')}</th>
                      <th>{t('staff.name_label')}</th>
                      <th>{t('staff.clock_in_time')}</th>
                      <th>{t('staff.clock_out_time')}</th>
                      <th>{t('staff.break_minutes')}</th>
                      <th>{t('staff.actual_col')}</th>
                      <th>{t('staff.wages_col')}</th>
                      <th>{t('staff.shift_type')}</th>
                      <th>{t('staff.notes')}</th>
                      <th style={{ textAlign: 'right' }}>{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timeEntries.map(e => {
                      const inDate = new Date(e.clock_in);
                      const outDate = e.clock_out ? new Date(e.clock_out) : null;

                      return (
                        <tr key={e.id}>
                          <td>{inDate.toLocaleDateString()}</td>
                          <td><strong>{e.staff_name}</strong></td>
                          <td>{inDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                          <td>
                            {outDate ? (
                              outDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            ) : (
                              <span className="badge badge-success" style={{ animation: 'pulse 2s infinite' }}>
                                {t('staff.currently_working')}
                              </span>
                            )}
                          </td>
                          <td>{e.break_minutes}m</td>
                          <td><strong>{e.total_hours}h</strong></td>
                          <td><strong style={{ color: 'var(--primary)' }}>{formatKES(e.total_wage)}</strong></td>
                          <td>
                            <span className="badge badge-neutral" style={{ textTransform: 'capitalize' }}>
                              {e.shift_type}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{e.notes || '-'}</td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                              <button 
                                type="button" 
                                className="btn btn-ghost" 
                                onClick={() => handleOpenTimeModal(e)}
                                style={{ padding: '4px' }}
                              >
                                <Edit2 size={15} />
                              </button>
                              <button 
                                type="button" 
                                className="btn btn-ghost" 
                                onClick={() => handleDeleteTimeEntry(e.id)}
                                style={{ padding: '4px', color: '#f87171' }}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: MITARBEITERVERWALTUNG (STAFF DIRECTORY)                             */}
      {/* ========================================================================= */}
      {activeTab === 'employees' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '16px'
        }}>
          {staffList.map(member => {
            const isClockedIn = !!member.activeClockIn;

            return (
              <div 
                key={member.id}
                className="glass-panel"
                style={{
                  borderRadius: 'var(--radius-md)',
                  padding: '18px',
                  border: isClockedIn ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-subtle)',
                  background: member.is_active ? 'var(--bg-surface)' : 'rgba(0,0,0,0.3)',
                  opacity: member.is_active ? 1 : 0.65,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.2)'
                }}
              >
                <div>
                  {/* Top Bar: Avatar & Active Badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                        color: '#0d1117',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '1.1rem'
                      }}>
                        {member.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 style={{ fontSize: '1.05rem', margin: 0 }}>{member.name}</h4>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                          <span className="badge badge-neutral" style={{ textTransform: 'capitalize', fontSize: '0.72rem' }}>
                            {member.role}
                          </span>
                          <span className="badge badge-neutral" style={{ textTransform: 'capitalize', fontSize: '0.72rem' }}>
                            {member.department || 'service'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {isClockedIn && (
                      <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff' }} />
                        {t('staff.currently_working')}
                      </span>
                    )}
                  </div>

                  {/* Details List */}
                  <div style={{
                    background: 'var(--bg-surface-elevated)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '10px 12px',
                    marginBottom: '14px',
                    fontSize: '0.85rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{t('staff.hourly_rate_label')}:</span>
                      <strong style={{ color: 'var(--primary)' }}>{formatKES(member.hourly_rate || 0)}/h</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{t('staff.target_hours_label')}:</span>
                      <span>{member.target_weekly_hours || 40}h / Woche</span>
                    </div>

                    {member.phone && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{t('staff.phone_label')}:</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981', fontWeight: 600 }}>
                          <Phone size={13} />
                          {member.phone}
                        </span>
                      </div>
                    )}

                    {member.email && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{t('staff.email_label')}:</span>
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>{member.email}</span>
                      </div>
                    )}

                    {member.hire_date && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{t('staff.hire_date_label')}:</span>
                        <span>{new Date(member.hire_date).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => handleOpenEmployeeModal(member)}
                    style={{ flex: 1, padding: '6px', fontSize: '0.82rem' }}
                  >
                    <Edit2 size={14} />
                    {t('common.edit')}
                  </button>
                  <button 
                    type="button" 
                    className={`btn ${member.is_active ? 'btn-ghost' : 'btn-success'}`}
                    onClick={() => handleToggleEmployeeActive(member.id)}
                    style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                  >
                    {member.is_active ? t('staff.status_inactive') : t('staff.status_active')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SCHEDULE SHIFT (DIENSTPLAN EINTRAG)                                */}
      {/* ========================================================================= */}
      {isScheduleModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card glass-panel-elevated" style={{ maxWidth: '440px', padding: '24px' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>
              {editingSchedule ? t('staff.edit_shift_title') : t('staff.add_shift_title')}
            </h2>

            <form onSubmit={handleSaveSchedule}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
                  {t('staff.select_staff')}
                </label>
                <select 
                  value={schedStaffId} 
                  onChange={e => setSchedStaffId(e.target.value)}
                  required
                >
                  {staffList.filter(s => s.is_active).map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.role} - {formatKES(s.hourly_rate)}/h)
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
                  {t('staff.date')}
                </label>
                <input 
                  type="date" 
                  value={schedDate} 
                  onChange={e => setSchedDate(e.target.value)} 
                  required 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
                    {t('staff.start_time')}
                  </label>
                  <input 
                    type="time" 
                    value={schedStartTime} 
                    onChange={e => setSchedStartTime(e.target.value)} 
                    required 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
                    {t('staff.end_time')}
                  </label>
                  <input 
                    type="time" 
                    value={schedEndTime} 
                    onChange={e => setSchedEndTime(e.target.value)} 
                    required 
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
                    {t('staff.station')}
                  </label>
                  <select 
                    value={schedStation} 
                    onChange={e => setSchedStation(e.target.value)}
                  >
                    <option value="service">{t('staff.station_service')}</option>
                    <option value="kitchen">{t('staff.station_kitchen')}</option>
                    <option value="bar">{t('staff.station_bar')}</option>
                    <option value="cashier">{t('staff.station_cashier')}</option>
                    <option value="management">{t('staff.station_management')}</option>
                    <option value="cleaning">{t('staff.station_cleaning')}</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
                    {t('common.status')}
                  </label>
                  <select 
                    value={schedStatus} 
                    onChange={e => setSchedStatus(e.target.value as any)}
                  >
                    <option value="scheduled">{t('staff.status_scheduled')}</option>
                    <option value="confirmed">{t('staff.status_confirmed')}</option>
                    <option value="completed">{t('staff.status_completed')}</option>
                    <option value="sick">{t('staff.status_sick')}</option>
                    <option value="absent">{t('staff.status_absent')}</option>
                    <option value="holiday">{t('staff.status_holiday')}</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
                  {t('staff.notes')}
                </label>
                <input 
                  type="text" 
                  value={schedNotes} 
                  onChange={e => setSchedNotes(e.target.value)} 
                  placeholder={t('staff.notes_placeholder')} 
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setIsScheduleModalOpen(false)}
                  style={{ flex: 1 }}
                >
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  {t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CLOCK IN / CLOCK OUT (STEMPELUHR)                                   */}
      {/* ========================================================================= */}
      {isClockModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card glass-panel-elevated" style={{ maxWidth: '380px', padding: '24px' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={22} color={clockModalMode === 'in' ? '#10b981' : '#f87171'} />
              {clockModalMode === 'in' ? t('staff.clock_in_title') : t('staff.clock_out_title')}
            </h2>

            <form onSubmit={handleExecuteClock}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
                  {t('staff.name_label')}
                </label>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--primary)' }}>
                  {staffList.find(s => s.id === clockStaffId)?.name}
                </div>
              </div>

              {clockModalMode === 'out' && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
                    {t('staff.break_minutes')}
                  </label>
                  <input 
                    type="number" 
                    value={clockBreakMin} 
                    onChange={e => setClockBreakMin(Number(e.target.value))} 
                    min={0}
                    step={5}
                  />
                </div>
              )}

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
                  {t('staff.notes')}
                </label>
                <input 
                  type="text" 
                  value={clockNotes} 
                  onChange={e => setClockNotes(e.target.value)} 
                  placeholder={t('staff.notes_placeholder')} 
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setIsClockModalOpen(false)}
                  style={{ flex: 1 }}
                >
                  {t('common.cancel')}
                </button>
                <button 
                  type="submit" 
                  className={`btn ${clockModalMode === 'in' ? 'btn-success' : 'btn-primary'}`} 
                  style={{ flex: 1 }}
                >
                  {clockModalMode === 'in' ? t('staff.clock_in_btn') : t('staff.clock_out_btn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: MANUAL TIME ENTRY (ARBEITSZEIT NACHTRAGEN)                         */}
      {/* ========================================================================= */}
      {isTimeModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card glass-panel-elevated" style={{ maxWidth: '440px', padding: '24px' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>
              {t('staff.time_entry_title')}
            </h2>

            <form onSubmit={handleSaveTimeEntry}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
                  {t('staff.select_staff')}
                </label>
                <select 
                  value={timeStaffId} 
                  onChange={e => setTimeStaffId(e.target.value)}
                  disabled={!!editingTimeEntry}
                  required
                >
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.role} - {formatKES(s.hourly_rate)}/h)
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
                    {t('staff.clock_in_time')}
                  </label>
                  <input 
                    type="datetime-local" 
                    value={timeClockIn} 
                    onChange={e => setTimeClockIn(e.target.value)} 
                    required 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
                    {t('staff.clock_out_time')}
                  </label>
                  <input 
                    type="datetime-local" 
                    value={timeClockOut} 
                    onChange={e => setTimeClockOut(e.target.value)} 
                    required 
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
                    {t('staff.break_minutes')}
                  </label>
                  <input 
                    type="number" 
                    value={timeBreakMinutes} 
                    onChange={e => setTimeBreakMinutes(Number(e.target.value))} 
                    min={0}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
                    {t('staff.shift_type')}
                  </label>
                  <select 
                    value={timeShiftType} 
                    onChange={e => setTimeShiftType(e.target.value)}
                  >
                    <option value="regular">{t('staff.shift_type_regular')}</option>
                    <option value="overtime">{t('staff.shift_type_overtime')}</option>
                    <option value="holiday">{t('staff.shift_type_holiday')}</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
                  {t('staff.notes')}
                </label>
                <input 
                  type="text" 
                  value={timeNotes} 
                  onChange={e => setTimeNotes(e.target.value)} 
                  placeholder={t('staff.notes_placeholder')} 
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setIsTimeModalOpen(false)}
                  style={{ flex: 1 }}
                >
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  {t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT EMPLOYEE PROFILE                                         */}
      {/* ========================================================================= */}
      {isEmployeeModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card glass-panel-elevated" style={{ maxWidth: '480px', padding: '24px' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>
              {editingEmployee ? t('staff.edit_employee_title') : t('staff.add_employee_title')}
            </h2>

            <form onSubmit={handleSaveEmployee}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
                  {t('staff.name_label')}
                </label>
                <input 
                  type="text" 
                  value={empName} 
                  onChange={e => setEmpName(e.target.value)} 
                  required 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
                    {t('staff.role_label')}
                  </label>
                  <select 
                    value={empRole} 
                    onChange={e => {
                      setEmpRole(e.target.value);
                      if (e.target.value === 'kitchen') setEmpDept('kitchen');
                      else if (e.target.value === 'bar') setEmpDept('bar');
                      else if (e.target.value === 'manager') setEmpDept('management');
                    }}
                  >
                    <option value="waiter">Kellner / Waiter</option>
                    <option value="kitchen">Koch / Head Chef</option>
                    <option value="bar">Barkeeper / Bartender</option>
                    <option value="manager">Schichtleiter / Manager</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
                    {t('staff.department_label')}
                  </label>
                  <select 
                    value={empDept} 
                    onChange={e => setEmpDept(e.target.value)}
                  >
                    <option value="service">Service & Terrasse</option>
                    <option value="kitchen">Küche</option>
                    <option value="bar">Bar</option>
                    <option value="cashier">Kasse</option>
                    <option value="management">Management</option>
                    <option value="cleaning">Reinigung</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
                    {t('staff.hourly_rate_label')}
                  </label>
                  <input 
                    type="number" 
                    value={empRate} 
                    onChange={e => setEmpRate(Number(e.target.value))} 
                    min={0}
                    step={10}
                    required 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
                    {t('staff.target_hours_label')}
                  </label>
                  <input 
                    type="number" 
                    value={empTargetHours} 
                    onChange={e => setEmpTargetHours(Number(e.target.value))} 
                    min={0}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
                    {t('staff.phone_label')}
                  </label>
                  <input 
                    type="text" 
                    value={empPhone} 
                    onChange={e => setEmpPhone(e.target.value)} 
                    placeholder="07..." 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
                    {t('staff.pin_label')}
                  </label>
                  <input 
                    type="password" 
                    maxLength={4}
                    value={empPin} 
                    onChange={e => setEmpPin(e.target.value)} 
                    placeholder="1234"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
                    {t('staff.email_label')}
                  </label>
                  <input 
                    type="email" 
                    value={empEmail} 
                    onChange={e => setEmpEmail(e.target.value)} 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
                    {t('staff.hire_date_label')}
                  </label>
                  <input 
                    type="date" 
                    value={empHireDate} 
                    onChange={e => setEmpHireDate(e.target.value)} 
                  />
                </div>
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
                  {t('staff.notes')}
                </label>
                <input 
                  type="text" 
                  value={empNotes} 
                  onChange={e => setEmpNotes(e.target.value)} 
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setIsEmployeeModalOpen(false)}
                  style={{ flex: 1 }}
                >
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  {t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default StaffPage;
