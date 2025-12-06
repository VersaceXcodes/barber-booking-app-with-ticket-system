import { Pool } from 'pg';

// ============================================================================
// TYPES
// ============================================================================

export interface WalkInQueueEntry {
  queue_id: string;
  customer_name: string;
  customer_phone: string;
  status: 'waiting' | 'ready' | 'called' | 'served' | 'left' | 'no_show';
  position: number;
  estimated_wait_minutes: number;
  estimated_service_duration: number;
  created_at: string;
  updated_at: string;
  served_at?: string;
}

export interface Booking {
  booking_id: string;
  appointment_date: string;
  appointment_time: string;
  slot_duration: number;
  status: string;
}

export interface BarberStatus {
  barber_id: string;
  is_active: boolean;
  current_client_end_time?: string;
}

export interface WaitTimeCalculation {
  currentWaitMinutes: number;
  queueLength: number;
  activeBarbers: number;
  nextAvailableSlot?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_HAIRCUT_DURATION = 30; // minutes
const DEFAULT_ACTIVE_BARBERS = 2; // Default number of barbers working

// ============================================================================
// WAIT TIME SERVICE
// ============================================================================

export class WaitTimeService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Get the current estimated wait time in minutes
   */
  async getCurrentWaitMinutes(): Promise<number> {
    const calculation = await this.calculateWaitTime();
    return calculation.currentWaitMinutes;
  }

  /**
   * Get the queue position for a specific user
   */
  async getQueuePositionFor(queueId: string): Promise<number | null> {
    try {
      const result = await this.pool.query(
        `SELECT position FROM walk_in_queue 
         WHERE queue_id = $1 AND status = 'waiting'`,
        [queueId]
      );
      return result.rows.length > 0 ? result.rows[0].position : null;
    } catch (error) {
      console.error('Error getting queue position:', error);
      return null;
    }
  }

  /**
   * Calculate the current wait time based on:
   * - Active barbers
   * - Upcoming appointments
   * - Walk-in queue
   */
  async calculateWaitTime(): Promise<WaitTimeCalculation> {
    try {
      // Get active barbers count (for now, use default)
      const activeBarbers = await this.getActiveBarberCount();

      // Get current date and time
      const now = new Date();
      const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const currentTime = now.toTimeString().split(' ')[0].substring(0, 5); // HH:MM

      // Get upcoming appointments for today
      const upcomingAppointments = await this.getUpcomingAppointments(currentDate, currentTime);

      // Get current walk-in queue
      const walkInQueue = await this.getWalkInQueue();

      // Calculate wait time
      const waitMinutes = this.estimateWaitTime(
        activeBarbers,
        upcomingAppointments,
        walkInQueue,
        now
      );

      return {
        currentWaitMinutes: Math.max(0, Math.round(waitMinutes)),
        queueLength: walkInQueue.length,
        activeBarbers: activeBarbers,
        nextAvailableSlot: this.calculateNextAvailableSlot(
          activeBarbers,
          upcomingAppointments,
          walkInQueue,
          now
        )
      };
    } catch (error) {
      console.error('Error calculating wait time:', error);
      // Return a safe default
      return {
        currentWaitMinutes: 15,
        queueLength: 0,
        activeBarbers: DEFAULT_ACTIVE_BARBERS,
      };
    }
  }

  /**
   * Get the number of active barbers
   * TODO: This should query a barbers table when implemented
   */
  private async getActiveBarberCount(): Promise<number> {
    // For now, return a default value
    // In the future, this should query a barbers/staff table
    return DEFAULT_ACTIVE_BARBERS;
  }

  /**
   * Get upcoming appointments for a specific date starting from a specific time
   */
  private async getUpcomingAppointments(date: string, fromTime: string): Promise<Booking[]> {
    try {
      const result = await this.pool.query(
        `SELECT booking_id, appointment_date, appointment_time, slot_duration, status
         FROM bookings
         WHERE appointment_date = $1
           AND appointment_time >= $2
           AND status IN ('confirmed', 'pending')
         ORDER BY appointment_time ASC`,
        [date, fromTime]
      );
      return result.rows;
    } catch (error) {
      console.error('Error fetching upcoming appointments:', error);
      return [];
    }
  }

  /**
   * Get the current walk-in queue (waiting customers)
   */
  private async getWalkInQueue(): Promise<WalkInQueueEntry[]> {
    try {
      const result = await this.pool.query(
        `SELECT * FROM walk_in_queue
         WHERE status = 'waiting'
         ORDER BY position ASC`
      );
      return result.rows;
    } catch (error) {
      console.error('Error fetching walk-in queue:', error);
      return [];
    }
  }

  /**
   * Estimate wait time based on barber availability, appointments, and queue
   */
  private estimateWaitTime(
    activeBarbers: number,
    upcomingAppointments: Booking[],
    walkInQueue: WalkInQueueEntry[],
    currentTime: Date
  ): number {
    if (activeBarbers === 0) {
      return 60; // If no barbers, default to 60 min wait
    }

    // Create an array to track when each barber will be free
    const barberFreeTimes: Date[] = new Array(activeBarbers).fill(currentTime);

    // Process upcoming appointments
    for (const appointment of upcomingAppointments) {
      const appointmentDateTime = new Date(
        `${appointment.appointment_date}T${appointment.appointment_time}:00`
      );
      
      // Only consider appointments in the near future (next 4 hours)
      const fourHoursFromNow = new Date(currentTime.getTime() + 4 * 60 * 60 * 1000);
      if (appointmentDateTime > fourHoursFromNow) {
        break;
      }

      // Find the earliest available barber
      const earliestFreeIndex = barberFreeTimes.findIndex(
        (freeTime) => freeTime <= appointmentDateTime
      );

      if (earliestFreeIndex !== -1) {
        // This barber can handle this appointment
        const endTime = new Date(
          appointmentDateTime.getTime() + appointment.slot_duration * 60 * 1000
        );
        barberFreeTimes[earliestFreeIndex] = endTime;
      }
    }

    // Process walk-in queue
    for (const queueEntry of walkInQueue) {
      // Find the earliest available barber
      const earliestFreeTime = Math.min(...barberFreeTimes.map(t => t.getTime()));
      const earliestFreeIndex = barberFreeTimes.findIndex(
        t => t.getTime() === earliestFreeTime
      );

      // Add this customer's service duration
      const serviceDuration = queueEntry.estimated_service_duration || DEFAULT_HAIRCUT_DURATION;
      const endTime = new Date(earliestFreeTime + serviceDuration * 60 * 1000);
      barberFreeTimes[earliestFreeIndex] = endTime;
    }

    // The wait time for a new walk-in is when the earliest barber becomes free
    const earliestAvailable = Math.min(...barberFreeTimes.map(t => t.getTime()));
    const waitMilliseconds = earliestAvailable - currentTime.getTime();
    const waitMinutes = waitMilliseconds / (60 * 1000);

    return Math.max(0, waitMinutes);
  }

  /**
   * Calculate the next available time slot
   */
  private calculateNextAvailableSlot(
    activeBarbers: number,
    upcomingAppointments: Booking[],
    walkInQueue: WalkInQueueEntry[],
    currentTime: Date
  ): string {
    const waitMinutes = this.estimateWaitTime(
      activeBarbers,
      upcomingAppointments,
      walkInQueue,
      currentTime
    );
    const nextAvailable = new Date(currentTime.getTime() + waitMinutes * 60 * 1000);
    return nextAvailable.toTimeString().split(' ')[0].substring(0, 5); // HH:MM
  }

  /**
   * Update queue positions after a change
   */
  async updateQueuePositions(): Promise<void> {
    try {
      // Get all waiting entries ordered by creation time
      const result = await this.pool.query(
        `SELECT queue_id FROM walk_in_queue
         WHERE status = 'waiting'
         ORDER BY created_at ASC`
      );

      // Update positions
      for (let i = 0; i < result.rows.length; i++) {
        await this.pool.query(
          `UPDATE walk_in_queue
           SET position = $1, updated_at = $2
           WHERE queue_id = $3`,
          [i + 1, new Date().toISOString(), result.rows[i].queue_id]
        );
      }

      // Recalculate estimated wait times for all in queue
      await this.recalculateAllWaitTimes();
    } catch (error) {
      console.error('Error updating queue positions:', error);
      throw error;
    }
  }

  /**
   * Recalculate wait times for all queue entries
   */
  private async recalculateAllWaitTimes(): Promise<void> {
    try {
      const result = await this.pool.query(
        `SELECT queue_id, position FROM walk_in_queue
         WHERE status = 'waiting'
         ORDER BY position ASC`
      );

      const baseWaitTime = await this.getCurrentWaitMinutes();

      for (const entry of result.rows) {
        // Each person in queue adds their service duration to the wait
        const additionalWait = (entry.position - 1) * DEFAULT_HAIRCUT_DURATION;
        const estimatedWait = baseWaitTime + additionalWait;

        await this.pool.query(
          `UPDATE walk_in_queue
           SET estimated_wait_minutes = $1, updated_at = $2
           WHERE queue_id = $3`,
          [Math.round(estimatedWait), new Date().toISOString(), entry.queue_id]
        );
      }
    } catch (error) {
      console.error('Error recalculating wait times:', error);
    }
  }
}

export default WaitTimeService;
